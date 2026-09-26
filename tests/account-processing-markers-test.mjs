// G1 only: synthetic disposable DB, no network/provider/live project access.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {securitySchemaFixture,read} from './helpers/security-schema-fixture.mjs';
import {securityQuery} from './generate-security-readiness.mjs';
const native=process.argv.includes('--native');
let db;
if(native){const {createDatabase}=await import('./helpers/f3-native-db.mjs');db=await createDatabase()}
else{const {PGlite}=await import('@electric-sql/pglite'),{pgcrypto}=await import('@electric-sql/pglite/contrib/pgcrypto');db=new PGlite({extensions:{pgcrypto}})}
const report={engine:native?'native-postgresql17':'pglite',version:db.version||null,synthetic:true,liveApplied:false,cases:[],passed:false};
const pass=s=>{report.cases.push(s);console.log('PASS:',s)};
const uid=n=>`69000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const [A,B,OWNER]=[1,2,3].map(uid);
const fields=['data_processing_restricted_at','account_closure_requested_at'];
const scalar=async(sql,args=[])=>(await db.query(sql,args)).rows[0].v;
const claim=async(u,role='authenticated',client=db)=>{
 await client.query('reset role');
 await client.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:u,role,aal:'aal1'})]);
 await client.query('set role '+role);
};
const deny=async(sql,args=[],pattern=/account_processing_markers_protected|row-level security|permission denied/)=>{
 await db.exec('savepoint denied');
 try{await assert.rejects(()=>db.query(sql,args),pattern)}finally{await db.exec('rollback to savepoint denied;release savepoint denied')}
};
const markers=u=>scalar('select jsonb_build_array(data_processing_restricted_at,account_closure_requested_at) v from public.profiles where id=$1',[u]);
const insert=u=>db.query("insert into public.collection_items(user_id,tcg,card_name) values($1,'pokemon','G1 synthetic card')",[u]);
const profiles=()=>scalar('select jsonb_agg(to_jsonb(p) order by id) v from public.profiles p');
const ready=()=>scalar('select public.get_market_legal_schema_readiness_v1() v');
try{
 await securitySchemaFixture(db);
 for(const [u,email,role] of [[OWNER,'info@duelvanta.de','owner'],[A,'g1-a@example.invalid','player'],[B,'g1-b@example.invalid','player']]){
  await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[u,email]);
  await db.query("insert into public.profiles(id,email,role,account_status,age_band) values($1,$2,$3,'active','18_plus')",[u,email,role]);
 }
 for(const f of ['auth-privileged-step-up-v1','security-privilege-mfa-hardening-v1','security-readiness-v1','market-production-trade-lock-v1','market-production-trade-lock-readiness-v1','account-data-export-collect-battle-v1','account-data-export-trade-lock-readiness-v1'])await db.exec(await read('database/'+f+'.sql'));
 assert.equal((await ready()).compatible,true);
 // Observe the real baseline exploit before installing G1, then roll back.
 for(const u of [A,B]){
  await db.exec('begin');await db.query("update public.profiles set data_processing_restricted_at=now(),account_closure_requested_at=now() where id=$1",[u]);
  await claim(u);await db.query('update public.profiles set data_processing_restricted_at=null,account_closure_requested_at=null where id=$1',[u]);await insert(u);
  await db.exec('rollback;reset role');
 }
 pass('both users reproduce baseline self-unlock plus Collection write; rolled back');
 report.baseline={profile:(await db.query("select relacl::text,relrowsecurity from pg_class where oid='public.profiles'::regclass")).rows,policies:(await db.query("select * from pg_policies where schemaname='public' and tablename='profiles'")).rows};
 const before=(await db.query(securityQuery)).rows[0].jsonb_agg;
 const oldSafe=await scalar("select pg_get_functiondef('public.can_update_own_profile_safe(public.profiles)'::regprocedure) v");
 const oldRights=await scalar("select proacl::text v from pg_proc where oid='public.can_update_own_profile_safe(public.profiles)'::regprocedure");
 const candidate=await read('database/account-processing-markers-v1.sql');
 await db.exec(candidate);await db.exec(candidate);
 const after=(await db.query(securityQuery)).rows[0].jsonb_agg;
 assert.deepEqual(after.filter(x=>!before.some(y=>JSON.stringify(x)===JSON.stringify(y))).map(x=>x[1]).sort(),['dv_market_private.protect_account_processing_markers_v1()','public.can_update_own_profile_safe(p_row profiles)'].sort());
 assert.equal(before.filter(x=>!after.some(y=>y[0]===x[0]&&y[1]===x[1])).length,0);
 assert.equal(await scalar("select proacl::text v from pg_proc where oid='public.can_update_own_profile_safe(public.profiles)'::regprocedure"),oldRights);
 assert.equal((await ready()).compatible,false);
 await db.exec(await read('database/account-processing-markers-readiness-v1.sql'));assert.equal((await ready()).compatible,true);
 report.profileWriters=(await db.query("select n.nspname,p.proname,p.prosecdef,pg_get_userbyid(p.proowner) owner,p.proacl::text,pg_get_functiondef(p.oid) definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','dv_market_private') and p.prosrc ~* '(update[[:space:]]+(public[.])?profiles|insert[[:space:]]+into[[:space:]]+(public[.])?profiles)' order by 1,2")).rows;
 report.triggers=(await db.query("select tgname,tgenabled,pg_get_triggerdef(oid) definition from pg_trigger where tgrelid='public.profiles'::regclass and not tgisinternal order by tgname")).rows;
 pass('idempotent G1: exactly two function changes, one trigger; existing ACL/RLS unchanged; matching readiness');
 for(const u of [A,B])for(const state of ['clear','processing','closure','package']){
  const other=u===A?B:A;
  await db.exec('reset role;begin');
  await db.query("update public.profiles set data_processing_restricted_at=case when $2 in ('processing','package') then '2026-09-01'::timestamptz end,account_closure_requested_at=case when $2 in ('closure','package') then '2026-09-02'::timestamptz end,safety_restricted=($2='package') where id=$1",[u,state]);
  const original=await markers(u),foreign=await scalar('select to_jsonb(p) v from public.profiles p where id=$1',[other]);
  await claim(u);
  for(const field of fields){
   for(const value of ['null',"'2026-08-01'::timestamptz","'infinity'::timestamptz"]){
    const index=fields.indexOf(field);
    if(value==='null'&&original[index]===null)continue;
    await deny(`update public.profiles set ${field}=${value} where id=$1`,[u]);
    assert.deepEqual(await markers(u),original);
   }
  }
  for(const field of fields){
   assert.equal(await scalar(`select public.can_update_own_profile_safe(jsonb_populate_record(p,jsonb_build_object('${field}','2030-01-01T00:00:00Z'))) v from public.profiles p where id=$1`,[u]),false);
  }
  await db.query("update public.profiles set display_name='G1 allowed',data_processing_restricted_at=data_processing_restricted_at,account_closure_requested_at=account_closure_requested_at where id=$1",[u]);
  assert.equal(await scalar('select display_name v from public.profiles where id=$1',[u]),'G1 allowed');
  await db.query("select public.set_my_locale('de')");
  await db.query("select public.set_my_public_profile(null,'private',null)");
  assert.deepEqual(await markers(u),original);
  const foreignRows=await db.query("update public.profiles set display_name='FOREIGN',data_processing_restricted_at=now(),account_closure_requested_at=now() where id=$1 returning id",[other]);
  assert.equal(foreignRows.rows.length,0);
  await deny("update public.profiles set role='admin' where id=$1",[u]);
  await deny("insert into public.profiles(id,email) values($1,'replacement@example.invalid') on conflict(id) do update set data_processing_restricted_at=null",[u]);
  if(['processing','package'].includes(state))await deny("insert into public.collection_items(user_id,tcg,card_name) values($1,'pokemon','blocked after unlock attempt')",[u],/account_data_processing_restricted/);
  else await insert(u); // Closure alone does not invent new Hold semantics.
  await claim(other);await insert(other);
  await db.exec('reset role');assert.deepEqual(await scalar('select to_jsonb(p) v from public.profiles p where id=$1',[other]),foreign);
  await db.exec('rollback');pass(`${u===A?'A':'B'} ${state}: marker mutations denied, unchanged markers/profile RPCs allowed, Collection and foreign boundaries`);
 }
 // The invoker trigger remains effective if the old RLS helper is restored in a
 // test-only transaction, including spoofed JWT roles and custom GUCs.
 await db.exec('begin');await db.exec(oldSafe);
 await db.query('update public.profiles set data_processing_restricted_at=now(),account_closure_requested_at=now() where id=$1',[A]);
 await claim(A);await db.query("select set_config('request.jwt.claims',$1,false),set_config('app.allow_processing_marker_update','true',false)",[JSON.stringify({sub:A,role:'service_role',aal:'aal2'})]);
 await deny('update public.profiles set data_processing_restricted_at=null,account_closure_requested_at=null where id=$1',[A],/account_processing_markers_protected/);
 await db.exec('rollback;reset role');pass('invoker trigger independently rejects marker writes despite old RLS helper, spoofed JWT and GUC');
 // Existing internal setter and replay: execute only in rollback transactions.
 for(const u of [A,B]){
  await db.exec('begin');await claim(u);
  const request=await scalar("select public.request_my_account_deletion('KONTO LÖSCHEN',$1) v",[uid(10)]);assert.equal(request.accepted,true);assert.equal(request.replayed,false);
  const held=await markers(u);assert.ok(held.every(Boolean));
  const replay=await scalar("select public.request_my_account_deletion('KONTO LÖSCHEN',$1) v",[uid(10)]);assert.equal(replay.replayed,true);assert.deepEqual(await markers(u),held);
  await deny('update public.profiles set data_processing_restricted_at=null,account_closure_requested_at=null where id=$1',[u]);
  await deny("insert into public.collection_items(user_id,tcg,card_name) values($1,'pokemon','after internal setter')",[u],/account_data_processing_restricted/);
  await db.exec('reset role');assert.equal(await scalar("select count(*)::int v from dv_market_private.account_data_rights_audit where user_id=$1 and event_type='deletion_requested'",[u]),1);
  const beforeProfiles=await profiles();
  const auditBefore=await scalar('select count(*)::int v from dv_market_private.user_data_export_events');
  await claim(u);const data=await scalar('select public.export_my_duelvanta_data() v');assert.equal(data.export_version,'duelvanta-data-export-v3');
  await db.exec('reset role');assert.deepEqual(await profiles(),beforeProfiles);assert.equal(await scalar('select count(*)::int v from dv_market_private.user_data_export_events'),auditBefore+1);
  assert.equal(await scalar("select count(*)::int v from dv_market_private.user_data_export_events where user_id_hash=extensions.digest($1,'sha256') and content_sha256=extensions.digest($2::jsonb::text,'sha256')",[u,JSON.stringify(data)]),1);
  await db.exec('rollback');pass(`${u===A?'A':'B'} trusted closure setter/replay/audit preserved; export under hold has one hash-bound audit event`);
 }
 for(const u of [null,A,B])for(const role of ['anon','service_role']){
  await db.exec('begin');await claim(u,role);
  await deny('update public.profiles set data_processing_restricted_at=null,account_closure_requested_at=null where id=$1',[A],/permission denied/);
  await deny('select dv_market_private.protect_account_processing_markers_v1()',[],/permission denied/);
  await db.exec('rollback;reset role');
 }
 pass('anon/service_role direct DML and private trigger ACL denied with and without subject');
 for(const u of [null,A,B]){
  await db.exec('begin');await claim(u,'service_role');
  if(u){const r=await scalar("select public.request_my_account_deletion('KONTO LÖSCHEN',$1) v",[uid(11)]);assert.equal(r.accepted,true);assert.ok((await markers(u)).every(Boolean));}
  else await deny("select public.request_my_account_deletion('KONTO LÖSCHEN',$1)",[uid(11)],/authentication_required/);
  await db.exec('rollback;reset role');
 }
 pass('existing service SECURITY DEFINER setter requires subject and preserves its existing subject-bound ACL');
 // Privileged database owner is the existing maintenance/definer boundary,
 // independent of a retained subject. No new callable unlock RPC is created.
 await db.exec('begin');await claim(A,'postgres');
 await db.query('update public.profiles set data_processing_restricted_at=now(),account_closure_requested_at=now() where id=$1',[A]);
 assert.ok((await markers(A)).every(Boolean));await db.exec('rollback;reset role');
 for(const sql of ['alter table public.profiles disable trigger protect_account_processing_markers_v1','drop trigger protect_account_processing_markers_v1 on public.profiles']){
  await db.exec('begin');await db.exec(sql);assert.equal((await ready()).compatible,false);await db.exec('rollback');
 }
 pass('existing owner context retained; missing/disabled trigger fails readiness closed');
 if(native){
  // Start the client UPDATE while an internal marker transaction holds the row.
  // PostgreSQL must use the actual locked OLD row after that transaction commits.
  const writer=await db.connect(),observer=await db.connect();
  await db.exec('begin');await db.query('update public.profiles set data_processing_restricted_at=now(),account_closure_requested_at=now() where id=$1',[A]);
  await claim(A,'authenticated',writer);const pid=(await writer.query('select pg_backend_pid() pid')).rows[0].pid;
  const pending=writer.query('update public.profiles set data_processing_restricted_at=null,account_closure_requested_at=null where id=$1',[A]).then(()=>({ok:true}),e=>({ok:false,error:e.message}));
  let blocked=false;for(let i=0;i<100;i++){const r=await observer.query('select cardinality(pg_blocking_pids($1)) n',[pid]);if(r.rows[0].n>0){blocked=true;break}await new Promise(r=>setTimeout(r,20))}
  assert.equal(blocked,true,'real row-lock contention observed');await db.exec('commit');
  const result=await pending;assert.equal(result.ok,false);assert.match(result.error,/account_processing_markers_protected|row-level security/);
  assert.ok((await markers(A)).every(Boolean));
  await claim(A);await assert.rejects(()=>insert(A),/account_data_processing_restricted/);await db.exec('reset role');
  pass('native concurrent internal marker commit cannot be cleared by waiting self UPDATE; Collection remains blocked');
 }
 assert.equal((await ready()).compatible,true);report.passed=true;
} catch(e){report.error={message:e.message,detail:e.detail,where:e.where};console.error(report.error);process.exitCode=1}
finally{try{await db.exec('rollback;reset role')}catch{}await db.close();report.cleanup='disposable database closed/deleted';await mkdir('test-results',{recursive:true});await writeFile(`test-results/account-processing-markers-${native?'native':'wasm'}.json`,JSON.stringify(report,null,2))}
