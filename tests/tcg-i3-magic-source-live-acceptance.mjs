// One operator invocation, disposable PG17 only. Import starts no DB or network.
// The frozen M4 fixture's fail-closed I/O boundary lives in an isolated DB
// worker thread. Every query below is forwarded to its real db.client; this
// is not a simulated DB. The source realm alone performs the authorized fetch.
import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import {mkdir,mkdtemp,readFile,writeFile,readdir,realpath,rm,lstat} from 'node:fs/promises';
import {appendFileSync,writeFileSync} from 'node:fs';
import {resolve,join,relative,isAbsolute,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createScryfallSource} from '../tcg-catalog-scryfall-source-v1.mjs';
import {runRealSourceAcceptance} from '../tcg-catalog-ingest-worker-v1.mjs';

const self=fileURLToPath(import.meta.url);
const now=()=>new Date().toISOString();
const check=(value,code)=>{if(!value)throw new Error('M5 acceptance: '+code);};
import {safeError,diagnosticBridgeError,diagnosticFailure} from '../tcg-catalog-diagnostics-v1.mjs';
export {safeError,diagnosticBridgeError,diagnosticFailure};
async function json(path,value){await writeFile(path,JSON.stringify(value,null,2)+'\n',{mode:0o600});}

// Evidence failure is an acceptance failure, not a revision of a product result.
// Sticky failures: a later successful overwrite does not erase a missing proof.
export function requiredEvidenceGate(ledger,writer=json){
 const written=new Set();let failed=false;
 const recordFailure=error=>{failed=true;(ledger.diagnostic_errors??=[]).push(safeError(error));};
 const persist=async(path,value)=>{try{await writer(path,value);written.add(path);return true;}catch(error){recordFailure(error);return false;}};
 const requireEvidence=paths=>{if(failed||ledger.diagnostic_errors?.length||!paths.every(p=>written.has(p))){const error=new Error('M5 acceptance: required_evidence_missing');error.evidenceFailure=true;throw error;}};
 const finalize=async({path,required,productFailure=null,productSucceeded=false,cleanupSucceeded=false,requestCount=0,emit=()=>{}})=>{
  ledger.product_operation={status:productFailure?'FAIL':productSucceeded?'PASS':'NOT_COMPLETED',failure:productFailure};
  ledger.required_evidence_complete=!failed&&required.every(p=>written.has(p));
  const pass=productSucceeded&&!productFailure&&cleanupSucceeded&&ledger.required_evidence_complete;
  ledger.real_source_acceptance=pass;ledger.i19_status=pass?'PASS':requestCount?'FAIL':'REAL_SOURCE_NOT_RUN';
  ledger.source_cases=[{id:'I18',status:ledger.i18_status},{id:'I19',status:ledger.i19_status}];
  ledger.source_cases_pass=ledger.source_cases.filter(c=>c.status==='PASS').length;
  ledger.status=pass?'M5_P1_PASS_REAL_SOURCE_PG17_ACCEPTED':productFailure?'STOP_REAL_SOURCE_ACCEPTANCE_FAILURE':'STOP_REQUIRED_EVIDENCE_OR_CLEANUP_FAILURE';
  if(!await persist(path,ledger)){
   ledger.required_evidence_complete=false;ledger.real_source_acceptance=false;ledger.i19_status=requestCount?'FAIL':'REAL_SOURCE_NOT_RUN';ledger.status='STOP_FINAL_LEDGER_WRITE_FAILURE';
   ledger.source_cases[1].status=ledger.i19_status;ledger.source_cases_pass=ledger.source_cases.filter(c=>c.status==='PASS').length;
   emit({status:ledger.status,real_source_acceptance:false,error:ledger.diagnostic_errors.at(-1)});return 1;
  }
  emit(ledger);return pass?0:1;
 };
 return {persist,recordFailure,requireEvidence,finalize};
}

