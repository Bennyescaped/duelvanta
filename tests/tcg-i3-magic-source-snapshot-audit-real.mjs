// One hosted acquisition -> frozen offline audit. Import-inert; never a publisher.
import {mkdtemp,mkdir,writeFile,readFile,rename,rm,lstat,realpath,readdir,statfs} from 'node:fs/promises';
import {join,resolve,dirname,basename,isAbsolute,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire,syncBuiltinESMExports} from 'node:module';
import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {freemem,totalmem} from 'node:os';
import {createScryfallSource,validateSourceURL,LIMITS,SETS_FRAMING} from '../tcg-catalog-scryfall-source-v1.mjs';
import {validateManifest} from '../tcg-catalog-persistence-v1.mjs';
import {canonicalJSON,sha256} from '../tcg-catalog-evidence-v1.mjs';
import {auditSnapshot} from './tcg-i3-magic-source-snapshot-audit.mjs';
import {safeError} from '../tcg-catalog-diagnostics-v1.mjs';

export const AUTHORIZED_PARENT='2db97d986c598b36f6f3e03deb562ade07a5882c';
export const AUTHORIZATION='P4_P2_ONE_ACQUISITION_DIAGNOSTIC_ONLY';
export const MIN_FREE_BYTES=12*1024**3;
const repo=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const now=()=>new Date().toISOString();
const fail=code=>{throw new Error('M5 acceptance: '+code);};
const check=(ok,code)=>{if(!ok)fail(code);};
const digest=v=>typeof v==='string'&&/^[0-9a-f]{64}$/.test(v)?v:null;
const integer=v=>Number.isSafeInteger(v)&&v>=0?v:null;
// Reuse the manifest's existing UTC contract, preserving its accepted bytes.
const timestamp=(v,m)=>validateManifest({...m,updated_at:v}).updated_at;
const counts=(v,keys)=>Object.fromEntries(keys.map(k=>[k,integer(v?.[k])]));
const bool=v=>v===true;
const kinds=new Set(['record_error','identity_conflict','reference_variant_error','unused_set','global_failure']);
const enumValue=(v,allowed)=>allowed.includes(v)?v:null;

export function validateAuthorization(a){
 check(a?.authorization===AUTHORIZATION&&a.real_audit===true,'explicit_real_authorization_required');
 check(a.actions===true&&a.event==='pull_request'&&a.repository==='Bennyescaped/duelvanta'&&a.head_repository===a.repository&&a.pr===6&&a.branch==='tcg-registry-v1'&&a.attempt===1&&/^\d+$/.test(a.run_id??'')&&/^\d+$/.test(a.run_number??''),'one_time_pr_environment');
 check(/^[0-9a-f]{40}$/.test(a.head??'')&&a.head===a.pr_head&&Array.isArray(a.parents)&&a.parents.length===1&&a.parents[0]===AUTHORIZED_PARENT,'generation_binding');
 return {authorization:AUTHORIZATION,real_audit:true,actions:true,event:a.event,repository:a.repository,head_repository:a.head_repository,pr:6,branch:a.branch,attempt:1,run_id:a.run_id,run_number:a.run_number,head:a.head,pr_head:a.pr_head,parents:[AUTHORIZED_PARENT]};
}

export async function atomicEvidence(path,value){
 const temporary=path+'.'+randomUUID()+'.tmp';
 try{await writeFile(temporary,JSON.stringify(value,null,2)+'\n',{flag:'wx',mode:0o600});await rename(temporary,path);}
 finally{await rm(temporary,{force:true});}
}
export async function resources(path){const s=await statfs(path);return {at:now(),free_bytes:s.bavail*s.bsize,free_inodes:s.ffree,total_memory_bytes:totalmem(),free_memory_bytes:freemem(),rss_bytes:process.memoryUsage().rss,minimum_free_bytes:MIN_FREE_BYTES};}

