// G2 transition integrity only. Synthetic/local, no live database or provider calls.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {securitySchemaFixture,read} from './helpers/security-schema-fixture.mjs';
import {securityQuery} from './generate-security-readiness.mjs';
const native=process.argv.includes('--native');let db;
if(native){const {createDatabase}=await import('./helpers/f3-native-db.mjs');db=await createDatabase()}
else{const {PGlite}=await import('@electric-sql/pglite'),{pgcrypto}=await import('@electric-sql/pglite/contrib/pgcrypto');db=new PGlite({extensions:{pgcrypto}})}
const report={engine:native?'native-postgresql17':'pglite',version:db.version||null,synthetic:true,liveApplied:false,cases:[],passed:false};
const pass=s=>{report.cases.push(s);console.log('PASS:',s)};
const uid=n=>`70000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const [A,B,OWNER]=[1,2,3].map(uid),users=[A,B];
const scalar=async(sql,args=[])=>(await db.query(sql,args)).rows[0].v;
const claim=async(u,role='authenticated',client=db)=>{await client.query('reset role');await client.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:u,role,aal:'aal1'})]);await client.query('set role '+role)};
const profile=u=>scalar('select to_jsonb(p) v from public.profiles p where id=$1',[u]);
const visible=u=>scalar('select count(*)::int v from public.get_public_duelvanta_collection($1)',[u===A?'g2_a':'g2_b']);
const rpc=(visibility,client=db)=>client.query('select public.set_my_public_profile(null,$1,null)',[visibility]);
const ready=()=>scalar('select public.get_market_legal_schema_readiness_v1() v');
const deny=async(sql,args=[],pattern=/account_closure_collection_private/)=>{await db.exec('savepoint denied');try{await assert.rejects(()=>db.query(sql,args),pattern)}finally{await db.exec('rollback to savepoint denied;release savepoint denied')}};
try{
 await securitySchemaFixture(db);
 for(const [u,email,role] of [[OWNER,'info@duelvanta.de','owner'],[A,'g2-a@example.invalid','player'],[B,'g2-b@example.invalid','player']]){
  await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[u,email]);
  await db.query("insert into public.profiles(id,email,role,account_status,age_band,username) values($1,$2,$3,'active','18_plus',$4)",[u,email,role,u===A?'g2_a':u===B?'g2_b':null]);
 }
 for(const f of ['auth-privileged-step-up-v1','security-privilege-mfa-hardening-v1','security-readiness-v1','market-production-trade-lock-v1','market-production-trade-lock-readiness-v1','account-data-export-collect-battle-v1','account-data-export-trade-lock-readiness-v1','account-processing-markers-v1','account-processing-markers-readiness-v1'])await db.exec(await read('database/'+f+'.sql'));
 assert.equal((await ready()).compatible,true);
 for(const [i,u] of users.entries()){
  await db.query("insert into public.collection_folders(id,user_id,name,is_public) values($1,$2,'G2 public binder',true)",[uid(20+i),u]);
  await db.query("insert into public.collection_items(id,user_id,tcg,card_name,folder_id) values($1,$2,'pokemon','G2 own card',$3)",[uid(30+i),u,uid(20+i)]);
 }
 // Reproduce the existing G2 leak with actual closure RPC and both publishing modes.
 for(const u of users)for(const mode of ['public','custom']){
  await db.exec('begin');await claim(u);
  assert.equal((await scalar("select public.request_my_account_deletion('KONTO LÖSCHEN',$1) v",[uid(40)])).accepted,true);
  assert.equal(await visible(u),0);await rpc(mode);assert.equal(await visible(u),1);
  await db.exec('rollback;reset role');
 }
 pass('A/B baseline: real Closure then public/custom RPC republishes existing card; rolled back');
 report.baseline={profilePolicies:(await db.query("select * from pg_policies where schemaname='public' and tablename in ('profiles','collection_folders','collection_items')")).rows,visibilityFunctions:(await db.query("select n.nspname,p.proname,p.prosecdef,pg_get_userbyid(p.proowner) owner,p.proacl::text,pg_get_functiondef(p.oid) definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','dv_market_private') and (p.prosrc like '%collection_visibility%' or p.proname in ('set_my_collection_folder_visibility','can_update_own_profile_safe','protect_account_processing_markers_v1')) order by 1,2")).rows};
 const before=(await db.query(securityQuery)).rows[0].jsonb_agg;
 const candidate=await read('database/account-closure-privacy-v1.sql');await db.exec(candidate);await db.exec(candidate);
 const after=(await db.query(securityQuery)).rows[0].jsonb_agg;
 assert.deepEqual(after.filter(x=>!before.some(y=>JSON.stringify(x)===JSON.stringify(y))).map(x=>x[1]),['dv_market_private.protect_account_closure_privacy_v1()']);
 assert.equal(before.filter(x=>!after.some(y=>y[0]===x[0]&&y[1]===x[1])).length,0);
 assert.equal((await ready()).compatible,false);await db.exec(await read('database/account-closure-privacy-readiness-v1.sql'));assert.equal((await ready()).compatible,true);
 pass('idempotent candidate: one new private trigger function; existing functions, G1, ACL/RLS and read RPCs unchanged; matching readiness');
 for(const u of users)for(const state of ['normal','processing_only','closure_private','closure_package','closure_public']){
  const other=u===A?B:A;await db.exec('begin');
  if(state==='processing_only')await db.query('update public.profiles set data_processing_restricted_at=now() where id=$1',[u]);
  if(state==='closure_private'||state==='closure_public')await db.query("update public.profiles set account_closure_requested_at=now(),collection_visibility=$2 where id=$1",[u,state==='closure_private'?'private':'public']);
  if(state==='closure_package'){await claim(u);assert.equal((await scalar("select public.request_my_account_deletion('KONTO LÖSCHEN',$1) v",[uid(41)])).accepted,true);await db.exec('reset role')}
  const closed=['closure_private','closure_package'].includes(state),original=await profile(u),foreign=await profile(other);
  await claim(u);
  for(const mode of ['public','custom']){
   if(closed){
    await deny('select public.set_my_public_profile(null,$1,null)',[mode]);
    await deny('update public.profiles set collection_visibility=$1 where id=$2',[mode,u]);
    assert.deepEqual(await profile(u),original);assert.equal(await visible(u),0);
   }else{
    await rpc(mode);assert.equal(await visible(u),1);
    await db.query('update public.profiles set collection_visibility=$1 where id=$2',[mode,u]);assert.equal(await visible(u),1);
   }
  }
  await rpc(null);await rpc('private');assert.equal(await visible(u),0);
  // Once private is actually established with Closure, the transition now blocks.
  if(state==='closure_public')await deny('select public.set_my_public_profile(null,$1,null)',['public']);
  await db.query("update public.profiles set display_name='G2 allowed',collection_visibility=collection_visibility where id=$1",[u]);
  await db.query("select public.set_my_locale('en')");
  await db.query('select public.set_my_public_profile(null,null,$1)',[u+'/synthetic-avatar.webp']);
  const current=await profile(u);assert.equal(current.display_name,'G2 allowed');assert.equal(current.collection_visibility,'private');
  for(const field of ['account_closure_requested_at','data_processing_restricted_at'])assert.equal(current[field],original[field]);
  const f=await db.query("update public.profiles set collection_visibility='public',display_name='FOREIGN' where id=$1 returning id",[other]);assert.equal(f.rows.length,0);
  await deny('select public.set_my_public_profile(null,$1,null,$2)',['public',other],/does not exist/);
  await deny("insert into public.profiles(id,email,collection_visibility) values($1,'replacement@example.invalid','public') on conflict(id) do update set collection_visibility='public'",[u],/permission denied/);
  // Existing folder behavior is observed, not changed. A public folder cannot
  // override the private profile-level gate in the unchanged read RPC.
  if(current.data_processing_restricted_at)await deny('select public.set_my_collection_folder_visibility($1,true)',[uid(u===A?20:21)],/account_data_processing_restricted/);
  else await db.query('select public.set_my_collection_folder_visibility($1,true)',[uid(u===A?20:21)]);
  assert.equal(await visible(u),0);
  await claim(other);await rpc('public');assert.equal(await visible(other),1);
  await db.exec('reset role');const fafter=await profile(other);for(const field of ['id','email','role','account_closure_requested_at','data_processing_restricted_at','display_name'])assert.equal(fafter[field],foreign[field]);
  await db.exec('rollback');pass(`${u===A?'A':'B'} ${state}: direct/RPC transitions, normal fields, markers, foreign and folder/public-read boundaries`);
 }
 // Existing SECURITY DEFINER elevates current_user. Guard deliberately has no
 // current_user/JWT/service-role bypass, so the same state invariant applies.
 for(const u of users){
  await db.exec('begin');await claim(u);await db.query("select public.request_my_account_deletion('KONTO LÖSCHEN',$1)",[uid(42)]);
  const original=await profile(u);
  await db.query("select set_config('request.jwt.claims',$1,false),set_config('app.allow_closure_publish','true',false)",[JSON.stringify({sub:u,role:'service_role',aal:'aal2'})]);
  await deny("select public.set_my_public_profile(null,'public',null)");
  for(const role of ['service_role','postgres']){
   await claim(u,role);await deny("select public.set_my_public_profile(null,'public',null)");
   await deny("update public.profiles set collection_visibility='custom' where id=$1",[u],role==='service_role'?/permission denied/:/account_closure_collection_private/);
  }
  await claim(u);await deny('update public.profiles set account_closure_requested_at=null,data_processing_restricted_at=null where id=$1',[u],/account_processing_markers_protected|row-level security/);
  assert.deepEqual(await profile(u),original);
  await db.exec('reset role');const count=await scalar('select count(*)::int v from dv_market_private.user_data_export_events');
  await claim(u);assert.equal((await scalar('select public.export_my_duelvanta_data() v')).export_version,'duelvanta-data-export-v3');
  await db.exec('reset role');assert.equal(await scalar('select count(*)::int v from dv_market_private.user_data_export_events'),count+1);
  assert.deepEqual(await profile(u),original);await db.exec('rollback');pass(`${u===A?'A':'B'} Definer/service/owner and spoofing cannot republish; G1 and export preserved`);
 }
 for(const sql of ['alter table public.profiles disable trigger protect_account_closure_privacy_v1','drop trigger protect_account_closure_privacy_v1 on public.profiles']){
  await db.exec('begin');await db.exec(sql);assert.equal((await ready()).compatible,false);await db.exec('rollback');
 }
 pass('missing/disabled G2 trigger fails readiness closed');
 if(native){
  for(const [i,u] of users.entries()){
   const writer=await db.connect(),observer=await db.connect();
   await db.exec('begin');await claim(u);await db.query("select public.request_my_account_deletion('KONTO LÖSCHEN',$1)",[uid(43)]);
   await claim(u,'authenticated',writer);const pid=(await writer.query('select pg_backend_pid() pid')).rows[0].pid;
   const pending=(i===0?rpc('public',writer):writer.query("update public.profiles set collection_visibility='custom' where id=$1",[u])).then(()=>({ok:true}),e=>({ok:false,error:e.message}));
   let blocked=false;for(let k=0;k<100;k++){if((await observer.query('select cardinality(pg_blocking_pids($1)) n',[pid])).rows[0].n>0){blocked=true;break}await new Promise(r=>setTimeout(r,20))}
   assert.equal(blocked,true);await db.exec('commit;reset role');const r=await pending;assert.equal(r.ok,false);assert.match(r.error,/account_closure_collection_private/);
   assert.equal((await profile(u)).collection_visibility,'private');assert.equal(await visible(u),0);
   pass(`native ${i===0?'RPC public':'DML custom'} waiting behind real Closure commit cannot republish`);
  }
 }
 assert.equal((await ready()).compatible,true);report.passed=true;
}catch(e){report.error={message:e.message,detail:e.detail,where:e.where};console.error(report.error);process.exitCode=1}
finally{try{await db.exec('rollback;reset role')}catch{}await db.close();report.cleanup='disposable database closed/deleted';await mkdir('test-results',{recursive:true});await writeFile(`test-results/account-closure-privacy-${native?'native':'wasm'}.json`,JSON.stringify(report,null,2))}