async function databaseWorker(){
 const {database,setup}=await import('./helpers/tcg-i3-magic-fixture.mjs');
 let db;
 try{
  db=await database(true);
  await setup(db);
  // Operator-specific bounded timeouts for the full-size disposable import.
  // No schema, function, policy or fixture change; M4 retains its own limits.
  await db.client.query("set statement_timeout='30min';set idle_in_transaction_session_timeout='2min'");
  parentPort.postMessage({ready:true,name:db.name,version:db.version});
  parentPort.on('message',async message=>{
   try{
    if(message.op==='close'){
     await db.close();db=null;
     const boundary=globalThis[Symbol.for('DUELVANTA_M4_FORBIDDEN_IO')];
     parentPort.postMessage({id:message.id,value:{database_dropped:true,forbidden_io_attempts:boundary.attempts,local_pg_connections:boundary.local_pg_connections}});
     parentPort.close();
    }else if(message.op==='query'){
     const result=await db.client.query(message.sql,message.params);
     parentPort.postMessage({id:message.id,value:{rows:result.rows,rowCount:result.rowCount,command:result.command}});
    }else throw Error('M5 acceptance: db_bridge_operation');
   }catch(error){parentPort.postMessage({id:message.id,error:safeError(error)});}
  });
 }catch(error){
  const failure=safeError(error);
  try{if(db)await db.close();}catch{failure.cleanup_failed=true;}
  parentPort.postMessage({fatal:failure});parentPort.close();
 }
}

async function nativeDatabase(){
 const worker=new Worker(new URL(import.meta.url),{workerData:{mode:'disposable-pg17'},env:{...process.env,F3_NATIVE_PG:'1'}});
 const pending=new Map();let serial=0;
 const exited=new Promise((resolveExit,rejectExit)=>worker.once('exit',code=>code===0?resolveExit():rejectExit(Error('M5 acceptance: db_worker_exit'))));
 // Attach a rejection handler immediately; main still awaits the same promise.
 exited.catch(()=>{});
 const ready=new Promise((resolveReady,rejectReady)=>{
  worker.on('error',error=>{const e=diagnosticBridgeError(error);rejectReady(e);for(const p of pending.values())p.reject(e);pending.clear();});
  worker.on('exit',()=>{for(const p of pending.values())p.reject(Error('M5 acceptance: db_worker_exit'));pending.clear();});
  worker.on('message',message=>{
   if(message.ready)return resolveReady(message);
   if(message.fatal){rejectReady(diagnosticBridgeError(message.fatal));return;}
   const task=pending.get(message.id);if(!task)return;pending.delete(message.id);
   if(message.error)task.reject(diagnosticBridgeError(message.error));else task.resolve(message.value);
  });
 });
 const rpc=message=>new Promise((resolveCall,rejectCall)=>{const id=++serial;pending.set(id,{resolve:resolveCall,reject:rejectCall});worker.postMessage({...message,id});});
 const info=await ready;
 return {...info,client:{query:(sql,params=[])=>rpc({op:'query',sql,params})},close:async()=>{const proof=await rpc({op:'close'});await exited;return proof;}};
}

export function compactEnvelope(envelope){
 if(!envelope)return null;
 const m=envelope.manifest;
 return {contract:envelope.contract,version:envelope.version,attempt:envelope.attempt,
  manifest:{id:m.id,type:m.type,updated_at:m.updated_at},bulk_url:envelope.bulk_url,
  compressed_size:envelope.compressed_size,decompressed_size:envelope.decompressed_size,
  compressed_sha256:envelope.compressed_sha256,jsonl_sha256:envelope.jsonl_sha256,
  sets_response_sha256:envelope.sets_response_sha256,manifest_sha256:envelope.manifest_sha256,
  manifest_raw_sha256:envelope.manifest_raw_sha256,sets_framing:envelope.sets_framing,
  set_page_count:envelope.pages.length,pages:envelope.pages.map(({order,url,bytes,raw_sha256})=>({order,url,bytes,raw_sha256})),
  record_count:envelope.record_count,started_at:envelope.started_at,completed_at:envelope.completed_at,
  metadata_acquired_at:envelope.metadata_acquired_at,cache_hit:envelope.cache_hit};
}