// Network lockdown is active for the entire audit, including callbacks. No DB
// sockets, subprocess transports, workers or detached publishers can be started.
export function lockAuditIO(){
 const require=createRequire(import.meta.url),originals=[];let attempts=0;
 function blocked(){attempts++;throw new Error('M5 acceptance: scope_binding');}
 const set=(o,k)=>{originals.push([o,k,o[k]]);o[k]=blocked;};
 for(const k of ['fetch','WebSocket','XMLHttpRequest'])set(globalThis,k);
 for(const [m,keys] of Object.entries({'node:http':['get','request'],'node:https':['get','request'],'node:net':['connect','createConnection'],'node:tls':['connect'],'node:dgram':['createSocket'],'node:child_process':['spawn','spawnSync','exec','execSync','execFile','execFileSync','fork'],'node:worker_threads':['Worker']}))for(const k of keys)set(require(m),k);
 set(require('node:net').Socket.prototype,'connect');
 const dns=require('node:dns');for(const o of [dns,dns.promises,dns.Resolver.prototype,dns.promises.Resolver.prototype])for(const k of Object.getOwnPropertyNames(o))if(/^(?:lookup|resolve|reverse)/.test(k)&&typeof o[k]==='function')set(o,k);
 syncBuiltinESMExports();
 return {attempts:()=>attempts,restore(){for(const [o,k,v] of originals)o[k]=v;syncBuiltinESMExports();}};
}

