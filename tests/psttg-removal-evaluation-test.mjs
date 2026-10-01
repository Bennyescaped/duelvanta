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
const readerSQL=await readFile(new URL('../database/psttg-removal-evaluation-v1.sql',import.meta.url),'utf8');
const target=(id,kind='record',version='v1',segments=['whole'])=>({kind,id,version,segments});
const evaluate=(s,targets,c=db)=>call('evaluate_psttg_removal',[Array.isArray(s)?s:[s],JSON.stringify(targets)],c);
const fresh=(b,c=db)=>call('check_psttg_evaluation_current',[b],c);
const item=(v,id)=>v.targets.flatMap(t=>t.records).find(r=>r.record_id===id);
const realExternal=async(year,opts={})=>{const s=opts.s??await scope(),origin=await bind(s,'real_operation',{source_kind:'external_record'});return operation({s,origin,action:'external_record_import',basis:'verified_external_original',year,...opts})};
// The test alone temporarily replaces one internal clock sample in a rolled-back
// disposable transaction. No clock parameter/helper/grant is installed by SQL.
const clockAt=async(at,f)=>{
 const def=await value("select pg_get_functiondef('dv_market_private.evaluate_psttg_removal(uuid[],jsonb)'::regprocedure) v");
 assert.ok(def.includes('at_time:=clock_timestamp();'));assert.match(at,/^\d{4}-\d\d-\d\dT[\d:.]+Z$/);
 await db.exec('begin');
 try{await db.exec(def.replace('at_time:=clock_timestamp();',`at_time:='${at}'::timestamptz;`));await f()}finally{await db.exec('rollback')}
 assert.equal(await value("select pg_get_functiondef('dv_market_private.evaluate_psttg_removal(uuid[],jsonb)'::regprocedure) v"),def);
};
const snapshot=async()=>{
 const rows={};for(const name of ['psttg_origin_bindings','psttg_operation_events','psttg_records','psttg_record_links','psttg_scope_guards'])rows[name]=await value(`select encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text),'[]')::text,'UTF8')),'hex') v from dv_market_private.${name} x`);
 return {rows,acl:(await q("select p.oid,p.proacl::text,p.proowner,p.prosrc,p.proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='dv_market_private' order by p.oid")).rows,
 tables:(await q("select c.oid,c.relacl::text,c.relowner,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='dv_market_private' order by c.oid")).rows};
};
try{
 await db.exec('create extension if not exists pgcrypto;create role anon;create role authenticated;create role service_role;');
 await db.exec(await readFile(new URL('../database/psttg-capture-core-v1.sql',import.meta.url),'utf8'));
 await db.exec(readerSQL);
 const a=await realExternal(2026),aid=await seal(a);
 const b=await realExternal(2027,{s:a.s}),bid=await seal(b);
 await check('R01 A01 A02 A05 A08 exact Berlin individual boundaries before at after and next-year record',async()=>{
  for(const [at,status] of [['2036-12-31T22:59:59.999999Z','still_required'],['2036-12-31T23:00:00.000000Z','documented_boundary_reached'],['2036-12-31T23:00:00.000001Z','documented_boundary_reached']])await clockAt(at,async()=>{
   const v=await evaluate(a.s,[target(aid),target(bid)]);assert.equal(item(v,aid).time_status,status);assert.equal(item(v,bid).time_status,'still_required');
   assert.equal(item(v,aid).end_at,'2036-12-31T23:00:00+00:00');assert.equal(item(v,aid).calendar_zone,'Europe/Berlin');assert.equal(v.removal_authorized,false);
  });
 });
 let correction,correctionId;
 await check('R02 A03 A14 A30 correction embeds required fragment without extending whole original',async()=>{
  correction=await realExternal(2029,{s:a.s,subtype:'correction',fragment:{necessary_value:'synthetic-v1'}});
  correction.links=[{link_kind:'corrects',to_record_id:aid,target_version:'v1',required_fields:['necessary_value'],purpose_code:'correction',embedded_fragment_digest:await hash(correction.payload.original_fragment)}];
  correctionId=await seal(correction);
  await clockAt('2036-12-31T23:00:00Z',async()=>{
   const v=await evaluate(a.s,[target(aid),target(correctionId,'record','v1',['original_fragment'])]);
   assert.equal(item(v,aid).time_status,'documented_boundary_reached');assert.equal(item(v,correctionId).time_status,'still_required');
   assert.equal(v.targets.find(t=>t.target.id===aid).dependencies[0].status,'required_fragment_embedded_in_dependent');
   assert.equal(v.targets[0].dependencies.some(d=>d.extends_whole_original),false);
  });
 });
 await check('R03 A07 A12 unknown and contradictory creation evidence remains unresolved',async()=>{
  const x=await operation({basis:'unresolved'}),id=await seal(x),v=await evaluate(x.s,[target(id)]);assert.equal(item(v,id).end_at,null);assert.equal(item(v,id).time_status,'creation_unresolved');
  const bad=await realExternal(2026,{instant:'2026-12-31T23:30:00Z'});await deny(()=>seal(bad),/psttg_external_time_conflict/);
  // Conflicting external proof is rejected by unchanged K1/K3; no reader date invented.
 });
 await check('R04 A16 A17 A18 A19 provenance modes and later revision never become operational proof',async()=>{
  for(const mode of ['synthetic_test','provider_sandbox','unresolved']){
   const s=await scope(),o=await bind(s,mode),x=await operation({s,origin:o}),id=await seal(x),v=await evaluate(s,[target(id)]);
   assert.equal(item(v,id).provenance_status,mode==='unresolved'?'unresolved_or_revised':'test_or_sandbox');
  }
  const old=await evaluate(a.s,[target(aid)]);
  await call('psttg_bind_origin',[{...a.origin.p,operating_mode:'unresolved',classification_basis:'conflict',classification_reason:'synthetic conflict'},[a.s],a.origin.id]);
  assert.equal((await fresh(old.binding)).status,'stale_or_incomplete');assert.equal(item(await evaluate(a.s,[target(aid)]),aid).provenance_status,'unresolved_or_revised');
 });
 await check('R05 A04 A26 copy preserves original end and invalidates digest without generation bump',async()=>{
  const x=await realExternal(2026),id=await seal(x),old=await evaluate(x.s,[target(id)]),g=await gen(x.s);
  const e={...x.e,operation_id:randomUUID(),event_kind:'copy',action_kind:'copy',idempotency_key:randomUUID(),original_record_id:id,original_version:'v1',artifact_id:'synthetic-copy'};delete e.actual_event_at;delete e.attempt_id;await append(e,0);
  assert.equal(await gen(x.s),g);assert.equal((await fresh(old.binding)).status,'stale_or_incomplete');
  const v=await evaluate(x.s,[target(e.operation_id,'copy')]);assert.equal(item(v,id).relationship,'copy_original_no_restart');assert.equal(item(v,id).end_at,item(old,id).end_at);
 });
 await check('R06 A14 unembedded links report unresolved extent without whole-original extension',async()=>{
  const x=await realExternal(2026),id=await seal(x),y=await realExternal(2029,{s:x.s});y.links=[{link_kind:'uses_information_from',to_record_id:id,target_version:'v1',required_fields:['necessary_value'],purpose_code:'synthetic-dependency'}];await seal(y);
  const v=await evaluate(x.s,[target(id)]);assert.equal(v.targets[0].dependencies[0].status,'dependency_extent_unresolved');assert.equal(v.targets[0].dependencies[0].extends_whole_original,false);
 });
 await check('R07 A09 empty missing target/version and unmapped segment cannot prove absence',async()=>{
  const s=await scope(),o=await bind(s,'unresolved');
  for(const t of [target(randomUUID()),target(o.id,'origin'),target(aid,'record','missing'),target(aid,'record','v1',['field:'+'0'.repeat(64)])]){
   const v=await evaluate([s,a.s],[t]);assert.equal(v.core_coverage_complete,false);assert.equal(v.external_coverage_complete,false);assert.equal(v.targets[0].empty_is_absence_proof,false);
  }
  const v=await evaluate(s,[target(o.id,'origin')]);assert.equal(v.targets[0].origins[0].mode,'unresolved');assert.equal(v.targets[0].coverage_issue,'no_record_coverage');
 });
 await check('R08 A06 A31 omitted relevant scope discovered server-side including additional unrequested record',async()=>{
  const s=await scope(),extra=await scope(),o=await bind(s);const revision=await call('psttg_bind_origin',[{...o.p,classification_reason:'scope expansion'},[s,extra],o.id]);
  const x=await operation({s,origin:{id:revision,p:o.p}}),id=await seal(x);
  const v=await evaluate(s,[target(id)]);assert.ok(v.coverage_issues.includes('omitted_relevant_scope'));assert.equal(v.core_coverage_complete,false);assert.equal(v.binding.scope_states.length,2);
  assert.equal((await fresh(v.binding)).status,'stale_or_incomplete');
  const full=await evaluate([s,extra],[target(id)]);assert.equal(full.core_coverage_complete,true);assert.equal((await fresh(full.binding)).status,'current_core_snapshot');
  const next=await operation({s,origin:{id:revision,p:o.p}});await seal(next);assert.equal((await fresh(full.binding)).status,'stale_or_incomplete');
 });
 await check('R09 A20 A22 started unknown operation exposes necessary input; draft does not hold indefinitely',async()=>{
  const x=await operation();let e={...x.e,event_kind:'outcome_unknown'};delete e.actual_event_at;await append(e,3);
  let v=await evaluate(x.s,[target(e.operation_id,'operation_input')]);assert.equal(v.targets[0].operations[0].state,'outcome_unknown');assert.equal(v.targets[0].operations[0].input_requirement,'necessary_input_pending_outcome');
  const s=await scope(),o=await bind(s),draft={...e,operation_id:randomUUID(),event_kind:'draft',origin_id:o.id,subject_scope_id:s,idempotency_key:randomUUID()};delete draft.attempt_id;await append(draft,0);
  v=await evaluate(s,[target(draft.operation_id,'operation_input')]);assert.deepEqual(v.targets[0].operations,[]);assert.equal(v.targets[0].unrecorded_target,true);
 });
 await check('R10 A32 reads fenced closed and recovery conservatively without reopening',async()=>{
  const x=await realExternal(2026),id=await seal(x);
  for(const [phase,recovery] of [['fenced','pending'],['fenced','partial'],['closed','failed']]){
   await q("update dv_market_private.psttg_scope_guards set phase=$2,recovery_state=$3,fence_token=$4,fence_generation=generation,fence_target_digest=sha256('synthetic') where scope_id=$1",[x.s,phase,recovery,randomUUID()]);
   const before=await snapshot(),v=await evaluate(x.s,[target(id)]);assert.ok(v.coverage_issues.includes('fenced_closed_or_recovery'));assert.equal(v.core_coverage_complete,false);assert.deepEqual(await snapshot(),before);
  }
 });
 await check('R11 A33 pure reader and freshness preserve all core rows generations functions and ACLs',async()=>{
  const before=await snapshot(),v=await evaluate(a.s,[target(aid),target(bid)]);await fresh(v.binding);assert.deepEqual(await snapshot(),before);
  out.core_before_after_hashes=before.rows;
  const text=JSON.stringify(v);for(const forbidden of ['synthetic-v1','ephemeral-test-key','payload_ciphertext','duty_holder_ref','source_id','attestation_payload','creation_proof','input_ref'])assert.ok(!text.includes(forbidden),forbidden);
  for(const role of ['anon','authenticated','service_role'])assert.equal(await value("select count(*)::int v from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='dv_market_private' and has_function_privilege($1,p.oid,'EXECUTE')",[role]),0);
  assert.equal(await value("select count(*)::int v from pg_roles r cross join pg_proc p join pg_namespace n on n.oid=p.pronamespace where not r.rolsuper and r.rolname<>'dv_psttg_core_owner' and n.nspname='dv_market_private' and p.proname in ('evaluate_psttg_removal','check_psttg_evaluation_current','psttg_evaluation_scopes') and has_function_privilege(r.oid,p.oid,'EXECUTE')"),0);
  assert.equal(await value("select count(*)::int v from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='dv_market_private' and p.proname in ('evaluate_psttg_removal','check_psttg_evaluation_current') and (p.prosecdef=false or p.proconfig is null)"),0);
  assert.equal(await value("select count(*)::int v from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='dv_market_private' and p.proname like '%evaluation%' and pg_get_function_arguments(p.oid) like '%timestamp%'"),0);
 });
 await check('R16 Nr1 special end regime distinct and old temporal assessment is recomputed',async()=>{
  const x=await operation({cls:'process_description',subtype:'original'}),id=await seal(x);
  const v=await evaluate(x.s,[target(id)]);assert.equal(item(v,id).special_end_regime,false);
  const f=await fresh(v.binding);assert.equal(f.status,'current_core_snapshot');assert.ok(f.current_assessment);assert.equal(f.removal_authorized,false);
  const future={...v.binding,evaluated_at:'2199-01-01T00:00:00+00:00'};delete future.digest;future.digest=await hash(future);
  assert.equal((await fresh(future)).status,'stale_or_incomplete');
 });
 await check('R12 A28 malformed or tampered binding and target controls rejected',async()=>{
  await deny(()=>evaluate(a.s,[{...target(aid),at:'2100-01-01'}]),/psttg_evaluation_target_shape/);
  await deny(()=>evaluate(a.s,[target(aid,'record','')]),/psttg_evaluation_target_shape/);
  const v=await evaluate(a.s,[target(aid)]);await deny(()=>fresh({...v.binding,core_fingerprint:'forged'}),/psttg_evaluation_binding_integrity/);
  await deny(()=>fresh({}),/psttg_evaluation_binding_shape/);
 });
 if(native){
  const blocked=async(name,first,second,verify)=>check(name,async()=>{
   const c1=await db.connect(),c2=await db.connect(),pid1=await value('select pg_backend_pid() v',[],c1),pid2=await value('select pg_backend_pid() v',[],c2);
   await c1.query('begin');await first(c1);let done=false;
   const pending=second(c2).then(v=>({v}),error=>({error})).finally(()=>done=true);
   let blockers=[];for(let i=0;i<150;i++){blockers=await value('select pg_blocking_pids($1) v',[pid2]);if(blockers.length)break;await new Promise(r=>setTimeout(r,10))}
   assert.ok(blockers.includes(pid1),'pg_blocking_pids must name independent lock holder');assert.equal(done,false);
   out.lock_proofs??=[];out.lock_proofs.push({case:name,independent_connections:pid1!==pid2,blocker_matches_holder:true});
   await c1.query('commit');await verify(await pending);
  });
  for(const kind of ['seal','origin_revision','link','operation'])for(const order of ['writer_first','reader_first']){
   const x=await realExternal(2026),id=await seal(x);let writer;
   if(kind==='origin_revision')writer=c=>call('psttg_bind_origin',[{...x.origin.p,operating_mode:'unresolved',classification_basis:'conflict',classification_reason:'concurrent fixture'},[x.s],x.origin.id],c);
   else if(kind==='operation'){
    const y=await operation({s:x.s,origin:x.origin}),e={...y.e,event_kind:'outcome_unknown'};delete e.actual_event_at;writer=c=>append(e,3,null,c);
   }else{
    const y=await realExternal(2029,{s:x.s,...(kind==='link'?{subtype:'correction',fragment:{necessary_value:'synthetic-v1'}}:{})});
    if(kind==='link')y.links=[{link_kind:'corrects',to_record_id:id,target_version:'v1',required_fields:['necessary_value'],purpose_code:'concurrent-correction',embedded_fragment_digest:await hash(y.payload.original_fragment)}];writer=c=>seal(y,c);
   }
   const old=await evaluate(x.s,[target(id)]);let lockedResult;
   if(order==='writer_first')await blocked('R13 A06 A13 A19 A31 '+kind+' writer first',writer,c=>evaluate(x.s,[target(id)],c),async r=>{
    assert.ifError(r.error);assert.notEqual(r.v.binding.digest,old.binding.digest);assert.notEqual(r.v.binding.core_fingerprint,old.binding.core_fingerprint);assert.equal((await fresh(old.binding)).status,'stale_or_incomplete');
   });
   else await blocked('R14 A06 A13 A19 A31 '+kind+' reader first',async c=>{lockedResult=await evaluate(x.s,[target(id)],c)},writer,async r=>{
    assert.ifError(r.error);assert.equal((await fresh(lockedResult.binding)).status,'stale_or_incomplete');
   });
  }
  const expanding=await realExternal(2026),expandingId=await seal(expanding),extra=await scope();
  await blocked('R17 concurrent closure expansion requires whole-transaction retry',
   c=>call('psttg_bind_origin',[{...expanding.origin.p,classification_reason:'new affected scope'},[expanding.s,extra],expanding.origin.id],c),
   c=>evaluate(expanding.s,[target(expandingId)],c),async r=>{assert.equal(r.error?.code,'40001');assert.match(r.error.message,/psttg_evaluation_scope_closure_retry/)});
  await check('R15 A06 A13 old repeatable-read snapshot rejected even before a visible generation refresh',async()=>{
   const x=await realExternal(2026),id=await seal(x),c=await db.connect();await c.query('begin isolation level repeatable read');await c.query('select * from dv_market_private.psttg_scope_guards where scope_id=$1',[x.s]);
   await seal(await realExternal(2027,{s:x.s}));await deny(()=>evaluate(x.s,[target(id)],c),/psttg_evaluation_requires_read_committed_retry/);await c.query('rollback');
   const b=await evaluate(x.s,[target(id)]);await c.query('begin isolation level repeatable read');await deny(()=>fresh(b.binding,c),/psttg_evaluation_requires_read_committed_retry/);await c.query('rollback');
  });
 }
 out.passed=true;out.acceptance=native;
}catch(e){out.failure={message:e.message,code:e.code??null};console.error('FAIL',e.message,e.where??'');process.exitCode=1}
finally{await mkdir('test-results',{recursive:true});await writeFile('test-results/psttg-removal-evaluation-'+(native?'native':'preparation')+'.json',JSON.stringify(out,null,2));await db.close()}