async function foundationProof(client){
 const rows=(await client.query(`select r.state,r.schema_phase,r.snapshot_id,r.release_generation::text,
 r.source_terms_review_ref,r.attribution_review_ref,r.activation_contract,r.scope_sha256,r.descriptor_sha256,
 g.available,g.collection_ready,g.marketplace_ready,
 (public.get_security_schema_readiness_v1()->>'compatible')::boolean security_compatible,
 (public.get_market_legal_schema_readiness_v1()->>'compatible')::boolean legal_compatible,
 (select count(*)::text from dv_collect_private.tcg_catalog_snapshots) snapshot_count
 from dv_collect_private.tcg_catalog_releases r join dv_collect_private.tcg_games g using(game_key)
 where (r.game_key,r.provider_key,r.provider_version)=('magic','scryfall','1')`)).rows;
 check(rows.length===1,'release_cardinality');const r=rows[0];
 check(r.state==='foundation'&&r.schema_phase==='persistence','foundation_state');
 check(r.available===false&&r.collection_ready===false&&r.marketplace_ready===false,'product_flags');
 check(r.source_terms_review_ref===null&&r.attribution_review_ref===null,'reviews_must_remain_open');
 check(r.security_compatible===true&&r.legal_compatible===true,'readiness');
 return r;
}