function safeURL(value){
 try{const kind=value==='https://api.scryfall.com/bulk-data'?'manifest':value?.startsWith('https://data.scryfall.io/')?'bulk':'sets';return validateSourceURL(value,kind);}catch{return null;}
}
export function compactEnvelope(e){
 if(!e)return null;
 const m=validateManifest(e.manifest);
 check(e.contract==='ScryfallAcquisitionEnvelope'&&e.version==='1'&&e.origin==='bulk_snapshot','required_evidence_missing');
 const proof={contract:e.contract,version:e.version,origin:e.origin,attempt:integer(e.attempt),cache_hit:bool(e.cache_hit),metadata_acquired_at:timestamp(e.metadata_acquired_at,m),started_at:timestamp(e.started_at,m),completed_at:timestamp(e.completed_at,m),source_time:m.updated_at,manifest_url:validateSourceURL(e.manifest_url,'manifest'),bulk_url:validateSourceURL(e.bulk_url,'bulk'),
  ...counts(e,['record_count','compressed_size','decompressed_size']),...Object.fromEntries(['compressed_sha256','jsonl_sha256','sets_response_sha256','manifest_sha256','manifest_raw_sha256'].map(k=>[k,digest(e[k])])),
  sets_framing:e.sets_framing===SETS_FRAMING?e.sets_framing:null,pages:Array.isArray(e.pages)?Array.from(e.pages,p=>({order:integer(p?.order),url:validateSourceURL(p?.url,'sets'),bytes:integer(p?.bytes),raw_sha256:digest(p?.raw_sha256)})):[],raw_files_included:false};
 check(Date.parse(proof.metadata_acquired_at)<=Date.parse(proof.started_at)&&Date.parse(proof.started_at)<=Date.parse(proof.completed_at),'required_evidence_missing');
 check(proof.attempt>0&&typeof e.cache_hit==='boolean'&&proof.bulk_url===m.jsonl_download_uri&&proof.compressed_size===m.compressed_size,'required_evidence_missing');
 check(proof.record_count>0&&proof.record_count<=LIMITS.lines&&proof.decompressed_size>0&&proof.decompressed_size<=LIMITS.decompressed,'required_evidence_missing');
 check(['compressed_sha256','jsonl_sha256','sets_response_sha256','manifest_sha256','manifest_raw_sha256'].every(k=>proof[k]!==null)&&proof.manifest_sha256===sha256(Buffer.from(canonicalJSON(m,LIMITS.manifest))),'required_evidence_missing');
 check(proof.sets_framing!==null&&proof.pages.length>0&&proof.pages[0].url==='https://api.scryfall.com/sets'&&new Set(proof.pages.map(p=>p.url)).size===proof.pages.length&&proof.pages.every((p,i)=>p.order===i+1&&p.bytes>0&&p.raw_sha256!==null)&&proof.pages.reduce((n,p)=>n+p.bytes,0)<=LIMITS.sets,'required_evidence_missing');
 return proof;
}
function classKey(key){
 const [kind,family,code,site,...extra]=key.split('|'),d=safeError({contract_family:family,contract_code:code,stack_location:site});
 check(!extra.length&&kinds.has(kind)&&(family==='UNKNOWN'||d.contract_family===family)&&(code==='UNKNOWN'||d.contract_code===code)&&(site==='UNKNOWN'||d.stack_location===site),'scope_binding');return key;
}
function bindings(input){if(!input)return null;const out={};for(const [k,v] of Object.entries(input)){check(/^(?:gzip|jsonl|manifest|set_page_[1-9][0-9]*)$/.test(k),'scope_binding');out[k]={bytes:integer(v.bytes),sha256:digest(v.sha256)};}return out;}
function example(x){return {class_key:classKey(x.class_key),kind:enumValue(x.kind,[...kinds]),...safeError(x)};}
// Explicit safe export schema: never serialize the envelope's file paths, raw
// manifest/records or arbitrary exception/message fields, even with injections.
export function projectAudit(r){
 const abort=r.abort?{...safeError(r.abort),failure_context:enumValue(r.abort.failure_context,['DELIVERED_RECORD','STREAM_OR_GLOBAL']),last_processed_record:r.abort.last_processed_record?safeError(r.abort.last_processed_record):null,next_record_ordinal:integer(r.abort.next_record_ordinal)}:null;
 return {contract:'TCGSourceSnapshotDiagnosticAudit',version:'1',diagnostic_only:true,status:enumValue(r.status,['COMPLETE_COMPATIBLE','COMPLETE_REJECTED','INCOMPLETE']),audit_complete:bool(r.audit_complete),snapshot_compatible:bool(r.snapshot_compatible),
  first_pass:{...counts(r.first_pass,['records_observed','candidates','excluded','identical_duplicates','identity_conflicts','record_errors','unclassified','expected_records']),excluded_by_reason:Object.fromEntries(Object.entries(r.first_pass?.excluded_by_reason??{}).map(([k,v])=>{check(['digital','oversized','not_paper','language','layout','unresolved_missing_printed_name','unresolved_face_count_outside_initial_scope'].includes(k),'scope_binding');return [k,integer(v)];})),eof:bool(r.first_pass?.eof),balanced:bool(r.first_pass?.balanced)},
  second_pass:{...counts(r.second_pass,['records_examined','validated_records','variants','reference_variant_errors','uncheckable_dependencies','without_reference']),complete:bool(r.second_pass?.complete)},
  sets:{...counts(r.sets,['used','unused','unused_translation_errors']),unused_metadata_preparation:'NOT_APPLICABLE_TO_IMPORT'},
  error_classes:Object.fromEntries(Object.entries(r.error_classes??{}).map(([k,v])=>[classKey(k),integer(v)])),examples:(r.examples??[]).map(example),representative_limit:integer(r.representative_limit),examples_omitted:integer(r.examples_omitted),
  example_coverage:{...counts(r.example_coverage,['classes_observed','classes_represented','classes_without_example','fixed_maximum']),complete:bool(r.example_coverage?.complete),selection:'FIRST_OCCURRENCE_PER_CLASS_AND_CALLSITE'},
  secondary_diagnostics:(r.secondary_diagnostics??[]).map(d=>safeError(d)),secondary_diagnostic_count:integer(r.secondary_diagnostic_count),input_bindings:{before:bindings(r.input_bindings?.before),after:bindings(r.input_bindings?.after),unchanged:bool(r.input_bindings?.unchanged)},abort,
  cleanup:{audit_index_created:bool(r.cleanup?.audit_index_created),audit_index_removed:bool(r.cleanup?.audit_index_removed),input_files_deleted:bool(r.cleanup?.input_files_deleted)},
  ...counts(r,['provider_requests','live_invocations','database_publications']),
  coverage:{first_failure_per_record:true,all_predicates_per_record:false,later_predicates_hidden_by_first_failure:true,reference_coverage:enumValue(r.coverage?.reference_coverage,['NOT_RUN','LIMITED_REJECTED_DEPENDENCIES','COMPLETE_FOR_DIAGNOSTIC_CANDIDATES']),unused_set_diagnostics_affect_import:false},
  reproduction:{kind:'SANITIZED_DIGEST_BOUND_EXAMPLES',raw_records_included:false,historical_raw_equality_claimed:false}};
}

