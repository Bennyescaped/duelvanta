// P3-P1: one fixed card GET, derived from the task-only P3 diagnostic helper.
// Import-inert. No acquisition, catalog publication or admission policy.
import https from 'node:https';
import {mkdir,writeFile,readFile,realpath} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {parseProviderJSON,prepareProviderEvidence,sha256} from '../tcg-catalog-evidence-v1.mjs';
import {safeError} from '../tcg-catalog-diagnostics-v1.mjs';
import {atomicEvidence,lockAuditIO} from './tcg-i3-magic-source-snapshot-audit-real.mjs';
const require=createRequire(import.meta.url),P=require('../tcg-v1-catalog-providers.js'),C=require('../tcg-v1-contracts.js'),G=require('../tcg-v1-game-adapters.js');
export const ID='097165ee-f959-49e3-a5c1-f78043e538d9',URL='https://api.scryfall.com/cards/'+ID;
export const PARENT='d5d8624c216544f97ffe54639e2fff43ab9317d8',AUTH='P3_P1_ONE_HOSTED_CARD_DIAGNOSTIC';
export const HISTORICAL='98fe01f99fc23e196c5d6f473fda01f2cb06241d664969eb1197c14ff026b8b6',MAX_BYTES=1048576,TIMEOUT_MS=15000;
const now=()=>new Date().toISOString(),fail=()=>{throw new Error('M5 acceptance: scope_binding');};
const check=x=>{if(!x)fail();},type=v=>v===null?'null':Array.isArray(v)?'array':typeof v;
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v);
const valid=fn=>{try{fn();return true;}catch{return false;}};
export function authorize(a){
 check(a?.authorization===AUTH&&a.real_diagnostic===true&&a.actions===true&&a.event==='pull_request'&&a.action==='synchronize');
 check(a.repository==='Bennyescaped/duelvanta'&&a.base_repository===a.repository&&a.head_repository===a.repository&&a.pr===6&&a.branch==='tcg-registry-v1'&&a.attempt===1);
 check(/^[0-9a-f]{40}$/.test(a.head??'')&&a.head===a.event_head&&a.head===a.current_pr_head&&a.parents?.length===1&&a.parents[0]===PARENT&&/^\d+$/.test(a.run_id??'')&&/^\d+$/.test(a.run_number??''));
 return {head:a.head,parents:[PARENT],event:a.event,action:a.action,repository:a.repository,base_repository:a.base_repository,head_repository:a.head_repository,pr:6,branch:a.branch,attempt:1,run_id:a.run_id,run_number:a.run_number,current_pr_head:a.current_pr_head};
}
function field(raw,k,validate){return {present:Object.hasOwn(raw,k),type:type(raw[k]),valid:valid(()=>validate(raw[k]))};}
function imageFields(f){return valid(()=>{if(Object.hasOwn(f,'image_status'))C.choice(f.image_status,['missing','placeholder','lowres','highres_scan']);if(Object.hasOwn(f,'image_uris')){C.shape(f.image_uris,Reflect.ownKeys(f.image_uris));for(const k of ['small','normal','large','png','art_crop','border_crop'])if(Object.hasOwn(f.image_uris,k)){C.text(f.image_uris[k]);check(/^https:\/\/[^\s<>]+$/.test(f.image_uris[k]));}}});}
const enumValue=(v,allowed)=>allowed.includes(v)?v:null;
export function diagnose(bytes,{retrievedAt=now(),historical=HISTORICAL}={}){
 const ev=prepareProviderEvidence(parseProviderJSON(bytes)),raw=ev.raw_record;
 check(raw&&typeof raw==='object'&&!Array.isArray(raw)&&raw.object==='card'&&uuid(raw.id)&&raw.id===ID);
 const faces=Array.isArray(raw.card_faces)?raw.card_faces:[];
 const d={observation:'CURRENT_SINGLE_RECORD',raw_response_included:false,id:raw.id,object:'card',layout:enumValue(raw.layout,['normal','split','flip','adventure','transform','modal_dfc','meld','leveler','saga','class','battle','planar','scheme','vanguard','token','double_faced_token','emblem','augment','host','art_series','reversible_card']),lang:enumValue(raw.lang,['en','de','fr','it','es','ja','ko','zhs','zht','ru','pt','he','la','grc','ar','sa','ph']),digital:typeof raw.digital==='boolean'?raw.digital:null,oversized:typeof raw.oversized==='boolean'?raw.oversized:null,games:Array.isArray(raw.games)?raw.games.filter(v=>['paper','arena','mtgo','astral','sega'].includes(v)):null,
  root_fields:Object.fromEntries(['name','set','set_name','lang','layout','collector_number','rarity'].map(k=>[k,field(raw,k,C.text)])),card_faces_type:type(raw.card_faces),card_faces_count:Array.isArray(raw.card_faces)?raw.card_faces.length:null,
  faces:faces.map((f,index)=>{const object_valid=valid(()=>C.shape(f,Reflect.ownKeys(f)));return {index,object_valid,name:field(f??{},'name',C.text),printed_name:field(f??{},'printed_name',C.text),illustration_id:field(f??{},'illustration_id',v=>check(v===null||uuid(v))),oracle_id:field(f??{},'oracle_id',v=>check(v===null||uuid(v))),image_fields_valid:object_valid&&imageFields(f)};}),
  record_sha256:ev.content_sha256,response_sha256:sha256(bytes),run811_record_sha256:historical,run811_canonical_hash_equal:ev.content_sha256===historical,run809_exact_predicate_proven:false,other_four_individually_proven:false,all_predicates_checked:false};
 const language=G.magic.normalizeLanguage(raw.lang);
 // No guessed fallback: context is built only from validated actual fields.
 check(language.status==='valid'&&valid(()=>C.text(raw.collector_number)));
 const ctx={game_key:'magic',locale:language.locale,collector:{text:raw.collector_number,source:'manual'},source_path:'api/cards/'+ID,retrieved_at:retrievedAt};
 try{const result=P.scryfall.translate(raw,ctx);d.translation={status:result.status};d.observation_complete=true;}
 catch(e){d.translation={error:safeError(e,{phase:'audit_cards',external_id:ID,record_sha256:ev.content_sha256})};d.observation_complete=d.translation.error.contract_code==='scryfall_face_count';}
 d.classification=d.translation.error?.contract_code==='scryfall_face_count'?'FACE_COUNT_OUTSIDE_CURRENT_CONTRACT_VALIDITY_REQUIRES_REVIEW':d.translation.error?'OTHER_CONTRACT_REJECT':'TRANSLATOR_RESULT';
 d.coverage='First translator failure may hide later predicates; no catalog admission and no proof of all five historical records.';
 return d;
}
// One native request; status/finish are observations, never proof of server receipt.
async function receive(request,journal,buffers,{setTimer=setTimeout,clearTimer=clearTimeout}={}){
 return new Promise((resolveResult,reject)=>{
  let req,res,timer,settled=false;
  const finish=(error,value)=>{if(settled)return;settled=true;clearTimer(timer);if(error){res?.destroy();req?.destroy();reject(error);}else resolveResult(value);};
  const error=code=>Object.assign(new Error(),{code});
  timer=setTimer(()=>finish(error('ETIMEDOUT')),TIMEOUT_MS);
  try{req=request(URL,{agent:false,headers:{Accept:'application/json','Accept-Encoding':'identity','User-Agent':'DUELVANTA-P3-P1-Single-Record-Diagnostic/1'}},response=>{
   if(settled){response.destroy();return;}res=response;journal.response_observed=true;journal.status=response.statusCode;
   response.once('error',e=>finish(e));response.once('aborted',()=>finish(error('ECONNRESET')));
   if(Number(response.headers['content-length'])>MAX_BYTES){finish(error('RESPONSE_TOO_LARGE'));return;}
   response.on('data',chunk=>{if(settled)return;const b=Buffer.from(chunk);journal.response_bytes+=b.length;if(journal.response_bytes>MAX_BYTES){b.fill(0);finish(error('RESPONSE_TOO_LARGE'));return;}buffers.push(b);});
   response.once('end',()=>{if(settled)return;if(response.complete===false){finish(error('ECONNRESET'));return;}journal.response_complete=true;const bytes=Buffer.concat(buffers);buffers.push(bytes);journal.response_sha256=sha256(bytes);finish(null,bytes);});
   response.once('close',()=>{if(!settled&&!journal.response_complete)finish(error('ECONNRESET'));});
  });req.once('finish',()=>{journal.request_finished_locally=true;});req.once('error',e=>finish(e));}
  catch(e){finish(e);}
 });
}
export async function runSingleRecord({authorization,outputDir,request=(...args)=>https.get(...args),writer=atomicEvidence,cleanup=()=>{},timers,offline=diagnose}={}){
 const ledger={contract:'TCG-I3-M5-P3-P1-single-record',started_at:now(),diagnostic_completion_pass:false,status:'BLOCKED',first_failure:null,diagnostic_errors:[],cleanup_errors:[],required_evidence_complete:false,offline_external_io_attempts:0,bulk_acquisitions:0,full_snapshot_audits:0,I19_invocations:0,database_publications:0};
 const journal={url:URL,method:'GET',request_creation_attempts:0,request_finished_locally:false,response_observed:false,status:null,response_bytes:0,response_complete:false,response_sha256:null,server_delivery_proven:false,redirect_followed:false,retries:0,maximum_bytes:MAX_BYTES,timeout_ms:TIMEOUT_MS};
 let output=null,phase='authorization',badWrite=false,record=null;const buffers=[],written=new Set();
 const persist=async(name,value)=>{try{check(output!==null);await writer(join(output,name),value);written.add(name);return true;}catch(e){badWrite=true;ledger.diagnostic_errors.push({evidence:name,error:safeError(e,{phase:'audit_output'})});return false;}};
 const must=async(name,value)=>{if(!await persist(name,value))fail();};
 try{
  ledger.binding=authorize(authorization);check(typeof outputDir==='string'&&resolve(outputDir)===outputDir);check(await realpath(dirname(outputDir))===dirname(outputDir));
  await mkdir(outputDir,{mode:0o700});output=outputDir;
  await writeFile(join(output,'request-journal.json'),JSON.stringify(journal)+'\n',{flag:'wx',mode:0o600});
  await must('start-proof.json',{at:ledger.started_at,binding:ledger.binding,fixed_url:URL,maximum_requests:1,maximum_bytes:MAX_BYTES,timeout_ms:TIMEOUT_MS});
  await must('versions.json',{node:process.version,platform:process.platform,arch:process.arch});
  phase='transport';journal.attempt_reserved_at=now();journal.attempt_reserved=true;
  await must('request-journal.json',journal); // Persist the no-retry reservation first.
  journal.transport_started_at=now();journal.request_creation_attempts=1;const bytes=await receive(request,journal,buffers,timers);
  check(journal.response_complete&&journal.status===200);
  phase='offline';const guard=lockAuditIO();
  try{record=await offline(bytes,{retrievedAt:journal.transport_started_at});}
  finally{ledger.offline_external_io_attempts=guard.attempts();guard.restore();}
  check(record?.observation_complete===true&&ledger.offline_external_io_attempts===0);
 }catch(e){ledger.first_failure={phase,error:safeError(e,{phase:phase==='offline'?'audit_cards':'unknown'}),transport_code:['EAI_AGAIN','ENOTFOUND','ECONNREFUSED','ECONNRESET','ETIMEDOUT','EACCES','EPERM','ABORT_ERR','RESPONSE_TOO_LARGE'].includes(e.code)?e.code:null};}
 finally{
  // No raw file is ever created. Clear owned byte buffers even if cleanup hook fails.
  for(const b of buffers)b.fill(0);buffers.length=0;
  try{await cleanup();}catch(e){ledger.cleanup_errors.push(safeError(e,{phase:'raw_cleanup'}));}
  journal.finished_at=now();journal.raw_response_persisted=false;journal.raw_buffers_cleared=true;
  if(output){await persist('request-journal.json',journal);await persist('record-diagnosis.json',record??{status:'NO_COMPLETE_RECORD',raw_response_included:false});await persist('failure-proof.json',{first_failure:ledger.first_failure,diagnostic_errors:ledger.diagnostic_errors});await persist('cleanup-proof.json',{raw_files_created:0,raw_buffers_cleared:true,foreign_resources_removed:false,cleanup_errors:ledger.cleanup_errors});}
 }
 const required=['start-proof.json','versions.json','request-journal.json','record-diagnosis.json','failure-proof.json','cleanup-proof.json'];
 ledger.required_evidence_complete=!badWrite&&required.every(n=>written.has(n))&&record?.observation_complete===true&&journal.response_complete&&journal.status===200;
 ledger.diagnostic_completion_pass=ledger.required_evidence_complete&&!ledger.first_failure&&!ledger.cleanup_errors.length&&ledger.offline_external_io_attempts===0;
 ledger.status=ledger.diagnostic_completion_pass?'DIAGNOSTIC_COMPLETE':journal.response_observed?'PARTIAL':'BLOCKED';ledger.request=journal;ledger.finished_at=now();
 ledger.semantics='Expected scryfall_face_count is a diagnostic result, not catalog acceptance; I19 remains FAIL / LIVE_REACCEPTANCE_PENDING.';
 if(output&&!await persist('runner-ledger.json',ledger)){ledger.diagnostic_completion_pass=false;ledger.required_evidence_complete=false;ledger.status='PARTIAL';}
 return {exitCode:ledger.diagnostic_completion_pass?0:1,ledger,diagnosis:record};
}
async function cli(){
 check(process.argv.length===3&&process.argv[2]==='--real-diagnostic');
 const e=process.env,event=JSON.parse(await readFile(e.GITHUB_EVENT_PATH,'utf8')),head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),parents=execFileSync('git',['show','-s','--format=%P','HEAD'],{encoding:'utf8'}).trim().split(' ');
 const authorization={authorization:e.DUELVANTA_SINGLE_RECORD_DIAGNOSTIC,real_diagnostic:true,actions:e.GITHUB_ACTIONS==='true',event:e.GITHUB_EVENT_NAME,action:event.action,repository:e.GITHUB_REPOSITORY,base_repository:event.pull_request?.base?.repo?.full_name,head_repository:event.pull_request?.head?.repo?.full_name,pr:event.number,branch:event.pull_request?.head?.ref,attempt:Number(e.GITHUB_RUN_ATTEMPT),run_id:e.GITHUB_RUN_ID,run_number:e.GITHUB_RUN_NUMBER,head,event_head:event.pull_request?.head?.sha,current_pr_head:e.TCG_DIAGNOSTIC_CURRENT_PR_HEAD,parents};
 // No GitHub token is retained in the Scryfall process environment.
 check(!e.GH_TOKEN&&!e.GITHUB_TOKEN);
 const result=await runSingleRecord({authorization,outputDir:resolve('test-results/tcg-i3-m5-p3-p1-record')});
 console.log(JSON.stringify(result.ledger));process.exitCode=result.exitCode;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))cli().catch(e=>{console.error(JSON.stringify({status:'BLOCKED',diagnostic_completion_pass:false,error:safeError(e)}));process.exitCode=1;});