export async function verifyPublication(client,result,envelope,before){
 const release=await foundationProof(client);
 check(result.reused===false&&result.expected_generation===before.release_generation,'generation_binding');
 check(release.snapshot_id===result.snapshot_id&&release.snapshot_count==='1','single_snapshot');
 check(BigInt(release.release_generation)===BigInt(before.release_generation)+1n,'generation_increment');
 const snapshots=(await client.query(`select id,game_key,provider_key,provider_version,bulk_id,bulk_type,bulk_updated_at,
 download_uri,format,compressed_size::text,compressed_sha256,jsonl_sha256,sets_response_sha256,manifest_sha256,
 scope_contract,scope_sha256,record_count::text,accepted_sets::text,accepted_cards::text,accepted_variants::text,
 retrieved_at,sealed_at from dv_collect_private.tcg_catalog_snapshots where id=$1`,[result.snapshot_id])).rows;
 check(snapshots.length===1,'snapshot_cardinality');const snapshot=snapshots[0];
 check(snapshot.game_key==='magic'&&snapshot.provider_key==='scryfall'&&snapshot.provider_version==='1'&&snapshot.format==='gzip_jsonl'&&snapshot.bulk_type==='all_cards','snapshot_binding');
 check(snapshot.sealed_at!==null&&Number.isFinite(new Date(snapshot.sealed_at).valueOf()),'snapshot_sealed');
 check(snapshot.download_uri===envelope.bulk_url&&snapshot.bulk_id===envelope.manifest.id&&new Date(snapshot.bulk_updated_at).valueOf()===Date.parse(envelope.manifest.updated_at),'manifest_binding');
 check(Number(snapshot.compressed_size)===envelope.compressed_size,'compressed_size');
 for(const key of ['compressed_sha256','jsonl_sha256','sets_response_sha256','manifest_sha256'])check(snapshot[key]===envelope[key],'snapshot_digest');
 for(const key of ['record_count','accepted_sets','accepted_cards','accepted_variants'])check(Number(snapshot[key])===result.counts[key],'accepted_counts');
 check(Number(snapshot.accepted_cards)>0&&Number(snapshot.accepted_sets)>0,'nonempty_catalog');
 check(snapshot.scope_sha256===release.scope_sha256&&snapshot.scope_contract===release.activation_contract,'scope_binding');
 const membership=(await client.query(`select p.entity_kind,count(*)::text n,
 bool_and(e.record_version=p.record_version and e.provider_ref_id=p.id) evidence_bound,
 bool_and(case when p.entity_kind='variant' then m.derivation_id is not null else m.derivation_id is null end) derivation_bound,
 bool_and(case when p.entity_kind='set' then m.source_path=any($2::text[]) else m.source_path=$3 end) provenance_bound
 from dv_collect_private.tcg_catalog_snapshot_members m join dv_collect_private.tcg_provider_refs p on p.id=m.provider_ref_id
 join dv_collect_private.tcg_provider_evidence e on e.id=m.evidence_id
 where m.snapshot_id=$1 group by p.entity_kind order by p.entity_kind`,[result.snapshot_id,envelope.pages.map(p=>p.url),envelope.bulk_url])).rows;
 for(const [kind,key] of [['set','accepted_sets'],['card','accepted_cards'],['variant','accepted_variants']]){
  const row=membership.find(r=>r.entity_kind===kind);check(Number(row?.n??0)===result.counts[key],'membership_counts');
  if(row)check(row.evidence_bound&&row.derivation_bound&&row.provenance_bound,'membership_integrity');
 }
 check(membership.every(r=>['set','card','variant'].includes(r.entity_kind)),'no_sealed_membership');
 const integrity=(await client.query(`select
 (select count(*)::text from dv_collect_private.tcg_sets where game_key='magic') sets,
 (select count(*)::text from dv_collect_private.tcg_cards where game_key='magic') cards,
 (select count(*)::text from dv_collect_private.tcg_card_variants where game_key='magic') variants,
 not exists(select 1 from dv_collect_private.tcg_provider_refs where game_key='magic' group by entity_kind,coalesce(set_id,card_id,variant_id) having count(*)>1) unique_canonical_targets,
 not exists(select 1 from dv_collect_private.tcg_provider_refs where game_key='magic' and coalesce(set_id,card_id,variant_id)::text=external_id) independent_canonical_ids,
 not exists(select 1 from dv_collect_private.tcg_card_variants where game_key='magic' and (finish not in ('nonfoil','foil','etched') or artwork not in ('normal','alternate_art') or treatment not in ('normal','borderless','extended_art','showcase','retro_frame','prerelease_stamp') or edition is not null)) closed_variant_scope,
 (select count(*)::text from pg_attribute where attrelid in ('dv_collect_private.tcg_cards'::regclass,'dv_collect_private.tcg_card_variants'::regclass) and not attisdropped and attname ~ '(image|price)') image_price_columns,
 (select count(*)::text from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='dv_collect_private' and c.relkind in ('r','p') and c.relname ~ '(magic.*raw|raw.*magic)') magic_raw_tables`)).rows[0];
 check(integrity.sets===snapshot.accepted_sets&&integrity.cards===snapshot.accepted_cards&&integrity.variants===snapshot.accepted_variants,'complete_canonical_counts');
 check(integrity.unique_canonical_targets&&integrity.independent_canonical_ids&&integrity.closed_variant_scope,'canonical_integrity');
 check(integrity.image_price_columns==='0'&&integrity.magic_raw_tables==='0','no_raw_image_price_projection');
 return {release,snapshot,membership,integrity};
}

async function acquisitionAttempt(tempDir){
 let attempt=1;const root=join(tempDir,'dv-scryfall-source-v1');
 for(const name of await readdir(root))if(/^acq-[0-9a-f-]{36}$/.test(name)){
  const receipt=JSON.parse(await readFile(join(root,name,'retention.json'),'utf8'));
  if(Number.isInteger(receipt.attempt))attempt=Math.max(attempt,receipt.attempt);
 }
 return attempt;
}