async function attemptReceipts(root){
 const out=[];if(!root)return out;
 try{for(const name of (await readdir(join(root,'dv-scryfall-source-v1'))).sort())if(/^acq-[0-9a-f-]{36}$/.test(name)){
  const dir=join(root,'dv-scryfall-source-v1',name),s=await lstat(dir);check(s.isDirectory()&&!s.isSymbolicLink(),'cleanup_scope');
  const read=async file=>{try{return JSON.parse(await readFile(join(dir,file),'utf8'));}catch(e){if(e.code==='ENOENT')return null;throw e;}};
  const r=await read('retention.json'),error=await read('reject-report.json');
  out.push({attempt:integer(error?.attempt??r?.attempt),state:enumValue(r?.state,['acquiring','acquired','aborted']),started_at:integer(r?.started_at),failure:error?safeError(new TypeError('TCG source: '+error.code)):null});
 }}catch(e){if(e.code!=='ENOENT')throw e;}return out;
}
async function absent(path){try{await lstat(path);return false;}catch(e){if(e.code==='ENOENT')return true;throw e;}}

export async function runSnapshotAudit({authorization,outputDir,tempParent,sourceFactory=createScryfallSource,audit=auditSnapshot,writer=atomicEvidence,remove=rm,transport=(...args)=>globalThis.fetch(...args),resourceProbe=resources,preflight=null}={}){
 const ledger={contract:'TCG-I3-M5-P1-R5-R1-P2',version:'1',started_at:now(),status:'RUNNING',diagnostic_completion_pass:false,snapshot_status:'INCOMPLETE',snapshot_compatible:false,audit_complete:false,
  audit_acquisition_invocations_this_block:0,full_snapshot_audit_invocations_this_block:0,I19_operator_invocations_this_block:0,I19_operator_invocations_historical:5,audit_database_publications:0,provider_requests:0,audit_forbidden_io_attempts:0,
  first_failure:null,diagnostic_errors:[],cleanup_errors:[],required_evidence_complete:false,required_evidence_content_complete:false,magic_status:'planned/unavailable',I19:'FAIL / LIVE_REACCEPTANCE_PENDING',review_gates:'OPEN',activation:false};
 let output=null,ownRoot=null,ownedIdentity=null,acquisition=null,envelope=null,report=null,phase='authorization',evidenceFailed=false;
 const requests=[],written=new Set(),cleanup={finish_called:false,published:false,own_temp_created:false,own_temp_removed:false,audit_index_removed:null,foreign_resources_removed:false};
 const persist=async(name,value)=>{try{check(output!==null,'required_evidence_missing');await writer(join(output,name),value);written.add(name);return true;}catch(e){evidenceFailed=true;ledger.diagnostic_errors.push({evidence:name,error:safeError(e,{phase:'audit_output'})});return false;}};
 const must=async(name,value)=>{if(!await persist(name,value))fail('required_evidence_missing');};
 const acquisitionProof=async()=>{
  try{const value=compactEnvelope(envelope);check(value!==null,'required_evidence_missing');ledger.required_evidence_content_complete=true;return await persist('acquisition-digests.json',value);}
  catch(e){evidenceFailed=true;ledger.required_evidence_content_complete=false;ledger.diagnostic_errors.push({evidence:'acquisition-digests.json',kind:'REQUIRED_CONTENT_INVALID',error:safeError(e,{phase:'audit_output'})});return false;}
 };
 const first=e=>{ledger.first_failure??={stage:phase,error:safeError(e,{phase:phase==='audit'?'audit_cards':phase==='cleanup'?'raw_cleanup':'unknown'})};};
 try{
  ledger.binding=validateAuthorization(authorization);
  phase='output_preflight';check(typeof outputDir==='string'&&isAbsolute(outputDir)&&typeof tempParent==='string'&&isAbsolute(tempParent),'temp_scope');
  const parent=await realpath(dirname(outputDir)),temporary=await realpath(tempParent);
  check(parent===dirname(outputDir)&&temporary===resolve(tempParent)&&!outputDir.startsWith(temporary+'/'),'temp_scope');
  check(await absent(outputDir),'required_evidence_missing');await mkdir(outputDir,{mode:0o700});output=outputDir;
  await must('start-proof.json',{at:ledger.started_at,binding:ledger.binding,diagnostic_only:true,acquisition_budget:1,audit_budget:1,published:false,limits:LIMITS});
  await must('versions.json',{node:process.version,platform:process.platform,arch:process.arch});
  const before=await resourceProbe(temporary);await must('resources-before.json',before);check(before.free_bytes>=MIN_FREE_BYTES,'temp_scope');
  if(preflight)await preflight();
  await must('request-ledger.json',{provider_requests:0,requests:[]});await must('runner-ledger.json',ledger);
  phase='acquisition';ownRoot=await mkdtemp(join(temporary,'duelvanta-p2-audit-'));ownedIdentity=await lstat(ownRoot);cleanup.own_temp_created=true;
  const recordTransport=async(url,options)=>{
   check(!evidenceFailed&&ledger.full_snapshot_audit_invocations_this_block===0,'required_evidence_missing');check(safeURL(url)!==null,'scope_binding');
   const receipts=await attemptReceipts(ownRoot),attempt=Math.max(1,...receipts.map(x=>x.attempt??0));
   const entry={request_number:requests.length+1,acquisition_attempt:attempt,url:safeURL(url),started_at:now(),completed_at:null,attempted:false,status:null,error:null};requests.push(entry);
   await must('request-ledger.json',{provider_requests:ledger.provider_requests,requests});
   entry.attempted=true;ledger.provider_requests++;
   try{const response=await transport(url,options);entry.status=integer(response.status);return response;}
   catch(e){entry.error=safeError(e);throw e;}
   finally{entry.completed_at=now();await must('request-ledger.json',{provider_requests:ledger.provider_requests,requests});}
  };
  const source=sourceFactory({transport:recordTransport});
  await must('invocation-proof.json',{at:now(),acquire_authorized_maximum:1,audit_invocations:0,binding:ledger.binding});
  ledger.audit_acquisition_invocations_this_block++;acquisition=await source.acquire({tempDir:ownRoot});envelope=acquisition.envelope;
  phase='acquisition_evidence';if(!await acquisitionProof())fail('required_evidence_missing');
  await must('acquisition-attempts.json',await attemptReceipts(ownRoot));
  await must('resources-before-audit.json',await resourceProbe(temporary));
  phase='audit';const guard=lockAuditIO();
  try{await must('audit-start.json',{at:now(),audit_authorized_maximum:1,acquire_invocations:1,network_locked:true});ledger.full_snapshot_audit_invocations_this_block++;report=projectAudit(await audit(envelope));}
  finally{ledger.audit_forbidden_io_attempts=guard.attempts();guard.restore();}
  ledger.audit_complete=report.audit_complete;ledger.snapshot_compatible=report.snapshot_compatible;ledger.snapshot_status=report.status;cleanup.audit_index_removed=report.cleanup.audit_index_removed;
  await must('audit-report.json',report);
  await must('error-classes.json',{classes:report.error_classes,examples:report.examples,examples_omitted:report.examples_omitted,example_coverage:report.example_coverage});
  await must('reproduction.json',{...report.reproduction,input_bindings:report.input_bindings,examples:report.examples,example_coverage:report.example_coverage});
  check(report.audit_complete&&report.first_pass.eof&&report.first_pass.balanced&&report.second_pass.complete&&report.input_bindings.unchanged&&report.cleanup.audit_index_removed&&!report.cleanup.input_files_deleted&&report.provider_requests===0&&report.live_invocations===0&&report.database_publications===0&&ledger.audit_forbidden_io_attempts===0,'scope_binding');
  check(report.status===(report.snapshot_compatible?'COMPLETE_COMPATIBLE':'COMPLETE_REJECTED'),'scope_binding');
 }catch(e){first(e);}
 finally{
  // All compact evidence is attempted before removing any owned raw input.
  if(output){
   await persist('request-ledger.json',{provider_requests:ledger.provider_requests,requests});
   if(envelope)await acquisitionProof();else await persist('acquisition-digests.json',null);
   try{await persist('acquisition-attempts.json',await attemptReceipts(ownRoot));}catch(e){ledger.diagnostic_errors.push({evidence:'acquisition-attempts.json',error:safeError(e)});evidenceFailed=true;}
   await persist('failure-proof.json',{first_failure:ledger.first_failure,diagnostic_errors:ledger.diagnostic_errors});
  }
  phase='cleanup';
  if(acquisition){cleanup.finish_called=true;try{await acquisition.finish({published:false});}catch(e){ledger.cleanup_errors.push({stage:'finish',error:safeError(e,{phase:'finish'})});}}
  if(ownRoot){try{
   const s=await lstat(ownRoot);check(resolve(ownRoot)===ownRoot&&dirname(ownRoot)===await realpath(tempParent)&&/^duelvanta-p2-audit-[A-Za-z0-9]+$/.test(basename(ownRoot))&&s.isDirectory()&&!s.isSymbolicLink()&&s.dev===ownedIdentity.dev&&s.ino===ownedIdentity.ino,'cleanup_scope');
   await remove(ownRoot,{recursive:true});cleanup.own_temp_removed=await absent(ownRoot);check(cleanup.own_temp_removed,'cleanup_incomplete');
  }catch(e){ledger.cleanup_errors.push({stage:'owned_raw_cleanup',error:safeError(e,{phase:'raw_cleanup'})});}}
  if(output){await persist('cleanup-proof.json',cleanup);try{await persist('resources-after.json',await resourceProbe(tempParent));}catch(e){evidenceFailed=true;ledger.diagnostic_errors.push({evidence:'resources-after.json',error:safeError(e)});}}
 }
 const required=['start-proof.json','versions.json','resources-before.json','request-ledger.json','invocation-proof.json','acquisition-digests.json','acquisition-attempts.json','resources-before-audit.json','audit-start.json','audit-report.json','error-classes.json','reproduction.json','failure-proof.json','cleanup-proof.json','resources-after.json'];
 ledger.finished_at=now();ledger.cleanup=cleanup;ledger.required_evidence_complete=!evidenceFailed&&ledger.required_evidence_content_complete&&required.every(n=>written.has(n));
 ledger.diagnostic_completion_pass=!!report?.audit_complete&&!ledger.first_failure&&ledger.cleanup_errors.length===0&&cleanup.finish_called&&cleanup.own_temp_removed&&ledger.required_evidence_complete;
 ledger.status=ledger.diagnostic_completion_pass?'DIAGNOSTIC_COMPLETE':'DIAGNOSTIC_INCOMPLETE';
 ledger.outcome_semantics='COMPLETE_REJECTED is diagnostic completion only, never catalog acceptance or I19 PASS';
 if(output){
  if(!await persist('end-proof.json',{at:ledger.finished_at,snapshot_status:ledger.snapshot_status,audit_complete:ledger.audit_complete,cleanup_complete:cleanup.own_temp_removed&&ledger.cleanup_errors.length===0,acceptance_pending_final_ledger:true})){ledger.diagnostic_completion_pass=false;ledger.required_evidence_complete=false;ledger.status='DIAGNOSTIC_INCOMPLETE';}
  if(!await persist('runner-ledger.json',ledger)){ledger.diagnostic_completion_pass=false;ledger.required_evidence_complete=false;ledger.status='FINAL_LEDGER_WRITE_FAILED';}
 }
 return {exitCode:ledger.diagnostic_completion_pass?0:1,ledger};
}

