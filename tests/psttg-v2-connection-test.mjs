import assert from 'node:assert/strict';
import {randomUUID,randomBytes,createHmac} from 'node:crypto';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {UnitTestPeer} from './psttg-v2-test-peer.mjs';
import {publicationFixture} from './helpers/publication-hold-fixture.mjs';
const native=process.argv.includes('--native');
const db=native?await(await import('./helpers/f3-native-db.mjs')).createDatabase():new(await import('@electric-sql/pglite')).PGlite({extensions:{pgcrypto:(await import('@electric-sql/pglite/contrib/pgcrypto')).pgcrypto}});
const key=randomBytes(48).toString('base64');
const transactions=new WeakSet();let invariantSnapshot=null;
const q=async(s,a=[],c=db)=>{if(/^begin\b/i.test(s.trim()))transactions.add(c);try{return await c.query(s,a)}finally{if(/^(commit|rollback)\b/i.test(s.trim()))transactions.delete(c)}},val=async(s,a=[],c=db)=>(await q(s,a,c)).rows[0]?.v;
const call=(f,a=[],c=db)=>val(`select dv_market_private.${f}(${a.map((_,i)=>'$'+(i+1)).join(',')}) v`,a,c);
const out={native,passed:false,cases:[],locks:[],boundary:'SIMULATE_UNIT_TRANSITION only'};
const check=async(n,f)=>{await f();out.cases.push(n);console.log('PASS',n)};
const deny=async(f,re=/v2_|psttg_|permission|violates|duplicate|no rows|cannot truncate/)=>{const before=invariantSnapshot&&!transactions.has(db)?await invariantSnapshot():null;let e;try{await f()}catch(x){e=x}assert.ok(e,'rejection expected');assert.match(e.message,re);if(before)assert.deepEqual(await invariantSnapshot(),before)};
try{
 await publicationFixture(db);
 for(const f of ['psttg-capture-core-v1','psttg-removal-evaluation-v1','psttg-k5-synthetic-control-v1','psttg-representation-v2','psttg-v2-writer-unitmanifest-v1']){const sql=await readFile(new URL('../database/'+f+'.sql',import.meta.url),'utf8');if(f==='psttg-v2-writer-unitmanifest-v1'){const at=sql.indexOf('-- PROTECTION INSTALLATION:');await db.exec(sql.slice(0,at)+'commit;');globalThis.connectionProtection=sql.slice(at);}else await db.exec(sql);}
 const channels=[];for(let i=0;i<80;i++){const sid=await call('psttg_ensure_scope',['subject',randomBytes(32),null,null]);const g={channel_id:randomUUID(),target_system_ref:randomUUID(),environment_ref:randomUUID(),account_ref:randomUUID(),configuration_revision:1,scope_ids:[sid],operating_incarnation:randomUUID(),verification_key:randomBytes(32)};await q("insert into dv_market_private.psttg_v2_channel_v1(channel_id,target_system_ref,environment_ref,account_ref,configuration_revision,scope_ids,operating_incarnation,verification_key,contract_version) values($1,$2,$3,$4,1,$5,$6,$7,'psttg-k5-unitmanifest/1')",[g.channel_id,g.target_system_ref,g.environment_ref,g.account_ref,g.scope_ids,g.operating_incarnation,g.verification_key]);channels.push(g)}
 await db.exec('begin;'+globalThis.connectionProtection);
 const protectedTables=(await q("select schemaname,tablename from pg_tables where schemaname not in ('pg_catalog','information_schema') and schemaname not like 'pg_%' order by schemaname,tablename")).rows;
 const stateSQL='select jsonb_object_agg(k,v) v from ('+protectedTables.map(({schemaname:n,tablename:t})=>`select '${n}.${t}' k,encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text),'[]')::text,'UTF8')),'hex') v from "${n}"."${t}" x`).join(' union all ')+') s';
 invariantSnapshot=async()=>({data:await val(stateSQL),definitions:await val("select encode(sha256(convert_to(jsonb_agg(jsonb_build_array(p.oid,p.prosrc,p.proacl,p.proowner,p.proconfig) order by p.oid)::text,'UTF8')),'hex') v from pg_proc p"),rights:await val("select encode(sha256(convert_to(jsonb_agg(jsonb_build_array(c.oid,c.relacl,c.relowner,c.relrowsecurity) order by c.oid)::text,'UTF8')),'hex') v from pg_class c")});

 const s=await call('psttg_ensure_scope',['subject',randomBytes(32),null,null]);
 const body={amount:120,currency:'EUR',period:2026,position:randomUUID(),other_attributes:{secret:'synthetic-secret'},correction_reason:''};
 const cmd={command_id:randomUUID(),object_id:randomUUID(),incarnation:randomUUID(),version:1,kind:'O3',scopes:[s],dependencies:[],decision_ref:randomUUID(),original:{}};
 const content={body,source_fragment:Object.fromEntries(['amount','currency','period','position'].map(k=>[k,body[k]])),original_fragment:{}};
 await check('connected capture and reader preserve V111 result',async()=>{await call('psttg_v2_capture',[cmd,content,key]);assert.deepEqual((await call('psttg_v2_read',[cmd.object_id,key,2])).states,['present_verified']);});
 await check('locked helper rejects direct entry without actual context',async()=>{await deny(()=>call('psttg_v2_capture_locked_v1',[randomUUID(),cmd,content,key]));assert.equal(await val('select count(*)::int v from dv_market_private.psttg_v2_connection_context_v1'),0)});

 const sign=async(g,x,c=db)=>createHmac('sha256',g.verification_key).update(await val('select ($1::jsonb)::text v',[x],c)).digest();
 const invoke=async(g,command,payload={},c=db,{transaction=true}={})=>{if(transaction)await q('begin',[],c);try{await q("set local timezone='UTC'",[],c);const challenge=await call('psttg_v2_challenge_v1',[],c);const digest=await val("select encode(dv_market_private.psttg_v2_hash($1::jsonb),'hex') v",[JSON.stringify([command,payload])],c);const ticket={contract:'psttg-k5-unitmanifest/1',channel:g.channel_id,incarnation:g.operating_incarnation,challenge,command:digest};if(command.action==='FENCE'){ticket.positive_test_proofs=['provenance','endpoint','carrier_coverage','other_obligations','correction_preservation','open_operations','channel_effect','result_storage','restore_reconciliation'].map((claim,i)=>({evidence_ref:command.proof_refs[i]??null,version:1,issuer_ref:g.account_ref,key_version:g.configuration_revision,claim,binding:digest}));}const result=await call('psttg_v2_execute_v1',[command,payload,ticket,await sign(g,ticket,c),key],c);if(transaction)await q('commit',[],c);return result}catch(e){if(transaction)await q('rollback',[],c);throw e}};
 const common=(g,action)=>({contract:'psttg-v2-writer-use/1',action,channel:g.channel_id,operation_ref:randomUUID(),command_id:randomUUID()});
 const source=async(g)=>{const c={...common(g,'SOURCE'),source_ref:randomUUID(),source_version:1,predecessor:{},group_ref:randomUUID(),capture_command:randomUUID(),scopes:g.scope_ids};const p={source_ref:c.source_ref,source_version:1,mode:'synthetic_test',attestation_ref:randomUUID()};await invoke(g,c,p);return {c,p,ref:{representation:2,schema_version:'psttg-unit-v2',id:c.group_ref,incarnation:await val('select incarnation v from dv_market_private.psttg_object_anchor where object_id=$1',[c.group_ref]),version:1}}};
 const admission=(g,src)=>({...common(g,'ADMIT'),admission_ref:randomUUID(),input_group:randomUUID(),input_command:randomUUID(),own_group:randomUUID(),own_command:randomUUID(),input_revision:1,sources:[src.ref],mode:'record',target:{},decision_ref:randomUUID()});
 const transition=(g,a,action,revision,attempt,epoch)=>({...common(g,action),operation_ref:a.operation_ref,admission_ref:a.admission_ref,revision,attempt_ref:attempt,epoch,group_ref:randomUUID(),capture_command:randomUUID()});
 const envelope=(g,op,target,attempt,epoch,result)=>({contract:'synthetic-unit-result/1',channel:g.channel_id,system_ref:g.target_system_ref,environment_ref:g.environment_ref,account_ref:g.account_ref,event_ref:randomUUID(),operation_ref:op,attempt_ref:attempt,target_ref:target,operating_incarnation:g.operating_incarnation,epoch,result,proof_ref:randomUUID(),payload:{detail_ref:randomUUID()}});
 const receive=async(g,e,c=db)=>call('psttg_v2_receive_v1',[g.channel_id,e,await sign(g,e,c),key],c);
 const assessCmd=(g,targets)=>({...common(g,'ASSESS'),targets,manifest_ref:randomUUID(),manifest_revision:1,previous_manifest_ref:'',attempt_ref:randomUUID(),epoch:1,authorization_ref:randomUUID(),proof_refs:Array.from({length:9},randomUUID),expected:{},adapter:'synthetic-unit/1',unit_action:'SIMULATE_UNIT_TRANSITION'});
 const freshProjection=async(g,targets)=>invoke(g,assessCmd(g,targets));
 let g=channels.shift(),src,a,attempt;
 await check('source ready atomic registration, encrypted headers and idempotency',async()=>{src=await source(g);a=admission(g,src);await invoke(g,a,content);assert.equal(await val('select count(*)::int v from dv_market_private.psttg_v2_use_admission_v1 where admission_id=$1',[a.admission_ref]),1);const units=(await q('select unit_kind,schema_version,unit_id from dv_market_private.psttg_content_unit where object_id=$1 order by slot',[a.input_group])).rows;assert.deepEqual(units.map(u=>u.unit_kind),['input','event','proof']);assert.ok(units.every(u=>u.schema_version==='psttg-unit-v2-writer1'));assert.equal((await call('psttg_v2_plain',[units[1].unit_id,key])).meaning,'internal_ready');await invoke(g,a,content);await deny(()=>invoke(g,a,{...content,body:{...body,amount:999}}),/v2_idempotency_conflict/)});
 await check('attempt requires prior committed admission and exact reserved epoch',async()=>{attempt=randomUUID();await invoke(g,transition(g,a,'ATTEMPTING',1,attempt,1));await deny(()=>invoke(g,transition(g,a,'ATTEMPTING',2,randomUUID(),2)),/v2_unknown_no_retry/)});
 await check('receipt input not copied and seal reads committed input',async()=>{const e=envelope(g,a.operation_ref,a.admission_ref,attempt,1,'SIMULATED');const rid=await receive(g,e);assert.equal(await receive(g,e),rid);const targets=[{representation:2,schema_version:'psttg-unit-v2-writer1',id:a.input_group,incarnation:await val('select incarnation v from dv_market_private.psttg_object_anchor where object_id=$1',[a.input_group]),version:1}];
 const bind={...transition(g,a,'BIND_EVIDENCE',2,attempt,1),receipt_ref:rid,expected:{}};
 bind.expected=await freshProjection(g,targets);await invoke(g,bind);assert.equal(await val("select count(*)::int v from dv_market_private.psttg_content_unit where object_id=$1 and unit_kind='input'",[bind.group_ref]),0);assert.equal(await val('select count(*)::int v from dv_market_private.psttg_content_unit where object_id=$1',[bind.group_ref]),2);await invoke(g,transition(g,a,'SEALED',3,attempt,1));
 });
 const mg=channels.shift();const mc={...cmd,command_id:randomUUID(),object_id:randomUUID(),incarnation:randomUUID(),scopes:mg.scope_ids};await call('psttg_v2_capture',[mc,content,key]);
 const targets=[{representation:2,schema_version:'psttg-unit-v2',id:mc.object_id,incarnation:mc.incarnation,version:1}];let manifest;
 await check('manifest fence and attempt are non-destructive and exactly projected',async()=>{manifest=assessCmd(mg,targets);manifest.expected=await invoke(mg,manifest);manifest.action='FENCE';await invoke(mg,manifest);assert.equal(await val('select count(*)::int v from dv_market_private.psttg_content_unit where object_id=$1',[mc.object_id]),3);const p=await freshProjection(mg,targets);const begin={...common(mg,'BEGIN'),operation_ref:manifest.operation_ref,manifest_ref:manifest.manifest_ref,revision:1,expected:p};await invoke(mg,begin);assert.equal(await val('select count(*)::int v from dv_market_private.psttg_unit_end_receipt'),0)});

 await check('simulation receipt leaves contents fenced and never creates end receipt',async()=>{
  const e=envelope(mg,manifest.operation_ref,manifest.manifest_ref,manifest.attempt_ref,1,'SIMULATED');const rid=await receive(mg,e);
  await invoke(mg,{...common(mg,'RECONCILE'),operation_ref:manifest.operation_ref,manifest_ref:manifest.manifest_ref,revision:2,receipt_ref:rid,expected:await freshProjection(mg,targets)});
  assert.equal(await val("select state v from dv_market_private.psttg_k5_unitattempt_v1 where manifest_id=$1 order by state_revision desc limit 1",[manifest.manifest_ref]),'SIMULATED');
  await deny(()=>invoke(mg,{...common(mg,'CANCELLED_SAFE'),operation_ref:manifest.operation_ref,manifest_ref:manifest.manifest_ref,revision:3,expected:{}}));
  const r=await call('psttg_v2_read',[mc.object_id,key,2]);assert.ok(!r.states.includes('authorized_end_verified'));assert.equal(r.removal_authorized,false);assert.equal(r.external_coverage_complete,false);assert.equal(r.other_obligations,'not_evaluated');
 });
 const captureRecord=async(g)=>{const c={...cmd,command_id:randomUUID(),object_id:randomUUID(),incarnation:randomUUID(),scopes:g.scope_ids};await call('psttg_v2_capture',[c,content,key]);return c};
 const target=c=>({representation:2,schema_version:'psttg-unit-v2',id:c.object_id,incarnation:c.incarnation,version:1});
 const fence=async(g,c)=>{const m=assessCmd(g,[target(c)]);m.epoch=Number(await val('select execution_epoch+1 v from dv_market_private.psttg_v2_channel_v1 where channel_id=$1',[g.channel_id]));m.expected=await invoke(g,m);m.action='FENCE';await invoke(g,m);return m};
 await check('independent correction extract is committed before attempting; original values checked',async()=>{
  const g=channels.shift(),r=await captureRecord(g),src=await source(g),a=admission(g,src);a.mode='correction';a.target=target(r);
  const p={body:{...body,amount:99,correction_reason:'synthetic correction'},source_fragment:{...content.source_fragment,amount:99},original_fragment:content.source_fragment};
  await deny(()=>invoke(g,a,{...p,original_fragment:{...p.original_fragment,amount:99}}));await invoke(g,a,p);
  const ex=transition(g,a,'EXTRACT_COMMITTED',1,randomUUID(),1);ex.group_ref=a.own_group;await invoke(g,ex);
  const originalUnits=(await q('select unit_id from dv_market_private.psttg_unit_guard where object_id=$1',[r.object_id])).rows;
  for(const u of originalUnits){assert.equal(Number(await call('psttg_v2_demand_v1',[u.unit_id])),2);assert.equal(await call('psttg_v2_active_demand_v1',[u.unit_id]),false)}
  assert.ok((await call('psttg_v2_read',[a.own_group,key,2])).states.includes('required_correction_fragment'));
  await invoke(g,transition(g,a,'ATTEMPTING',2,randomUUID(),1));await deny(()=>invoke(g,transition(g,a,'SEALED',3,randomUUID(),1),{extra_source:randomUUID()}));
 });
 await check('copy changes both demand components and integration revision with constant generation',async()=>{
  const g=channels.shift(),r=await captureRecord(g),src=await source(g);const before=await freshProjection(g,[target(r)]),a=admission(g,src);a.mode='copy';a.target=target(r);await invoke(g,a,content);const after=await freshProjection(g,[target(r)]);
  assert.equal(before.scopes[0].generation,after.scopes[0].generation);assert.equal(Number(after.scopes[0].integration_revision),Number(before.scopes[0].integration_revision)+1);
  for(const u of before.guards.filter(u=>u.object_id===r.object_id)){const z=after.guards.find(z=>z.unit_id===u.unit_id);assert.equal(Number(z.demand_revision),Number(u.demand_revision)+2);assert.equal(Number(z.use_demand_revision),Number(u.use_demand_revision)+1)}
  assert.ok((await call('psttg_v2_read',[a.own_group,key,2])).states.includes('copy_or_dependency_unresolved'));
  const m=assessCmd(g,[target(r)]);m.expected=before;m.action='FENCE';await deny(()=>invoke(g,m),/v2_manifest_stale_projection/);
 });
 await check('overlap denied; disjoint fresh manifests coexist without global closing',async()=>{
  const g=channels.shift(),r1=await captureRecord(g),r2=await captureRecord(g);const old=assessCmd(g,[target(r2)]);old.expected=await invoke(g,old);old.action='FENCE';await fence(g,r1);await deny(()=>invoke(g,old),/v2_manifest_stale_projection/);await deny(()=>fence(g,r1));await fence(g,r2);assert.equal(await val('select phase v from dv_market_private.psttg_scope_guards where scope_id=$1',[g.scope_ids[0]]),'open');
 });
 await check('closed actions versions metadata and real removal rejected without mutations',async()=>{
  const g=channels.shift(),r=await captureRecord(g);const m=assessCmd(g,[target(r)]);m.expected=await invoke(g,m);m.action='FENCE';const before=await freshProjection(g,[target(r)]);
  for(const bad of [{...m,unit_action:'REMOVE_ACTIVE_DB_UNIT_GROUP'},{...m,targets:[{...target(r),representation:1}]},{...m,targets:[{...target(r),version:2}]},{...m,epoch:4},{...m,extra_input:body},{...m,proof_refs:[]}])await deny(()=>invoke(g,bad));
  assert.deepEqual(await freshProjection(g,[target(r)]),before);
  await q('begin isolation level repeatable read');await deny(()=>invoke(g,m,{},db,{transaction:false}),/v2_snapshot_retry/);await q('rollback');
 });
 await check('conflicting evidence preserved independently and blocks normal use',async()=>{
  const g=channels.shift(),e=envelope(g,randomUUID(),randomUUID(),randomUUID(),1,'UNMAPPED');const first=await receive(g,e);await q('begin');const e2={...e,event_ref:randomUUID()};await receive(g,e2);await q('rollback');assert.equal(await val('select receipt_revision::int v from dv_market_private.psttg_v2_channel_v1 where channel_id=$1',[g.channel_id]),1);
  assert.equal(await receive(g,e),first);assert.notEqual(await receive(g,{...e,payload:{detail_ref:randomUUID()}}),first);assert.equal(await val('select count(*)::int v from dv_market_private.psttg_v2_ingress_v1 where channel_id=$1',[g.channel_id]),2);await deny(()=>source(g),/v2_channel_stopped/);
 });
 await check('quarantine rejects dependent reading and old tickets but accepts independent ingress',async()=>{
  const g=channels.shift(),src=await source(g),a=admission(g,src);await invoke(g,a,content);const n={contract:'psttg-k5-unitmanifest/1',action:'RESTORE_QUARANTINE',channel:g.channel_id,external_incarnation:randomUUID()};await call('psttg_v2_quarantine_v1',[g.channel_id,n,await sign(g,n)]);await deny(()=>invoke(g,transition(g,a,'ATTEMPTING',1,randomUUID(),1)),/v2_restore_quarantine/);await deny(()=>call('psttg_v2_read',[a.input_group,key,2]),/v2_restore_quarantine/);await receive(g,envelope(g,a.operation_ref,a.admission_ref,randomUUID(),1,'UNMAPPED'));
 });
 await check('private immutable journals no application grants no residual lock capability',async()=>{
  await deny(()=>q('update dv_market_private.psttg_v2_use_admission_v1 set input_revision=input_revision+1'));await deny(()=>q('delete from dv_market_private.psttg_v2_use_transition_v1'));await deny(()=>q('truncate dv_market_private.psttg_k5_unitmanifest_v1'));
  assert.equal(await val('select count(*)::int v from dv_market_private.psttg_v2_connection_context_v1'),0);assert.equal(await val('select count(*)::int v from dv_market_private.psttg_v2_guard_plan_v1'),0);
  const acl=(await q("select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='dv_market_private' and p.proname like 'psttg_v2_%' and (has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('authenticated',p.oid,'EXECUTE') or has_function_privilege('service_role',p.oid,'EXECUTE'))")).rows;assert.equal(acl.length,0);
  let headers='';for(const t of ['psttg_v2_use_admission_v1','psttg_v2_use_transition_v1','psttg_v2_origin_head_v1','psttg_v2_integration_entry_v1','psttg_k5_unitmanifest_v1','psttg_k5_unitattempt_v1','psttg_v2_receipt_mapping_v1'])headers+=JSON.stringify((await q(`select to_jsonb(a) v from dv_market_private.${t} a`)).rows);
  const unitKeys=(await q('select unit_id from dv_market_private.psttg_content_unit')).rows;const keys=new Set();for(const u of unitKeys){const k=await val("select dv_market_private.psttg_v2_decrypt(wrapped_key,$2)->>'key' v from dv_market_private.psttg_content_unit where unit_id=$1",[u.unit_id,key]);assert.ok(!keys.has(k));keys.add(k)}
assert.ok(!headers.includes('synthetic-secret'));assert.ok(!headers.includes('amount'));assert.equal(await val('select count(*)::int v from dv_market_private.psttg_unit_end_receipt'),0);
 });
 await check('dispatch closed before capture, complete source mapping and commit barrier',async()=>{
  const g=channels.shift(),s1=await source(g),s2=await source(g),a=admission(g,s1);
  assert.equal(await call('psttg_v2_dispatch_v1',[null,'[]']),1);
  await deny(()=>call('psttg_v2_dispatch_v1',['psttg-v1',JSON.stringify([s1.ref])]),/v2_representation_mismatch/);
  await deny(()=>call('psttg_v2_dispatch_v1',['psttg-v2-writer-use/1',JSON.stringify([s1.ref,{...s2.ref,representation:1}])]),/v2_representation_mismatch/);
  await deny(()=>invoke(g,a,content),/v2_incomplete_synthetic_source_mapping/);a.sources=[s1.ref,s2.ref];
  await q('begin');await invoke(g,a,content,db,{transaction:false});await deny(()=>invoke(g,transition(g,a,'ATTEMPTING',1,randomUUID(),1),{},db,{transaction:false}),/v2_admission_commit_required/);await q('rollback');
  assert.equal(await val('select count(*)::int v from dv_market_private.psttg_v2_use_admission_v1 where admission_id=$1',[a.admission_ref]),0);
  await invoke(g,a,content);const r=await call('psttg_v2_connection_read_v1',[a.input_group,key,2]);assert.equal(r.reader_contract,'psttg-v2-writer-use/1');assert.equal(r.removal_authorized,false);assert.ok(r.integration_fingerprint);assert.ok(r.edge_commitment);
 });
 await check('safe cancel only after atomic peer revocation, effect and UNKNOWN cannot reopen',async()=>{
  for(const mode of ['revoke','effect','unknown']){
   const g=channels.shift(),r=await captureRecord(g),m=await fence(g,r),peer=new UnitTestPeer(g);
   const begin={...common(g,'BEGIN'),operation_ref:m.operation_ref,manifest_ref:m.manifest_ref,revision:1,expected:await freshProjection(g,m.targets)};await invoke(g,begin);
   const observer=native?await db.connect():db;const token=await peer.observeCommitted(m.attempt_ref,observer);
   const e=mode==='revoke'?peer.revokeWithoutEffect(token):mode==='effect'?peer.effect(token):peer.unknown(token);
   if(mode==='revoke')await deny(async()=>peer.effect(token),/peer_stale_or_revoked/);
   const rid=await receive(g,e);await invoke(g,{...common(g,'RECONCILE'),operation_ref:m.operation_ref,manifest_ref:m.manifest_ref,revision:2,receipt_ref:rid,expected:await freshProjection(g,m.targets)});
   const cancel={...common(g,'CANCELLED_SAFE'),operation_ref:m.operation_ref,manifest_ref:m.manifest_ref,revision:3,expected:await freshProjection(g,m.targets)};
   if(mode==='revoke'){await invoke(g,cancel);assert.equal(await val('select min(phase) v from dv_market_private.psttg_unit_guard where object_id=$1',[r.object_id]),'present');await deny(async()=>peer.effect(token),/peer_stale_or_revoked/)}else await deny(()=>invoke(g,cancel),/v2_not_applied_revocation_required/);
   assert.equal(await val('select count(*)::int v from dv_market_private.psttg_content_unit where object_id=$1',[r.object_id]),3);
  }
 });
 await check('consumed reserved epoch requires committed revocation and a new immutable manifest revision',async()=>{
  const g=channels.shift(),src=await source(g),a=admission(g,src);await invoke(g,a,content);const r=await captureRecord(g),m=await fence(g,r),peer=new UnitTestPeer(g);await invoke(g,transition(g,a,'ATTEMPTING',1,randomUUID(),1));
  await deny(async()=>invoke(g,{...common(g,'BEGIN'),operation_ref:m.operation_ref,manifest_ref:m.manifest_ref,revision:1,expected:await freshProjection(g,m.targets)}),/v2_foreign_projection_change|v2_epoch_consumed/);
  const e=await peer.revokeUnstarted(m.manifest_ref,native?await db.connect():db),rid=await receive(g,e);
  await invoke(g,{...common(g,'ABORT_UNSTARTED'),operation_ref:m.operation_ref,manifest_ref:m.manifest_ref,revision:1,receipt_ref:rid,expected:await freshProjection(g,m.targets)});
  const n={...assessCmd(g,m.targets),operation_ref:m.operation_ref,previous_manifest_ref:m.manifest_ref,manifest_revision:2,epoch:2};n.expected=await invoke(g,n);n.action='FENCE';await invoke(g,n);
  assert.equal(Number(await val('select execution_epoch v from dv_market_private.psttg_k5_unitmanifest_v1 where manifest_id=$1',[m.manifest_ref])),1);assert.equal(Number(await val('select execution_epoch v from dv_market_private.psttg_k5_unitmanifest_v1 where manifest_id=$1',[n.manifest_ref])),2);
  await invoke(g,{...common(g,'BEGIN'),operation_ref:n.operation_ref,manifest_ref:n.manifest_ref,revision:1,expected:await freshProjection(g,n.targets)});
 });
 if(native){
  const ca=await db.connect(),cb=await db.connect(),observer=await db.connect();
  const ap=await val('select pg_backend_pid() v',[],ca),bp=await val('select pg_backend_pid() v',[],cb);
  async function blocked(label,start,release){
   let settled=false;const pending=start().then(v=>({v}),e=>({error:e.message,code:e.code})).finally(()=>settled=true);
   let seen=false;for(let n=0;n<150&&!settled;n++){const holders=await val('select pg_blocking_pids($1) v',[bp],observer);if(holders.includes(ap)){out.locks.push({label,waiter:bp,holder:ap});seen=true;break}await new Promise(r=>setTimeout(r,20))}
   try{assert.ok(seen,label+' actual lock holder')}finally{await release()}
   return pending;
  }
  const retry=async fn=>{for(let n=0;n<3;n++){try{return await fn()}catch(e){if(e.code!=='40001'||n===2)throw e}}};
  const resolve=async(r,fn,re)=>{if(r.code==='40001'){out.fullRetries=(out.fullRetries??0)+1;if(re)await deny(()=>retry(fn),re);else await retry(fn)}else if(re)assert.match(r.error??'',re);else assert.ok(!r.error,r.error)};
  const snapshot=async()=>{const ts=(await q("select tablename from pg_tables where schemaname='dv_market_private' order by tablename",[],observer)).rows;const rows={};for(const {tablename:t} of ts)rows[t]=await val(`select encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text),'[]')::text,'UTF8')),'hex') v from dv_market_private.${t} x`,[],observer);return rows};
  await check('native all dependency races both orders with actual blockers and independent commit visibility',async()=>{
   for(const mode of ['record','copy','correction'])for(const writerFirst of [true,false]){
    const g=channels.shift(),src=await source(g),r=mode==='record'?null:await captureRecord(g),a=admission(g,src);a.mode=mode;
    if(r)a.target=target(r);
    const wanted=r?target(r):{representation:2,schema_version:'psttg-unit-v2',id:src.c.group_ref,incarnation:await val('select incarnation v from dv_market_private.psttg_object_anchor where object_id=$1',[src.c.group_ref]),version:1};
    const p=mode==='correction'?{body:{...body,amount:99,correction_reason:'synthetic correction'},source_fragment:{...content.source_fragment,amount:99},original_fragment:content.source_fragment}:content;
    const m=assessCmd(g,[wanted]);m.expected=await invoke(g,m);m.action='FENCE';
    await q('begin',[],ca);await invoke(g,writerFirst?a:m,writerFirst?p:{},ca,{transaction:false});
    if(writerFirst)assert.equal(await val('select count(*)::int v from dv_market_private.psttg_v2_use_admission_v1 where admission_id=$1',[a.admission_ref],observer),0);
    const next=()=>invoke(g,writerFirst?m:a,writerFirst?{}:p,cb);const waiting=await blocked(mode+'-fence-'+writerFirst,next,()=>q('commit',[],ca));
    await resolve(waiting,next,writerFirst?/v2_manifest_stale_projection/:/v2_required_group_unavailable|v2_target_guard|v2_original_integrity/);
    if(writerFirst)assert.equal(await val('select count(*)::int v from dv_market_private.psttg_v2_use_admission_v1 where admission_id=$1',[a.admission_ref],observer),1);
   }
  });
  await check('native correction seal versus original fence both orders uses retained independent proof',async()=>{
   for(const sealFirst of [true,false]){
    const g=channels.shift(),r=await captureRecord(g),src=await source(g),a=admission(g,src);a.mode='correction';a.target=target(r);const p={body:{...body,amount:99,correction_reason:'synthetic correction'},source_fragment:{...content.source_fragment,amount:99},original_fragment:content.source_fragment};await invoke(g,a,p);
    const attempt=randomUUID(),ex=transition(g,a,'EXTRACT_COMMITTED',1,attempt,1);ex.group_ref=a.own_group;await invoke(g,ex);await invoke(g,transition(g,a,'ATTEMPTING',2,attempt,1));
    const peer=new UnitTestPeer(g),token=await peer.observeCommitted(attempt,observer),rid=await receive(g,peer.effect(token));const bind={...transition(g,a,'BIND_EVIDENCE',3,attempt,1),receipt_ref:rid,expected:await freshProjection(g,[target(r)])};await invoke(g,bind);
    const m=assessCmd(g,[target(r)]);m.epoch=2;m.expected=await invoke(g,m);m.action='FENCE';const seal=transition(g,a,'SEALED',4,attempt,1);
    await q('begin',[],ca);await invoke(g,sealFirst?seal:m,{},ca,{transaction:false});const next=()=>invoke(g,sealFirst?m:seal,{},cb),result=await blocked('seal-original-fence-'+sealFirst,next,()=>q('commit',[],ca));await resolve(result,next,sealFirst?/v2_manifest_stale_projection/:null);
    if(sealFirst){m.expected=await freshProjection(g,m.targets);await invoke(g,m)}
    const reader=await call('psttg_v2_read',[a.own_group,key,2]);assert.ok(reader.states.includes('required_correction_fragment'));assert.equal(reader.original_full_rechecked,false);assert.equal(await val('select min(phase) v from dv_market_private.psttg_unit_guard where object_id=$1',[r.object_id]),'fenced');assert.equal(await val('select count(*)::int v from dv_market_private.psttg_content_unit where object_id=$1',[r.object_id]),3);
   }
  });
  await check('native provenance versus admission both orders rechecks current origin head',async()=>{
   for(const originFirst of [true,false]){
    const g=channels.shift(),src=await source(g),a=admission(g,src),rev={...src.c,...common(g,'SOURCE'),predecessor:src.ref,group_ref:randomUUID(),capture_command:randomUUID()};
    await q('begin',[],ca);await invoke(g,originFirst?rev:a,originFirst?src.p:content,ca,{transaction:false});
    const next=()=>invoke(g,originFirst?a:rev,originFirst?content:src.p,cb);const result=await blocked('origin-admission-'+originFirst,next,()=>q('commit',[],ca));
    await resolve(result,next,originFirst?/v2_stale_origin/:null);
    if(!originFirst)await deny(()=>invoke(g,transition(g,a,'ATTEMPTING',1,randomUUID(),1)),/v2_stale_origin/);
   }
  });
  await check('native identical competing registrations one demand; conflicts and independent demands both orders',async()=>{
   for(const kind of ['same','conflict','different'])for(const reverse of [true,false]){
    const g=channels.shift(),src=await source(g),a=admission(g,src),b=kind==='different'?admission(g,src):structuredClone(a),p2=kind==='conflict'?{...content,body:{...body,amount:121},source_fragment:{...content.source_fragment,amount:121}}:content;
    const c1=reverse?b:a,c2=reverse?a:b,p1=reverse?p2:content,p=reverse?content:p2;
    await q('begin',[],ca);await invoke(g,c1,p1,ca,{transaction:false});
    const next=()=>invoke(g,c2,p,cb),result=await blocked('admissions-'+kind+'-'+reverse,next,()=>q('commit',[],ca));await resolve(result,next,kind==='conflict'?/v2_idempotency_conflict/:null);
    assert.equal(await val('select count(*)::int v from dv_market_private.psttg_v2_use_admission_v1 where channel_id=$1',[g.channel_id]),kind==='different'?2:1);
    const units=(await q('select unit_id from dv_market_private.psttg_unit_guard where object_id=$1',[src.c.group_ref])).rows;
    for(const u of units)assert.equal(Number(await call('psttg_v2_demand_v1',[u.unit_id])),kind==='different'?2:1);
   }
  });
  await check('native overlapping and disjoint manifests both orders require fresh evaluation',async()=>{
   for(const overlap of [true,false])for(const reverse of [true,false]){
    const g=channels.shift(),r1=await captureRecord(g),r2=overlap?r1:await captureRecord(g),m1=assessCmd(g,[target(reverse?r2:r1)]),m2=assessCmd(g,[target(reverse?r1:r2)]);m1.expected=await invoke(g,m1);m2.expected=await invoke(g,m2);m1.action=m2.action='FENCE';
    await q('begin',[],ca);await invoke(g,m1,{},ca,{transaction:false});const next=()=>invoke(g,m2,{},cb);const result=await blocked('manifests-'+overlap+'-'+reverse,next,()=>q('commit',[],ca));await resolve(result,next,/v2_manifest_stale_projection/);
    m2.expected=await freshProjection(g,m2.targets);if(overlap)await deny(()=>invoke(g,m2),/v2_required_group_unavailable/);else await invoke(g,m2);
    assert.equal(await val('select phase v from dv_market_private.psttg_scope_guards where scope_id=$1',[g.scope_ids[0]]),'open');
   }
  });
  await check('native ingress versus attempt gate both orders preserves stop and independent receipt commit',async()=>{
   for(const ingressFirst of [true,false]){
    const g=channels.shift(),src=await source(g),a=admission(g,src);await invoke(g,a,content);const t=transition(g,a,'ATTEMPTING',1,randomUUID(),1),e=envelope(g,a.operation_ref,a.admission_ref,t.attempt_ref,1,'UNKNOWN');
    await q('begin',[],ca);if(ingressFirst)await receive(g,e,ca);else await invoke(g,t,{},ca,{transaction:false});
    assert.equal(await val('select count(*)::int v from dv_market_private.psttg_v2_ingress_v1 where channel_id=$1',[g.channel_id],observer),0);
    assert.equal(await val('select count(*)::int v from dv_market_private.psttg_v2_use_transition_v1 where admission_id=$1',[a.admission_ref],observer),0);
    const next=()=>ingressFirst?invoke(g,t,{},cb):receive(g,e,cb);const result=await blocked('ingress-attempt-'+ingressFirst,next,()=>q('commit',[],ca));await resolve(result,next,ingressFirst?/v2_channel_stopped/:null);
    assert.equal(await val('select stopped v from dv_market_private.psttg_v2_channel_v1 where channel_id=$1',[g.channel_id]),true);assert.equal(await val('select count(*)::int v from dv_market_private.psttg_v2_ingress_v1 where channel_id=$1',[g.channel_id],observer),1);
   }
  });
  await check('native complete retry on growing earlier command operation unit scope sets',async()=>{
   const g=channels.shift(),src=await source(g),a=admission(g,src),extra=await call('psttg_ensure_scope',['subject',randomBytes(32),null,null]),c={...cmd,object_id:randomUUID(),incarnation:randomUUID(),command_id:randomUUID(),scopes:[...g.scope_ids,extra]};
   await q('begin',[],ca);await call('psttg_v2_capture',[c,content,key],ca);const waiting=await blocked('scope-growth',()=>invoke(g,a,content,cb),()=>q('commit',[],ca));assert.equal(waiting.code,'40001');await deny(()=>invoke(g,a,content),/v2_channel_scope/);
  });
  await check('native independent commit witnesses and lost replies never create a second operation',async()=>{
   const g=channels.shift(),src=await source(g),a=admission(g,src);const before=await snapshot();await q('begin',[],ca);await invoke(g,a,content,ca,{transaction:false});assert.equal(await val('select count(*)::int v from dv_market_private.psttg_v2_use_admission_v1 where admission_id=$1',[a.admission_ref],observer),0);assert.equal((await call('psttg_v2_result_v1',[g.channel_id,a.operation_ref,a.command_id],ca)).status,'commit_not_confirmed');await q('rollback',[],ca);assert.deepEqual(await snapshot(),before);
   await invoke(g,a,content);assert.equal((await call('psttg_v2_result_v1',[g.channel_id,a.operation_ref,a.command_id],observer)).status,'committed_visible');const committed=await snapshot();await invoke(g,a,content);assert.deepEqual(await snapshot(),committed);
   const t=transition(g,a,'ATTEMPTING',1,randomUUID(),1);await q('begin',[],ca);await invoke(g,t,{},ca,{transaction:false});assert.equal(await val('select count(*)::int v from dv_market_private.psttg_v2_use_transition_v1 where admission_id=$1',[a.admission_ref],observer),0);await q('commit',[],ca);assert.equal(await val('select count(*)::int v from dv_market_private.psttg_v2_use_transition_v1 where admission_id=$1',[a.admission_ref],observer),1);const after=await snapshot();await invoke(g,t);assert.deepEqual(await snapshot(),after);
   const e=envelope(g,a.operation_ref,a.admission_ref,t.attempt_ref,1,'SIMULATED');await q('begin',[],ca);await receive(g,e,ca);assert.equal(await val('select count(*)::int v from dv_market_private.psttg_v2_ingress_v1 where channel_id=$1',[g.channel_id],observer),0);await q('rollback',[],ca);assert.deepEqual(await snapshot(),after);
   await q('begin',[],ca);const rid=await receive(g,e,ca);await q('commit',[],ca);assert.equal(await val('select count(*)::int v from dv_market_private.psttg_v2_ingress_v1 where receipt_id=$1',[rid],observer),1);const saved=await snapshot();assert.equal(await receive(g,e),rid);assert.deepEqual(await snapshot(),saved);
  });
  await check('native second restored database independent peer keeps effect and revocation history',async()=>{
   const g=channels.shift(),src=await source(g),a=admission(g,src);await invoke(g,a,content);const r=await captureRecord(g),m=await fence(g,r),peer=new UnitTestPeer(g);
   const groupIds=(await q('select object_id from dv_market_private.psttg_unit_binding where scope_ids&&$1::uuid[]',[g.scope_ids])).rows.map(r=>r.object_id);
   const image={};const filters={psttg_scope_guards:['scope_id=any($1::uuid[])',g.scope_ids],psttg_v2_channel_v1:['channel_id=$1',g.channel_id],psttg_v2_origin_head_v1:['scope_ids&&$1::uuid[]',g.scope_ids],psttg_v2_use_admission_v1:['scope_ids&&$1::uuid[]',g.scope_ids],psttg_v2_integration_entry_v1:['scope_ids&&$1::uuid[]',g.scope_ids],psttg_k5_unitmanifest_v1:['channel_id=$1',g.channel_id],psttg_k5_unitattempt_v1:['manifest_id=$1',m.manifest_ref]};
   for(const t of ['psttg_object_anchor','psttg_unit_guard','psttg_content_unit','psttg_unit_binding'])filters[t]=['object_id=any($1::uuid[])',groupIds];
   for(const [t,[where,arg]] of Object.entries(filters))image[t]=await val(`select coalesce(jsonb_agg(to_jsonb(x)),'[]') v from dv_market_private.${t} x where ${where}`,[arg]);
   const begin={...common(g,'BEGIN'),operation_ref:m.operation_ref,manifest_ref:m.manifest_ref,revision:1,expected:await freshProjection(g,m.targets)};
   await q('begin');const oldTicket={contract:'psttg-k5-unitmanifest/1',channel:g.channel_id,incarnation:g.operating_incarnation,challenge:await call('psttg_v2_challenge_v1',[]),command:await val("select encode(dv_market_private.psttg_v2_hash($1::jsonb),'hex') v",[JSON.stringify([begin,{}])])};const oldSignature=await sign(g,oldTicket);await q('commit');
   await q('begin',[],ca);await invoke(g,begin,{},ca,{transaction:false});await deny(()=>peer.observeCommitted(m.attempt_ref,observer),/peer_uncommitted_attempt/);await q('commit',[],ca);
   const token=await peer.observeCommitted(m.attempt_ref,observer),e=peer.effect(token);assert.deepEqual(peer.effect(token),e);await receive(g,e);peer.restore();
   const {default:pg}=await import('pg');const admin=new pg.Client();await admin.connect();const restoredName='v2_restore_'+randomUUID().replaceAll('-','');await admin.query('create database '+restoredName);const restored=new pg.Client({database:restoredName});await restored.connect();
   try{
    await restored.query('create extension pgcrypto');
    for(const f of ['psttg-capture-core-v1','psttg-removal-evaluation-v1','psttg-k5-synthetic-control-v1'])await restored.query(await readFile(new URL('../database/'+f+'.sql',import.meta.url),'utf8'));
    const v2=await readFile(new URL('../database/psttg-representation-v2.sql',import.meta.url),'utf8'),v2at=v2.indexOf('do $$declare t text;r record;begin');await restored.query(v2.slice(0,v2at)+'commit;');
    // Restore construction before the immutable fixture protections are installed.
    // No installed protection is disabled and no restoration helper remains callable.
    await restored.query('create trigger v2_immutable before update or delete on dv_market_private.psttg_unit_guard for each row execute function dv_market_private.psttg_v2_guard_immutable()');
    const addon=await readFile(new URL('../database/psttg-v2-writer-unitmanifest-v1.sql',import.meta.url),'utf8'),at=addon.indexOf('-- PROTECTION INSTALLATION:');await restored.query(addon.slice(0,at)+'commit;');
    await restored.query('begin');
    for(const t of ['psttg_scope_guards','psttg_v2_channel_v1','psttg_object_anchor','psttg_unit_guard','psttg_content_unit','psttg_unit_binding','psttg_v2_origin_head_v1','psttg_v2_use_admission_v1','psttg_v2_integration_entry_v1','psttg_k5_unitmanifest_v1','psttg_k5_unitattempt_v1'])await restored.query(`insert into dv_market_private.${t} select * from jsonb_populate_recordset(null::dv_market_private.${t},$1::jsonb)`,[JSON.stringify(image[t])]);
    await restored.query('commit');
    const tail=v2.slice(v2at).replace("  execute format('create trigger v2_immutable", "  if t<>'psttg_unit_guard' then execute format('create trigger v2_immutable").replace("else 'psttg_reject_mutation' end);", "else 'psttg_reject_mutation' end);end if;");
    await restored.query('begin;'+tail);await restored.query('begin;'+addon.slice(at));
    assert.equal(await val('select execution_epoch::int v from dv_market_private.psttg_v2_channel_v1 where channel_id=$1',[g.channel_id],restored),0);
    await deny(()=>call('psttg_v2_execute_v1',[begin,{},oldTicket,oldSignature,key],restored),/v2_ticket_binding/);
    const n={contract:'psttg-k5-unitmanifest/1',action:'RESTORE_QUARANTINE',channel:g.channel_id,external_incarnation:peer.incarnation};await call('psttg_v2_quarantine_v1',[g.channel_id,n,await sign(g,n,restored)],restored);
    assert.equal(await val('select state v from dv_market_private.psttg_k5_unitattempt_v1 where manifest_id=$1 order by state_revision desc limit 1',[m.manifest_ref],restored),'QUARANTINE');
    await deny(()=>invoke(g,transition(g,a,'ATTEMPTING',1,randomUUID(),1),{},restored),/v2_restore_quarantine/);await deny(()=>call('psttg_v2_read',[a.input_group,key,2],restored),/v2_restore_quarantine/);
    const receipt=await receive(g,e,restored);assert.equal(await receive(g,e,restored),receipt);assert.equal(await val('select count(*)::int v from dv_market_private.psttg_unit_end_receipt',[],restored),0);
    assert.equal(peer.effects.size,1);await deny(async()=>peer.effect(token),/peer_stale_or_revoked/);assert.equal(await val('select count(*)::int v from dv_market_private.psttg_content_unit where object_id=$1',[r.object_id],restored),3);
    out.restore='second PostgreSQL 17 database, pre-attempt logical image; peer incarnation and simulated effect journal outside restore boundary; no physical restore or deletion claim';
   }finally{await restored.end();await admin.query('drop database '+restoredName);await admin.end()}
  });
 }
 out.acceptance=native;out.passed=true;
}catch(e){throw new Error(String(e.message).split('\n')[0]);}finally{await mkdir('test-results',{recursive:true});await writeFile(`test-results/psttg-v2-connection-${native?'native':'local'}.json`,JSON.stringify(out,null,2));await db.close()}
