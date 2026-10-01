// Synthetic controlled contract adapters. Never import this file into an API.
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
const native=process.argv.includes('--native');
const db=native?await(await import('./helpers/f3-native-db.mjs')).createDatabase():new(await import('@electric-sql/pglite')).PGlite({extensions:{pgcrypto:(await import('@electric-sql/pglite/contrib/pgcrypto')).pgcrypto}});
const key=randomBytes(48).toString('base64'); // ephemeral; never emitted or persisted
const out={native,acceptance:false,passed:false,cases:[],simulation:'All channel, origin-mode and external-original evidence is a controlled synthetic contract peer; no live integration.'};
const q=(sql,args=[],c=db)=>c.query(sql,args);
const value=async(sql,args=[],c=db)=>(await q(sql,args,c)).rows[0]?.v;
const hash=async x=>value("select encode(sha256(convert_to($1::jsonb::text,'UTF8')),'hex') v",[JSON.stringify(x)]);
const check=async(name,f)=>{await f();out.cases.push(name);console.log('PASS',name)};
const deny=async(f,re=/psttg_|permission denied/)=>{let e;try{await f()}catch(x){e=x}assert.ok(e,'expected rejection');assert.match(e.message,re)};
const call=(fn,args,c=db)=>value(`select dv_market_private.${fn}(${args.map((_,i)=>'$'+(i+1)).join(',')}) v`,args,c);
const scope=async(label=randomUUID(),c=db)=>call('psttg_ensure_scope',['subject',Buffer.from(await hash(label),'hex'),null,null],c);
const bind=async(s,mode='synthetic_test',options={})=>{
 const p={source_system:'isolated-contract-fixture',environment_id:'disposable-only',source_kind:'review',source_id:randomUUID(),source_version:'v1',source_digest:await hash({fixture:'selected-v1'}),operating_mode:mode,classification_basis:'isolated_fixture',attestation_payload:{contract_version:'fixture-v1',evidence_ref:'synthetic:'+randomUUID(),scope_digest:await hash(s)},attested_by:'controlled-fixture',producer_version:'fixture-v1',...options};
 return {id:await call('psttg_bind_origin',[p,[s],null]),p};
};
const append=(e,n,proof=null,c=db)=>call('psttg_append_event',[e,n,proof,key],c);
const payloadFor=cls=>({
 process_description:{period:'2026',procedures:['synthetic'],relationships:[],responsibilities:['fixture'],deadlines:['fixture'],applied_version:'v1',changes:[]},
 due_diligence:{inputs:{necessary_value:'synthetic-v1'},processing:'assessment',result:'synthetic-result',rule_version:'v1',reasons:['fixture'],processor:'fixture'},
 reported_information:{reported_information:{necessary_value:'synthetic-v1'},reporting_period:2026,submission_ref:'synthetic-submission',procedure:'fixture',transmission_status:'transmitted',acceptance_status:'not_yet_known'},
 provider_notice:{content:'synthetic complete notice',recipient_ref:'synthetic-recipient',channel:'contract-peer',notice_version:'v1',reporting_period:2026,delivery_meaning:'notified'},
 cooperation_event:{content:'synthetic complete request',reason:'fixture',subject_ref:'synthetic-subject',channel:'contract-peer',case_ref:'synthetic-case',measure_ref:'none',scope:'synthetic',lift_information:'not_applicable'}
}[cls]);
async function operation({s,origin,cls='due_diligence',subtype='assessment',basis='native_seal',year,instant,fragment,action,payloadOverride={}}={}){
 s??=await scope();origin??=await bind(s);
 action??={process_description:'process_document',due_diligence:'diligence',reported_information:'submission',provider_notice:'provider_notice_annual',cooperation_event:'cooperation_request'}[cls];
 const payload={...payloadFor(cls),source_fragments:{selected:{necessary_value:'synthetic-v1'}},...payloadOverride};
 if(fragment){payload.original_fragment=fragment;payload.correction_reason='synthetic correction';}
 const e={operation_id:randomUUID(),event_kind:'draft',action_kind:action,origin_id:origin.id,input_revision:'v1',input_digest:await hash(payload),input_ref:'synthetic-target',idempotency_key:randomUUID(),actor_ref:'controlled-fixture',producer_version:'fixture-v1',subject_scope_id:s};
 await append(e,0);e.event_kind='ready';await append(e,1,{input_snapshot:payload});e.event_kind='attempting';e.attempt_id=randomUUID();await append(e,2);
 const actual='2026-09-29T08:00:00.000Z';
 e.event_kind='executed_evidenced';e.actual_event_at=actual;
 const evidence={contract_version:'synthetic-channel-v1',operation_id:e.operation_id,input_digest:e.input_digest,target_ref:e.input_ref,meaning:action==='submission'?'transmitted':action.startsWith('provider_notice')?'notified':'performed',source_ref:'synthetic-receipt',actual_event_at:actual};
 let proof={};
 if(basis==='verified_external_original')proof={verified_year:year,precision:instant?'instant':'year',evidence_ref:'synthetic-original-proof',original_digest:e.input_digest,...(instant?{original_created_at:instant}:{})};
 if(basis==='unresolved')proof={clarification_ref:'synthetic-open-case',reason:'original creation unknown'};
 const cmd={record_class:cls,record_subtype:subtype,schema_version:'psttg-payload-v1',duty_holder_ref:'synthetic-operator',process_version:'v1',encryption_key_ref:'ephemeral-test-key',source_bindings:[{origin_id:origin.id,source_version:'v1',field_selector:'selected',source_digest:origin.p.source_digest,purpose:'required synthetic input',captured_fragment_digest:await hash(payload.source_fragments.selected)}],creation_basis:basis,creation_proof:proof,content_revision:'v1',capture_command_id:randomUUID(),reporting_period:2026};
 return {s,origin,payload,e,evidence,cmd,links:[],seq:3};
}
const seal=(x,c=db)=>call('seal_psttg_record',[x.cmd,x.e,x.seq,x.evidence,x.payload,key,JSON.stringify(x.links)],c);
const record=id=>value('select to_jsonb(r) v from dv_market_private.psttg_records r where record_id=$1',[id]);
const gen=s=>value('select generation::int v from dv_market_private.psttg_scope_guards where scope_id=$1',[s]);
async function external(year,opts={}){const s=opts.s??await scope(),origin=await bind(s,'synthetic_test',{source_kind:'external_record'});return operation({s,origin,action:'external_record_import',basis:'verified_external_original',year,...opts})}
try{
 await db.exec('create extension if not exists pgcrypto;create role anon;create role authenticated;create role service_role;');
 await db.exec(await readFile(new URL('../database/psttg-capture-core-v1.sql',import.meta.url),'utf8'));
 await check('A15 A33 private ACL; no application adapter, role or GUC authority',async()=>{
  for(const role of ['anon','authenticated','service_role']){
   for(const table of ['psttg_origin_bindings','psttg_operation_events','psttg_records','psttg_record_links','psttg_scope_guards'])for(const privilege of ['SELECT','INSERT','UPDATE','DELETE','TRUNCATE'])assert.equal(await value(`select has_table_privilege($1,$2,$3) v`,[role,'dv_market_private.'+table,privilege]),false);
   assert.equal(await value("select count(*)::int v from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='dv_market_private' and has_function_privilege($1,p.oid,'EXECUTE')",[role]),0);
  }
  assert.equal(await value("select rolcanlogin v from pg_roles where rolname='dv_psttg_core_owner'"),false);
 });
 const a=await operation();let aid;
 await check('A01 A23 native seal binds selected v1, encrypts payload and uses Berlin clock',async()=>{
  aid=await seal(a);const r=await record(aid);assert.equal(r.creation_basis,'native_seal');assert.equal(r.creation_year,new Date(r.sealed_at).getUTCFullYear());
  assert.deepEqual(JSON.parse(await value('select pgp_sym_decrypt(payload_ciphertext,$2) v from dv_market_private.psttg_records where record_id=$1',[aid,key])),a.payload);
  assert.equal(await value("select end_at=make_timestamptz(creation_year+11,1,1,0,0,0,'Europe/Berlin') v from dv_market_private.psttg_records where record_id=$1",[aid]),true);
  const metadata=await call('get_psttg_record_requirement',[aid]);assert.ok(!JSON.stringify(metadata).includes('synthetic-v1'));assert.equal(metadata.record_id,aid);
 });
 await check('A04 A24 exact replay preserves record, clock and generation; conflicting key fails',async()=>{
  const g=await gen(a.s),before=await record(aid);assert.equal(await seal(a),aid);assert.equal(await gen(a.s),g);assert.deepEqual(await record(aid),before);
  await deny(()=>seal({...a,cmd:{...a.cmd,process_version:'conflict'}}),/psttg_idempotency_conflict/);
  const b=await operation({s:a.s,origin:a.origin});const bid=await seal(b);assert.notEqual(bid,aid);
 });
 await check('A02 A05 A08 A12 A30 verified external years have independent ends; year-only stays year-only',async()=>{
  for(const [year,end] of [[2026,2037],[2027,2038],[2028,2039],[2029,2040]]){
   const x=await external(year,{s:a.s}),id=await seal(x),r=await record(id);assert.equal(r.creation_year,year);assert.equal(r.source_record_created_at,null);assert.equal(await value("select end_at=make_timestamptz($2,1,1,0,0,0,'Europe/Berlin') v from dv_market_private.psttg_records where record_id=$1",[id,end]),true);
  }
  const x=await external(2027,{instant:'2026-12-31T23:30:00Z'});await seal(x);
  const bad=await external(2026,{instant:'2026-12-31T23:30:00Z'});await deny(()=>seal(bad),/psttg_external_time_conflict/);
 });
 await check('A07 A12 unresolved original has no invented year/end',async()=>{
  const x=await operation({basis:'unresolved'}),r=await record(await seal(x));assert.equal(r.end_at,null);assert.equal(r.creation_year,null);assert.equal(r.record_state,'clarification_required');
 });
 await check('A15 caller control fields and forged provenance/time are rejected',async()=>{
  const x=await operation();for(const field of ['creation_year','executed','test'])await deny(()=>seal({...x,cmd:{...x.cmd,[field]:true}}),/psttg_record_shape/);
  await deny(()=>seal({...x,cmd:{...x.cmd,creation_proof:{created_at:'2020-01-01'}}}),/psttg_native_time_input/);
  await deny(()=>seal({...x,e:{...x.e,event_kind:'ready'}}),/psttg_execution_required/);
 });
 await check('A15 class payload types cannot masquerade as complete records',async()=>{
  const x=await operation({payloadOverride:{inputs:5}});await deny(()=>seal(x),/psttg_payload_type/);
 });
 await check('A16 A17 A18 controlled modes remain distinct; no automatic profile or aggregation integration',async()=>{
  for(const mode of ['synthetic_test','provider_sandbox','real_operation','unresolved']){const s=await scope(),o=await bind(s,mode);assert.equal(await value('select operating_mode v from dv_market_private.psttg_origin_bindings where origin_id=$1',[o.id]),mode)}
  const s=await scope();await deny(()=>bind(s,'real_operation',{source_kind:'provider_evidence',classification_basis:'verified_provider',provider_mode:'test',provider_account_ref:'synthetic',provider_event_ref:'synthetic',signature_verification_ref:'synthetic'}),/psttg_provider_mode_conflict/);
 });
 await check('A19 provenance revision is append-only, invalidates generation and blocks stale seal',async()=>{
  const x=await operation(),g=await gen(x.s);const rev={...x.origin.p,operating_mode:'unresolved',classification_basis:'conflict',classification_reason:'synthetic conflict'};
  await call('psttg_bind_origin',[rev,[x.s],x.origin.id]);assert.ok(await gen(x.s)>g);await deny(()=>seal(x),/psttg_source_binding|psttg_stale_origin/);
  const s=await scope(),o=await bind(s,'real_operation');await deny(()=>call('psttg_bind_origin',[{...o.p,operating_mode:'synthetic_test',classification_reason:'label only'},[s],o.id]),/psttg_real_downgrade/);
 });
 await check('A20 A21 A22 attempt timeout, reconciliation, duplicated callback and later rejection',async()=>{
  const x=await operation({cls:'reported_information',subtype:'original'}),e={...x.e,event_kind:'outcome_unknown'};delete e.actual_event_at;await append(e,3);x.seq=4;
  assert.equal(await value('select count(*)::int v from dv_market_private.psttg_records where operation_id=$1',[e.operation_id]),0);
  const id=await seal(x);assert.equal(await seal(x),id);
  const post={...x.e,event_kind:'rejected',external_event_id:'synthetic-later-rejection'};const ev={...x.evidence,meaning:'rejected'};await append(post,5,ev);await append(post,5,ev);
  assert.equal((await record(id)).execution_event_id,await value("select event_id v from dv_market_private.psttg_operation_events where operation_id=$1 and event_kind='executed_evidenced'",[e.operation_id]));
  await deny(()=>append({...post,external_event_id:'different'},6,{...ev,meaning:'delivered'}),/psttg_idempotency_conflict/);
 });
 await check('A03 A14 A25 A29 minimal correction fragment and same-subject original are mandatory',async()=>{
  const x=await operation({s:a.s,origin:a.origin,subtype:'correction',fragment:{necessary_value:'synthetic-v1'}});
  await deny(()=>seal(x),/psttg_original_required/);
  x.links=[{link_kind:'corrects',to_record_id:aid,target_version:'v1',required_fields:['necessary_value'],purpose_code:'synthetic-correction',embedded_fragment_digest:await hash(x.payload.original_fragment)}];
  const id=await seal(x);assert.notEqual(id,aid);assert.equal((await record(aid)).content_revision,'v1');
  const other=await operation({subtype:'correction',fragment:{necessary_value:'synthetic-v1'}});other.links=x.links;await deny(()=>seal(other),/psttg_link_binding/);
  const refundOrigin=await bind(await scope(),'synthetic_test',{source_kind:'tax_event'});const bad=await operation({s:(await value('select scope_ids[1] v from dv_market_private.psttg_origin_bindings where origin_id=$1',[refundOrigin.id])),origin:refundOrigin,cls:'reported_information',subtype:'original'});await deny(()=>seal(bad),/psttg_class_action/);
 });
 await check('A26 copies reference original only and do not change original end/generation',async()=>{
  const e={...a.e,operation_id:randomUUID(),event_kind:'copy',action_kind:'copy',idempotency_key:randomUUID(),original_record_id:aid,original_version:'v1',artifact_id:'synthetic-csv'};delete e.actual_event_at;delete e.attempt_id;
  const g=await gen(a.s);await append(e,0);assert.equal(await gen(a.s),g);assert.equal(await value('select count(*)::int v from dv_market_private.psttg_records where operation_id=$1',[e.operation_id]),0);
 });
 await check('A27 rollback has no record or execution; retry seals after transaction start',async()=>{
  const x=await operation();await db.exec('begin');const id=await seal(x);await db.exec('rollback');assert.equal(await record(id),undefined);
  await db.exec('begin');const start=await value('select transaction_timestamp() v');await q('select pg_sleep(0.025)');const r=await record(await seal(x));assert.ok(new Date(r.sealed_at)>new Date(start));await db.exec('commit');
 });
 await check('A28 immutable original/links/events cannot update delete or truncate',async()=>{
  for(const table of ['psttg_records','psttg_operation_events','psttg_origin_bindings']){await deny(()=>db.exec(`delete from dv_market_private.${table}`),/psttg_immutable/);await deny(()=>db.exec(`truncate dv_market_private.${table} cascade`),/psttg_immutable/)}
  await deny(()=>q('update dv_market_private.psttg_records set creation_year=2000 where record_id=$1',[aid]),/psttg_immutable/);
 });
 await check('A09 all five payload classes seal without Tax-event dependency',async()=>{
  for(const [cls,subtype] of [['process_description','original'],['provider_notice','annual'],['cooperation_event','request']])await seal(await operation({cls,subtype}));
 });
 await check('A28 integrity corruption is detected; session timezone does not change the seal',async()=>{
  await db.exec("set timezone='Pacific/Auckland'");await call('get_psttg_record_requirement',[aid]);await db.exec("set timezone='UTC'");
  // Privileged corruption is simulated only inside a rolled-back disposable
  // transaction. No bypass setter is installed in the candidate.
  await db.exec('begin;alter table dv_market_private.psttg_records disable trigger psttg_immutable');
  await q('update dv_market_private.psttg_records set seal_digest=sha256(\'corrupt\') where record_id=$1',[aid]);
  await deny(()=>call('get_psttg_record_requirement',[aid]),/psttg_integrity_error/);await db.exec('rollback');
 });
 // This local peer RETURNS a decision only. It never deletes, releases a Hold
 // or calls Auth/Storage. Its clock and generations are controlled test inputs.
 async function endPeer(c,s,expected,at){
  const r=(await q('select generation,phase from dv_market_private.psttg_scope_guards where scope_id=$1 for update',[s],c)).rows[0];
  if(Number(r.generation)!==expected||r.phase!=='open')throw Error('fixture_stale_generation_or_fence');
  const pending=await value("select exists(select from (select distinct on(operation_id) event_kind from dv_market_private.psttg_operation_events where $1=any(scope_ids) order by operation_id,event_seq desc) x where event_kind in ('attempting','outcome_unknown')) v",[s],c);
  if(pending)throw Error('fixture_open_operation');
  return (await q('select record_id,end_at,record_state from dv_market_private.psttg_records where $1=any(scope_ids)',[s],c)).rows.map(r=>({id:r.record_id,eligible:r.record_state==='evidenced'&&r.end_at!==null&&new Date(at)>=new Date(r.end_at)}));
 }
 await check('A10 A11 A34 isolated end-contract peer: per-record E, not a Hold or account maximum',async()=>{
  const s=await scope(),early=await external(2026,{s}),late=await external(2027,{s});const e=await seal(early),l=await seal(late),g=await gen(s);
  const before=await endPeer(db,s,g,'2036-12-31T22:59:59.999Z');assert.ok(before.every(r=>!r.eligible));
  const boundary=await endPeer(db,s,g,'2036-12-31T23:00:00.000Z');assert.equal(boundary.find(r=>r.id===e).eligible,true);assert.equal(boundary.find(r=>r.id===l).eligible,false);
  assert.equal(await value('select count(*)::int v from dv_market_private.psttg_records where $1=any(scope_ids)',[s]),2);
 });
 await check('A32 contract peer refuses fence evaluation with unresolved admitted operation',async()=>{
  const x=await operation();const ev={...x.e,event_kind:'outcome_unknown'};delete ev.actual_event_at;await append(ev,3);
  await deny(async()=>endPeer(db,x.s,await gen(x.s),'2040-01-01'),/fixture_open_operation/);
 });
 if(native){
  // Explicit independent connections, pg_blocking_pids and controlled commits.
  async function blocked(name,first,second,verify){await check(name,async()=>{
   const c1=await db.connect(),c2=await db.connect();const pid=await value('select pg_backend_pid() v',[],c2);
   await c1.query('begin');await first(c1);let done=false;
   const pending=second(c2).then(v=>({v}),error=>({error})).finally(()=>{done=true});
   let blockers=[];for(let i=0;i<100;i++){blockers=await value('select pg_blocking_pids($1) v',[pid]);if(blockers.length)break;await new Promise(r=>setTimeout(r,10))}
   assert.ok(blockers.length,'independent connection must block');assert.equal(done,false);await c1.query('commit');await verify(await pending);
  })}
  const x=await operation();let id;
  await blocked('A29 A31 native parallel seal waits and returns identical record',async c=>{id=await seal(x,c)},c=>seal(x,c),r=>{assert.ifError(r.error);assert.equal(r.v,id)});
  const y=await operation();await blocked('A29 native parallel conflicting idempotency fails after lock',c=>seal(y,c),c=>seal({...y,cmd:{...y.cmd,process_version:'conflict'}},c),r=>assert.match(r.error?.message??'',/psttg_idempotency_conflict/));
  const label=randomUUID();let sc;
  await blocked('O5 native concurrent scope creation shares one stable identity',async c=>{sc=await scope(label,c)},c=>scope(label,c),r=>{assert.ifError(r.error);assert.equal(r.v,sc)});
  const z=await operation();
  await blocked('A31 fixture fence wins; dependent writer waits then fails',c=>c.query("update dv_market_private.psttg_scope_guards set generation=generation+1,phase='fenced',fence_token=$2,fence_target_digest=sha256('fixture'),fence_generation=generation+1,recovery_state='pending' where scope_id=$1",[z.s,randomUUID()]),c=>seal(z,c),r=>assert.match(r.error?.message??'',/psttg_scope_fenced/));
  await check('A06 A13 A31 old repeatable-read snapshot cannot authorize after writer',async()=>{
   const z=await operation(),c=await db.connect();await c.query('begin isolation level repeatable read');await c.query('select * from dv_market_private.psttg_scope_guards where scope_id=$1',[z.s]);await seal(z);
   await deny(()=>call('psttg_lock_scopes',[[z.s]],c),/could not serialize access/);await c.query('rollback');
  });
  const originRace=await operation();const oldGeneration=await gen(originRace.s);
  await blocked('A19 A31 native provenance revision blocks stale generation peer',c=>call('psttg_bind_origin',[{...originRace.origin.p,operating_mode:'unresolved',classification_basis:'conflict',classification_reason:'fixture-revision'},[originRace.s],originRace.origin.id],c),c=>endPeer(c,originRace.s,oldGeneration,'2040-01-01'),r=>assert.match(r.error?.message??'',/fixture_stale_generation/));
  const linkRace=await operation({s:a.s,origin:a.origin,subtype:'correction',fragment:{necessary_value:'synthetic-v1'}});
  linkRace.links=[{link_kind:'corrects',to_record_id:aid,target_version:'v1',required_fields:['necessary_value'],purpose_code:'fixture-link',embedded_fragment_digest:await hash(linkRace.payload.original_fragment)}];const linkGeneration=await gen(a.s);
  await blocked('A13 A31 native new original dependency blocks stale generation peer',c=>seal(linkRace,c),c=>endPeer(c,a.s,linkGeneration,'2040-01-01'),r=>assert.match(r.error?.message??'',/fixture_stale_generation/));
  await check('A32 isolated partial-failure fence remains closed to writers and old capability',async()=>{
   await q("update dv_market_private.psttg_scope_guards set recovery_state='partial' where scope_id=$1",[z.s]);
   await deny(()=>seal(z),/psttg_scope_fenced/);await deny(async()=>endPeer(db,z.s,(await gen(z.s))-1,'2040-01-01'),/fixture_stale_generation_or_fence/);
   assert.equal(await value('select recovery_state v from dv_market_private.psttg_scope_guards where scope_id=$1',[z.s]),'partial');
  });
 }
 out.passed=true;out.acceptance=native;
}catch(e){out.failure={message:e.message,code:e.code??null};console.error('FAIL',e.message,e.where??'');process.exitCode=1}
finally{await mkdir('test-results',{recursive:true});await writeFile('test-results/psttg-capture-core-'+(native?'native':'preparation')+'.json',JSON.stringify(out,null,2));await db.close()}