export async function hostedAuthorization(env=process.env,args=process.argv.slice(2)){
 check(args.length===1&&args[0]==='--real-audit','explicit_real_authorization_required');
 const event=JSON.parse(await readFile(env.GITHUB_EVENT_PATH,'utf8'));
 const git=(...a)=>execFileSync('git',a,{cwd:repo,encoding:'utf8'}).trim();
 const head=git('rev-parse','HEAD'),parents=git('show','-s','--format=%P','HEAD').split(' ').filter(Boolean);
 check(env.TCG_AUDIT_CURRENT_PR_HEAD===head,'generation_binding');
 return validateAuthorization({authorization:env.DUELVANTA_M5_SNAPSHOT_AUDIT,real_audit:true,actions:env.GITHUB_ACTIONS==='true',event:env.GITHUB_EVENT_NAME,repository:env.GITHUB_REPOSITORY,head_repository:event.pull_request?.head?.repo?.full_name,pr:event.number,branch:event.pull_request?.head?.ref,attempt:Number(env.GITHUB_RUN_ATTEMPT),run_id:env.GITHUB_RUN_ID,run_number:env.GITHUB_RUN_NUMBER,head,pr_head:event.pull_request?.head?.sha,parents});
}
export async function main(){
 const authorization=await hostedAuthorization();
 const preflight=async()=>{
  const read=async n=>JSON.parse(await readFile(join(repo,'test-results',n),'utf8'));
  const w=await read('tcg-i3-m5-p2-wrapper/wrapper-test-ledger.json'),a=await read('tcg-i3-m5-p2-audit31/audit-test-ledger.json');
  check(w.counts?.PASS===20&&w.counts?.FAIL===0&&w.cases?.length===20&&w.cases.every((c,i)=>c.id==='WRAP'+String(i+1).padStart(2,'0')&&c.status==='PASS')&&w.unexpected_external_io_attempts===0,'local_source_preflight');
  check(a.counts?.PASS===31&&a.counts?.FAIL===0&&a.cases?.length===31&&a.cases.every((c,i)=>c.id==='AUDIT'+String(i+1).padStart(2,'0')&&c.status==='PASS')&&a.forbidden_external_io_attempts===0,'local_source_preflight');
 };
 const result=await runSnapshotAudit({authorization,outputDir:join(repo,'test-results/tcg-i3-m5-p2-real'),tempParent:process.env.RUNNER_TEMP,preflight});
 const summary={status:result.ledger.status,diagnostic_completion_pass:result.ledger.diagnostic_completion_pass,snapshot_status:result.ledger.snapshot_status,snapshot_compatible:result.ledger.snapshot_compatible,provider_requests:result.ledger.provider_requests,acquisition_invocations:result.ledger.audit_acquisition_invocations_this_block,audit_invocations:result.ledger.full_snapshot_audit_invocations_this_block,I19:'FAIL / LIVE_REACCEPTANCE_PENDING',first_failure:result.ledger.first_failure,diagnostic_errors:result.ledger.diagnostic_errors,cleanup_errors:result.ledger.cleanup_errors};
 console.log(JSON.stringify(summary));return result.exitCode;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{process.exitCode=await main();}catch(error){console.error(JSON.stringify({status:'PREINVOCATION_FAILURE',error:safeError(error)}));process.exitCode=1;}
}
