// WRAP01-20: synthetic behavior only, no external transport or database.
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,readdir,lstat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {fixture,card,uuid,sourceFixture,forbidExternalIO} from './helpers/tcg-i3-magic-source-fixture.mjs';
import {createScryfallSource} from '../tcg-catalog-scryfall-source-v1.mjs';
import {auditSnapshot} from './tcg-i3-magic-source-snapshot-audit.mjs';
import {safeError} from '../tcg-catalog-diagnostics-v1.mjs';
import {runSnapshotAudit,atomicEvidence,AUTHORIZATION,AUTHORIZED_PARENT,MIN_FREE_BYTES,lockAuditIO} from './tcg-i3-magic-source-snapshot-audit-real.mjs';
const tests=[],reports=[],add=(id,name,run)=>tests.push({id,name,run});
const secret='P2_SECRET_PAYLOAD_CREDENTIAL_SENTINEL';
const auth=()=>({authorization:AUTHORIZATION,real_audit:true,actions:true,event:'pull_request',repository:'Bennyescaped/duelvanta',head_repository:'Bennyescaped/duelvanta',pr:6,branch:'tcg-registry-v1',attempt:1,run_id:'12345',run_number:'999',head:'a'.repeat(40),pr_head:'a'.repeat(40),parents:[AUTHORIZED_PARENT]});
const probe=async()=>({at:fixture.clock,free_bytes:MIN_FREE_BYTES*2,free_inodes:1000000,total_memory_bytes:8*1024**3,free_memory_bytes:6*1024**3,rss_bytes:100000,minimum_free_bytes:MIN_FREE_BYTES});
async function scenario(run,options={}){
 const root=await mkdtemp(join(tmpdir(),'duelvanta-p2-wrapper-test-')),parent=join(root,'raw'),output=join(root,'out');await mkdir(parent);
 const f=sourceFixture(options.fixture??{}),state={acquires:0,audits:0,finishes:[],envelope:null,removed:[]};
 const args={authorization:auth(),outputDir:output,tempParent:parent,resourceProbe:probe,transport:f.transport,
  sourceFactory:({transport})=>{const s=createScryfallSource({transport,clock:f.clock,sleep:f.sleep});return {acquire:async x=>{state.acquires++;const a=await s.acquire(x);state.envelope=a.envelope;return {envelope:a.envelope,finish:async x=>{state.finishes.push(x);return a.finish(x);}};}};},
  audit:async e=>{state.audits++;assert.equal(e,state.envelope);return auditSnapshot(e);},
  remove:async(p,o)=>{state.removed.push(p);return rm(p,o);}};
 const exported=async()=>{try{const out={};for(const n of await readdir(output))out[n]=JSON.parse(await readFile(join(output,n),'utf8'));return out;}catch(e){if(e.code==='ENOENT')return {};throw e;}};
 try{await run({root,parent,output,args,state,f,exported});}finally{await rm(root,{recursive:true,force:true});}
}
function retain(result,files){reports.push({synthetic:true,ledger:result.ledger,evidence:files});assert.equal(JSON.stringify(reports).includes(secret),false);}
add('WRAP01','Runner import is inert under filesystem and network tripwires',async()=>{
 const cwd=resolve(dirnameHere(),'..');
 const script=`import {createRequire,syncBuiltinESMExports} from 'node:module'; const require=createRequire(import.meta.url);let calls=0;const block=()=>{calls++;throw Error('blocked')};for(const name of ['node:fs','node:fs/promises']){const m=require(name);for(const k of ['writeFile','writeFileSync','mkdir','mkdirSync','mkdtemp','mkdtempSync','rm','rmSync'])if(m[k])m[k]=block;}globalThis.fetch=block;require('node:net').Socket.prototype.connect=block;syncBuiltinESMExports();await import('./tests/tcg-i3-magic-source-snapshot-audit-real.mjs');process.stdout.write(JSON.stringify({calls}));`;
 const r=spawnSync(process.execPath,['--input-type=module','-e',script],{cwd,encoding:'utf8'});assert.equal(r.status,0,r.stderr);assert.deepEqual(JSON.parse(r.stdout),{calls:0});
});
function dirnameHere(){return resolve(fileURLToPath(new URL('.',import.meta.url)));}
add('WRAP02','Missing and wrong authorization cannot acquire',()=>scenario(async({args,state})=>{
 for(const value of [null,'wrong']){const r=await runSnapshotAudit({...args,authorization:{...auth(),authorization:value}});assert.equal(r.exitCode,1);assert.equal(r.ledger.audit_acquisition_invocations_this_block,0);}assert.equal(state.acquires,0);
}));
add('WRAP03','Run repository PR branch attempt head and sole-parent gates fail closed',()=>scenario(async({args,state})=>{
 for(const change of [{event:'push'},{repository:'other/repo'},{head_repository:'other/repo'},{pr:5},{branch:'main'},{attempt:2},{parents:[AUTHORIZED_PARENT,'b'.repeat(40)]},{parents:['b'.repeat(40)]},{head:'b'.repeat(40)},{actions:false}]){const r=await runSnapshotAudit({...args,authorization:{...auth(),...change}});assert.equal(r.exitCode,1);}assert.equal(state.acquires,0);
}));
add('WRAP04','One acquisition, identical envelope, complete compatible and finish false',()=>scenario(async({args,state,f,exported})=>{
 const r=await runSnapshotAudit(args);assert.equal(r.exitCode,0);assert.equal(r.ledger.snapshot_status,'COMPLETE_COMPATIBLE');assert.equal(state.acquires,1);assert.equal(state.audits,1);assert.deepEqual(state.finishes,[{published:false}]);assert.equal(r.ledger.provider_requests,f.calls.length);assert.ok(f.calls.length>=3);assert.equal(r.ledger.audit_database_publications,0);retain(r,await exported());
}));
add('WRAP05','Complete rejected is diagnostic success, every error class retained',()=>scenario(async({args,state,exported})=>{
 let original;const audit=args.audit;args.audit=async e=>(original=await audit(e));const r=await runSnapshotAudit(args),files=await exported();
 assert.equal(r.exitCode,0);assert.equal(r.ledger.snapshot_status,'COMPLETE_REJECTED');assert.equal(r.ledger.snapshot_compatible,false);assert.equal(original.first_pass.record_errors,3);assert.deepEqual(files['error-classes.json'].classes,original.error_classes);assert.equal(files['audit-report.json'].first_pass.eof,true);assert.equal(state.acquires,1);retain(r,files);
},{fixture:{cards:[card({id:uuid(1),name:null}),card({id:uuid(2)}),card({id:uuid(3),digital:'false'}),card({id:uuid(4),rarity:'unsupported'})]}}));
add('WRAP06','Global audit integrity failure is incomplete with no second acquisition',()=>scenario(async({args,state,exported})=>{
 const audit=args.audit;args.audit=async e=>{e.jsonl_sha256='0'.repeat(64);return audit(e);};const r=await runSnapshotAudit(args);assert.equal(r.exitCode,1);assert.equal(r.ledger.snapshot_status,'INCOMPLETE');assert.equal(state.acquires,1);assert.equal(state.audits,1);retain(r,await exported());
}));
add('WRAP07','Terminal acquisition error and transport attempts are safely recorded once',()=>scenario(async({args,state,f,exported})=>{
 const r=await runSnapshotAudit(args);assert.equal(r.exitCode,1);assert.equal(state.acquires,1);assert.equal(state.audits,0);assert.equal(f.calls.length,3);assert.equal(r.ledger.provider_requests,3);assert.equal(r.ledger.cleanup.own_temp_removed,true);retain(r,await exported());
},{fixture:{schedule:[{error:true},{error:true},{error:true}]}}));
add('WRAP08','Thrown audit error preserves original class and never reacquires',()=>scenario(async({args,state,exported})=>{
 args.audit=async()=>{state.audits++;throw new TypeError('TCG contract: invalid text');};const r=await runSnapshotAudit(args);assert.equal(r.exitCode,1);assert.equal(state.acquires,1);assert.equal(state.audits,1);assert.equal(r.ledger.first_failure.error.contract_code,'invalid_text');retain(r,await exported());
}));
add('WRAP09','Mandatory start write blocks all provider transport',()=>scenario(async({args,state,f,exported})=>{
 args.writer=async(p,v)=>{if(basename(p)==='start-proof.json')throw Error(secret);return atomicEvidence(p,v);};const r=await runSnapshotAudit(args);assert.equal(r.exitCode,1);assert.equal(state.acquires,0);assert.equal(f.calls.length,0);retain(r,await exported());
}));
add('WRAP10','Audit, cleanup, end and final ledger write failures cannot pass',async()=>{
 for(const name of ['audit-report.json','cleanup-proof.json','end-proof.json','runner-ledger.json'])await scenario(async({args,state,exported})=>{
  let writes=0;args.writer=async(p,v)=>{if(basename(p)===name&&(name!=='runner-ledger.json'||++writes>1))throw Object.assign(Error(secret),{code:'ENOSPC'});return atomicEvidence(p,v);};const r=await runSnapshotAudit(args);assert.equal(r.exitCode,1);assert.equal(r.ledger.diagnostic_completion_pass,false);assert.equal(r.ledger.required_evidence_complete,false);assert.equal(state.acquires,1);retain(r,await exported());
 });
});
add('WRAP11','Cleanup error remains separate and never masks the first audit error',()=>scenario(async({args,exported})=>{
 args.audit=async()=>{throw new TypeError('TCG contract: invalid text');};args.remove=async()=>{throw Object.assign(Error(secret),{code:'EACCES'});};const r=await runSnapshotAudit(args);assert.equal(r.exitCode,1);assert.equal(r.ledger.first_failure.error.contract_code,'invalid_text');assert.equal(r.ledger.cleanup_errors.length,1);assert.equal(r.ledger.cleanup.own_temp_removed,false);retain(r,await exported());
}));
add('WRAP12','Only the newly owned temporary tree is removed, foreign sibling survives',()=>scenario(async({args,parent,state,exported})=>{
 const foreign=join(parent,'foreign');await mkdir(foreign);await writeFile(join(foreign,'keep'),'unaltered');const r=await runSnapshotAudit(args);assert.equal(r.exitCode,0);assert.equal(await readFile(join(foreign,'keep'),'utf8'),'unaltered');assert.equal(state.removed.length,1);assert.match(basename(state.removed[0]),/^duelvanta-p2-audit-/);assert.deepEqual(await readdir(parent),['foreign']);retain(r,await exported());
}));
add('WRAP13','Raw envelope payloads, report extras and secret errors are never exported',()=>scenario(async({args,exported})=>{
 const factory=args.sourceFactory,argsAudit=args.audit;args.sourceFactory=o=>{const s=factory(o);return {acquire:async x=>{const a=await s.acquire(x);a.envelope.raw_record={name:secret};a.envelope.headers={authorization:secret};return a;}};};args.audit=async e=>({...await argsAudit(e),raw_record:{name:secret},message:secret});
 const r=await runSnapshotAudit(args);assert.equal(r.exitCode,0);const files=await exported();assert.ok(!JSON.stringify(files).includes(secret));assert.ok(!JSON.stringify(files).includes('"raw_record":'));retain(r,files);
},{fixture:{cards:[card({unconsumed:{secret}})]}}));
add('WRAP14','Audit cannot open transport, DB sockets, workers or subprocesses',()=>scenario(async({args,exported})=>{
 const audit=args.audit,require=createRequire(import.meta.url);args.audit=async e=>{
  for(const call of [()=>fetch('https://api.scryfall.com/sets'),()=>require('node:http').get('http://127.0.0.1'),()=>require('node:net').connect(5432),()=>require('node:tls').connect(5432),()=>require('node:child_process').spawn('anything'),()=>new (require('node:worker_threads').Worker)('anything')])assert.throws(call);
  return audit(e);
 };const r=await runSnapshotAudit(args);assert.equal(r.exitCode,1);assert.equal(r.ledger.audit_forbidden_io_attempts,6);assert.equal(r.ledger.audit_database_publications,0);retain(r,await exported());
}));
add('WRAP15','Failed request evidence prevents subsequent network attempts inside source retries',()=>scenario(async({args,f,exported})=>{
 let writes=0;args.writer=async(p,v)=>{if(basename(p)==='request-ledger.json'&&++writes>=2)throw Error(secret);return atomicEvidence(p,v);};const r=await runSnapshotAudit(args);assert.equal(r.exitCode,1);assert.equal(f.calls.length,0);assert.equal(r.ledger.provider_requests,0);retain(r,await exported());
}));
add('WRAP16','Insufficient disk and failing preflight both block acquisition',async()=>{
 for(const mode of ['disk','preflight'])await scenario(async({args,state,exported})=>{if(mode==='disk')args.resourceProbe=async()=>({...await probe(),free_bytes:1});else args.preflight=async()=>{throw Error(secret);};const r=await runSnapshotAudit(args);assert.equal(r.exitCode,1);assert.equal(state.acquires,0);retain(r,await exported());});
});
add('WRAP17','Existing output is never overwritten or used as a replay authorization',()=>scenario(async({args,output,state})=>{
 await mkdir(output);await writeFile(join(output,'keep'),'unchanged');const r=await runSnapshotAudit(args);assert.equal(r.exitCode,1);assert.equal(state.acquires,0);assert.equal(await readFile(join(output,'keep'),'utf8'),'unchanged');assert.deepEqual(await readdir(output),['keep']);
}));
add('WRAP18','Source finish failure prevents completion but still removes own raw data',()=>scenario(async({args,state,exported})=>{
 const factory=args.sourceFactory;args.sourceFactory=o=>{const s=factory(o);return {acquire:async x=>{const a=await s.acquire(x);return {envelope:a.envelope,finish:async p=>{await a.finish(p);throw Error(secret);}};}};};const r=await runSnapshotAudit(args);assert.equal(r.exitCode,1);assert.equal(r.ledger.cleanup_errors[0].stage,'finish');assert.equal(r.ledger.cleanup.own_temp_removed,true);assert.deepEqual(state.finishes,[{published:false}]);retain(r,await exported());
}));
add('WRAP19','Internal retry is one acquire, actual attempts counted and audit remains offline',()=>scenario(async({args,state,f,exported})=>{
 const r=await runSnapshotAudit(args);assert.equal(r.exitCode,0);assert.equal(state.acquires,1);assert.equal(state.audits,1);assert.equal(r.ledger.provider_requests,f.calls.length);const files=await exported();assert.equal(files['request-ledger.json'].requests[0].status,503);assert.ok(files['request-ledger.json'].requests.some(x=>x.acquisition_attempt===2));assert.equal(files['audit-report.json'].provider_requests,0);retain(r,files);
},{fixture:{schedule:[{status:503}]}}));
add('WRAP20','Input immutability, EOF, complete class coverage and no I19 promotion',()=>scenario(async({args,exported})=>{
 const r=await runSnapshotAudit(args),files=await exported(),a=files['audit-report.json'];assert.equal(r.exitCode,0);assert.equal(a.input_bindings.unchanged,true);assert.deepEqual(a.input_bindings.before,a.input_bindings.after);assert.equal(a.first_pass.eof,true);assert.equal(a.first_pass.balanced,true);assert.equal(a.second_pass.complete,true);assert.equal(a.example_coverage.complete,true);assert.equal(r.ledger.I19_operator_invocations_this_block,0);assert.equal(r.ledger.I19_operator_invocations_historical,5);assert.equal(r.ledger.I19,'FAIL / LIVE_REACCEPTANCE_PENDING');assert.equal(r.ledger.magic_status,'planned/unavailable');retain(r,files);
}));
const io=forbidExternalIO(),ledger={contract:'TCG-I3-M5-P2-WRAPPER-tests',synthetic:true,cases:[]};
try{
 for(const t of tests){try{await t.run();ledger.cases.push({id:t.id,name:t.name,status:'PASS'});console.log('PASS '+t.id+' '+t.name);}catch(e){ledger.cases.push({id:t.id,name:t.name,status:'FAIL',error:safeError(e)});console.error('FAIL '+t.id+' '+JSON.stringify({...safeError(e),actual_count:typeof e.actual==='number'?e.actual:null,expected_count:typeof e.expected==='number'?e.expected:null}));}}
 ledger.counts={PASS:ledger.cases.filter(x=>x.status==='PASS').length,FAIL:ledger.cases.filter(x=>x.status==='FAIL').length};ledger.unexpected_external_io_attempts=io.attempts();ledger.provider_requests=0;ledger.database_publications=0;ledger.secret_redaction_pass=!JSON.stringify(reports).includes(secret);
 if(process.env.TCG_WRAPPER_EVIDENCE_DIR){await mkdir(process.env.TCG_WRAPPER_EVIDENCE_DIR,{recursive:true});await atomicEvidence(join(process.env.TCG_WRAPPER_EVIDENCE_DIR,'wrapper-test-ledger.json'),ledger);await atomicEvidence(join(process.env.TCG_WRAPPER_EVIDENCE_DIR,'synthetic-wrapper-reports.json'),reports);}
 console.log(JSON.stringify(ledger));if(ledger.counts.FAIL||ledger.unexpected_external_io_attempts||!ledger.secret_redaction_pass)process.exitCode=1;
}finally{io.restore();}