export async function main(){
 check(process.argv.includes('--real')&&process.env.DUELVANTA_M5_REAL_SOURCE_ACCEPTANCE==='1','explicit_real_authorization_required');
 check(process.env.GITHUB_ACTIONS==='true'&&process.env.GITHUB_EVENT_NAME==='pull_request'&&process.env.GITHUB_RUN_ATTEMPT==='1','one_time_pr_environment');
 check(process.env.PGHOST==='127.0.0.1'&&process.env.PGUSER==='postgres'&&process.env.PGDATABASE==='postgres','disposable_database_environment');
 const runnerRoot=await realpath(process.env.RUNNER_TEMP??'');
 check(isAbsolute(process.env.RUNNER_TEMP??'')&&runnerRoot===resolve(process.env.RUNNER_TEMP),'runner_temp');
 const evidence=resolve('test-results/tcg-i3-m5-real');await mkdir(evidence,{recursive:true});
 const ledger={contract:'TCG-I3-M5-real-source-acceptance',version:'1',status:'RUNNING',operator_invocations:0,
  real_source_acceptance:false,i18_status:'NOT_RUN',i19_status:'REAL_SOURCE_NOT_RUN',
  SOURCE_TERMS_REVIEW:'OPEN',ATTRIBUTION_READY:'OPEN',IMAGE_USE_REVIEW:'OPEN',magic_status:'planned/unavailable',production_activation:false,production_staging_mutation:false,merge:false};
 const foundationEvidence={before:null,after:null,after_failure:null};
 const gate=requiredEvidenceGate(ledger),persist=gate.persist;
 const requests=[];let db,tempDir,envelope,result,proof,firstFailure=null,originalFailure=null,productSucceeded=false,phase='disposable_database_setup';
 const diagnosticState={last_checkpoint:null,processed_count:null,last_external_id:null};let checkpointCount=0;
 await writeFile(join(evidence,'diagnostic-checkpoints.jsonl'),'',{mode:0o600});
 const onDiagnostic=event=>{
  if(event.diagnostic){if(['prepare_diagnostic','operation_failure'].includes(event.checkpoint)){originalFailure??=safeError(event.diagnostic);diagnosticState.captured=originalFailure;try{writeFileSync(join(evidence,'diagnostic-failure.json'),JSON.stringify(diagnosticFailure(originalFailure))+'\n',{mode:0o600});}catch(error){(ledger.diagnostic_errors??=[]).push(safeError(error));}}else{(ledger.secondary_diagnostics??=[]).push({checkpoint:event.checkpoint,diagnostic:safeError(event.diagnostic)});}if(event.diagnostic_error)(ledger.secondary_diagnostics??=[]).push({checkpoint:'diagnostic_failure',diagnostic:safeError(event.diagnostic_error)});return;}
  try{appendFileSync(join(evidence,'diagnostic-checkpoints.jsonl'),JSON.stringify(event)+'\n',{mode:0o600});checkpointCount++;}catch(error){(ledger.diagnostic_errors??=[]).push(safeError(error));}
  // Failure cleanup completes after the failing operation; retain its phase.
  if(event.checkpoint!=='finish_complete'){phase=event.phase;diagnosticState.last_checkpoint=event.checkpoint;}
  if(Number.isSafeInteger(event.processed_count)){diagnosticState.processed_count=event.processed_count;diagnosticState.last_external_id=event.last_external_id;}
 };
 try{
  db=await nativeDatabase();
  const version=(await db.client.query("select current_user owner,current_setting('server_version_num') server_version_num,version() version,pg_backend_pid() backend_pid,current_database() database")).rows[0];
  check(version.owner==='postgres'&&Math.floor(Number(version.server_version_num)/10000)===17&&/^tcg_m4_[0-9a-f]{32}$/.test(version.database),'pg17_owner');
  await persist(join(evidence,'pg17-version.json'),version);
  const before=await foundationProof(db.client);check(before.snapshot_count==='0'&&before.snapshot_id===null&&before.release_generation==='0','empty_disposable_foundation');
  await persist(join(evidence,'release-foundation-proof.json'),Object.assign(foundationEvidence,{before}));
  const local=JSON.parse(await readFile('test-results/tcg-i3-m5-local/m5-local-ledger.json','utf8'));
  check(local.counts.PASS===57&&local.counts.FAIL===0&&local.cases.length===57&&local.cases.every(c=>c.status==='PASS')&&local.forbidden_external_io_attempts===0&&local.source_cases.find(c=>c.id==='I18')?.status==='PASS','local_source_preflight');
  ledger.i18_status='PASS';
  gate.requireEvidence(['pg17-version.json','release-foundation-proof.json'].map(p=>join(evidence,p)));
  tempDir=await mkdtemp(join(runnerRoot,'duelvanta-m5-real-'));check(!relative(runnerRoot,tempDir).startsWith('..'),'temp_scope');
  const transport=async(url,options)=>{
   // Pure recorder: never reads, clones or retains response bodies/headers.
   const request={url,at:now(),attempt:await acquisitionAttempt(tempDir),request_number:requests.length+1,status:null};
   requests.push(request);await persist(join(evidence,'request-ledger.json'),requests);gate.requireEvidence([join(evidence,'request-ledger.json')]);
   console.log(JSON.stringify({event:'REAL_SCRYFALL_REQUEST_STARTED',...request}));
   try{const response=await globalThis.fetch(url,options);request.status=response.status;return response;}
   finally{await persist(join(evidence,'request-ledger.json'),requests);}
  };
  const actualSource=createScryfallSource({transport});
  const source={acquire:async options=>{const acquisition=await actualSource.acquire(options);envelope=acquisition.envelope;await persist(join(evidence,'acquisition-digests.json'),compactEnvelope(envelope));return acquisition;}};
  phase='real_source_acquisition_and_publication';
  await persist(join(evidence,'m5-real-source-ledger.json'),ledger);
  gate.requireEvidence([join(evidence,'m5-real-source-ledger.json')]);
  // Exactly ONE operator-level call. Frozen worker owns its internal retries.
  ledger.operator_invocations++;
  result=await runRealSourceAcceptance({source,tempDir,client:db.client,onDiagnostic});
  phase='post_publication_verification';proof=await verifyPublication(db.client,result,envelope,before);
  await persist(join(evidence,'snapshot-result.json'),{snapshot_id:result.snapshot_id,reused:result.reused,expected_generation:result.expected_generation,counts:result.counts,...proof});
  await persist(join(evidence,'release-foundation-proof.json'),Object.assign(foundationEvidence,{after:proof.release}));
  productSucceeded=true;
 }catch(error){
  if(error.evidenceFailure&&!originalFailure)ledger.acceptance_error=safeError(error,{phase});
  else{originalFailure??=safeError(error,{phase,...diagnosticState});firstFailure=originalFailure;}
  try{await persist(join(evidence,'diagnostic-failure.json'),diagnosticFailure(firstFailure));}catch(diagnosticError){ledger.diagnostic_error=safeError(diagnosticError);}
  ledger.i19_status=requests.length?'FAIL':'REAL_SOURCE_NOT_RUN';ledger.failure=firstFailure;
  if(db){try{await persist(join(evidence,'release-foundation-proof.json'),Object.assign(foundationEvidence,{after_failure:await foundationProof(db.client)}));}catch(proofError){ledger.failure_proof_error=safeError(proofError);}}
 }finally{
  const cleanup={raw_temp_created:!!tempDir,raw_temp_removed:false,disposable_database_dropped:false,raw_provider_files_uploaded:false};
  try{
   await persist(join(evidence,'request-ledger.json'),requests);
   await persist(join(evidence,'acquisition-digests.json'),compactEnvelope(envelope));
   if(!proof)await persist(join(evidence,'snapshot-result.json'),{published:!!result,snapshot_id:result?.snapshot_id??null,verified:false,failure:firstFailure});
   if(tempDir){check(relative(runnerRoot,tempDir).startsWith('duelvanta-m5-real-')&&!isAbsolute(relative(runnerRoot,tempDir)),'cleanup_scope');await rm(tempDir,{recursive:true});
    try{await lstat(tempDir);throw Error('M5 acceptance: cleanup_incomplete');}catch(error){if(error.code!=='ENOENT')throw error;}cleanup.raw_temp_removed=true;}
  }catch(error){ledger.cleanup_error=safeError(error,{phase:'raw_cleanup',...diagnosticState});}
  try{if(db){const nativeCleanup=await db.close();check(nativeCleanup.database_dropped&&nativeCleanup.forbidden_io_attempts.length===0,'native_database_cleanup');cleanup.disposable_database_dropped=true;cleanup.native_io=nativeCleanup;}}
  catch(error){ledger.database_cleanup_error=safeError(error,{phase:'database_cleanup',...diagnosticState});}
  await persist(join(evidence,'cleanup-proof.json'),cleanup);
  ledger.request_count=requests.length;ledger.completed_at=now();ledger.cleanup=cleanup;
  ledger.source_cases=[{id:'I18',status:ledger.i18_status},{id:'I19',status:ledger.i19_status}];
  ledger.source_cases_pass=ledger.source_cases.filter(c=>c.status==='PASS').length;
  ledger.activation=['O23','G07','G08','G09','G10','G11','G13'].map(id=>({id,status:'SPECIFIED_NOT_RUN'}));
  ledger.activation_cases_pass=ledger.activation.filter(c=>c.status==='PASS').length;
  // Diagnostics supplement the original acceptance ledger; no activation.
  await persist(join(evidence,'diagnostic-failure.json'),firstFailure?diagnosticFailure(firstFailure,{phase:firstFailure.phase,...diagnosticState}):null);
  const rootCauseCaptured=firstFailure?.exact_predicate_captured===true;
  await persist(join(evidence,'diagnostic-summary.json'),{status:firstFailure?(rootCauseCaptured?'M5_P1_R2_ROOT_CAUSE_CAPTURED':'STOP_DIAGNOSTIC_EVIDENCE_INSUFFICIENT'):'FINAL_ACCEPTANCE_PENDING',root_cause_captured:rootCauseCaptured,error_location_captured:firstFailure?.error_location_captured??false,error_class_captured:firstFailure?.error_class_captured??false,exact_predicate_captured:rootCauseCaptured,checkpoint_count:checkpointCount,operator_invocations:ledger.operator_invocations,request_count:requests.length,failure:firstFailure,magic_status:ledger.magic_status,SOURCE_TERMS_REVIEW:'OPEN',ATTRIBUTION_READY:'OPEN',IMAGE_USE_REVIEW:'OPEN'});
  // Sync checkpoint errors are required-evidence failures as well.
  if(ledger.diagnostic_errors?.length)gate.recordFailure(new Error('M5 acceptance: required_evidence_missing'));
  process.exitCode=await gate.finalize({path:join(evidence,'m5-real-source-ledger.json'),required:['pg17-version.json','release-foundation-proof.json','request-ledger.json','acquisition-digests.json','snapshot-result.json','cleanup-proof.json','diagnostic-failure.json','diagnostic-summary.json'].map(p=>join(evidence,p)),productFailure:firstFailure,productSucceeded,cleanupSucceeded:!ledger.cleanup_error&&!ledger.database_cleanup_error&&cleanup.raw_temp_removed&&cleanup.disposable_database_dropped,requestCount:requests.length,emit:value=>console.log(JSON.stringify(value))});
 }
}

if(!isMainThread&&workerData?.mode==='disposable-pg17')await databaseWorker();
else if(isMainThread&&process.argv[1]&&resolve(process.argv[1])===self){
 try{await main();}catch(error){console.error(JSON.stringify(safeError(error)));process.exitCode=1;}
}
