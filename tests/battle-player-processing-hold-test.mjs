// G4 actor admission only; synthetic disposable DB, no media/network/provider.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {mkdir,writeFile} from 'node:fs/promises';
import {securitySchemaFixture,read} from './helpers/security-schema-fixture.mjs';
import {securityQuery} from './generate-security-readiness.mjs';
const native=process.argv.includes('--native');let db;
if(native){const {createDatabase}=await import('./helpers/f3-native-db.mjs');db=await createDatabase()}
else{const {PGlite}=await import('@electric-sql/pglite'),{pgcrypto}=await import('@electric-sql/pglite/contrib/pgcrypto');db=new PGlite({extensions:{pgcrypto}})}
const report={engine:native?'native-postgresql17':'pglite',version:db.version||null,synthetic:true,liveApplied:false,cases:[],passed:false};
const pass=s=>{report.cases.push(s);console.log('PASS:',s)};
const uid=n=>`72000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const [A,B,C,OWNER]=[1,2,3,4].map(uid),users=[A,B];let seq=100;
const scalar=async(sql,args=[],client=db)=>(await client.query(sql,args)).rows[0].v;
const claim=async(u,role='authenticated',client=db)=>{await client.query('reset role');await client.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:u,role,aal:'aal1'})]);await client.query('set role '+role)};
const ready=()=>scalar('select public.get_market_legal_schema_readiness_v1() v');
const tx=async(fn)=>{await db.exec('begin');try{await fn()}finally{await db.exec('rollback;reset role')}};
const deny=async(sql,args=[],pattern=/account_data_processing_restricted/)=>{await db.exec('savepoint denied');try{await assert.rejects(()=>db.query(sql,args),pattern)}finally{await db.exec('rollback to savepoint denied;release savepoint denied')}};
const state=async(u,s)=>{
 await db.exec('reset role');
 if(s==='closure'){await claim(u);assert.equal((await scalar("select public.request_my_account_deletion('KONTO LÖSCHEN',$1) v",[uid(seq++)])).accepted,true)}
 if(s==='processing')await db.query('update public.profiles set data_processing_restricted_at=now() where id=$1',[u]);
 if(s==='safety')await db.query('update public.profiles set safety_restricted=true where id=$1',[u]);
 await db.exec('reset role');
};
const match=async(host,guest=null,status='waiting',visibility='public',mode='casual')=>{
 const id=uid(seq++);await db.query("insert into public.battle_matches(id,host_id,guest_id,tcg,status,visibility,invite_code,mode,host_ready,guest_ready) values($1,$2,$3,'pokemon',$4,$5,$7,$6,true,true)",[id,host,guest,status,visibility,mode,visibility==='private'?id.slice(-6):null]);return id;
};
const snapshot=async()=>{await db.exec('reset role');return scalar("select coalesce(jsonb_agg(to_jsonb(m) order by id),'[]') v from public.battle_matches m")};
const actions=['create_legacy','create_casual','create_ranked','create_private','join_id','join_code','join_private_id','join_host_replay','ready_host_true','ready_host_false','ready_guest_true','ready_guest_false','start'];
async function setup(u,action){
 await db.exec('reset role');const other=u===A?B:A;
 if(action.startsWith('create'))return{sql:action==='create_legacy'?"select public.create_battle_match('pokemon','public','G4','de') v":`select public.create_battle_match_v2('pokemon','${action==='create_private'?'private':'public'}','G4','de','${action==='create_ranked'?'ranked':'casual'}') v`,args:[]};
 if(action.startsWith('join')){
  const m=await match(action==='join_host_replay'?u:other,null,'waiting',action==='join_code'||action==='join_private_id'?'private':'public');
  return{sql:'select public.join_battle_match($1,$2) v',args:[action==='join_code'?null:m,action==='join_code'||action==='join_private_id'?m.slice(-6):null],m};
 }
 const guest=action.startsWith('ready_guest'),m=await match(guest?other:u,guest?u:other,'ready');
 return{sql:action==='start'?'select public.start_battle_match($1) v':'select public.set_battle_ready($1,$2) v',args:action==='start'?[m]:[m,!action.endsWith('false')],m};
}
try{
 await securitySchemaFixture(db);
 for(const [u,email,role] of [[OWNER,'info@duelvanta.de','owner'],[A,'g4-a@example.invalid','player'],[B,'g4-b@example.invalid','player'],[C,'g4-c@example.invalid','player']]){
  await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[u,email]);
  await db.query("insert into public.profiles(id,email,role,account_status,age_band,conduct_accepted_at,conduct_version) values($1,$2,$3,'beta','18_plus',now(),'battle-v1-2026-09')",[u,email,role]);
 }
 await db.query("update public.profiles set account_status='active' where id=$1",[B]);
 for(const f of ['auth-privileged-step-up-v1','security-privilege-mfa-hardening-v1','security-readiness-v1','market-production-trade-lock-v1','market-production-trade-lock-readiness-v1','account-data-export-collect-battle-v1','account-data-export-trade-lock-readiness-v1','account-processing-markers-v1','account-processing-markers-readiness-v1','account-closure-privacy-v1','account-closure-privacy-readiness-v1','scanner-processing-hold-v1','scanner-processing-hold-readiness-v1'])await db.exec(await read('database/'+f+'.sql'));
 for(const u of users)for(const action of actions)await tx(async()=>{const q=await setup(u,action);await state(u,'processing');await claim(u);await db.query(q.sql,q.args)});
 pass('A/B baseline: all 13 Create/Join/Ready/Start variants succeed with Processing-only; rolled back');
 report.functions=(await db.query("select p.oid,n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) args,p.prosecdef,pg_get_userbyid(p.proowner) owner,p.proacl::text,p.proconfig,pg_get_functiondef(p.oid) definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like '%battle%' order by 2,3,4")).rows;
 assert.deepEqual(report.functions.filter(x=>x.proname.startsWith('create_battle')).map(x=>x.proname).sort(),['create_battle_match','create_battle_match_v2']);
 report.policies=(await db.query("select * from pg_policies where schemaname='public' and tablename in ('battle_matches','battle_reports','battle_ratings','battle_rating_events') order by tablename,policyname")).rows;
 const before=(await db.query(securityQuery)).rows[0].jsonb_agg;
 const candidate=await read('database/battle-player-processing-hold-v1.sql');await db.exec(candidate);await db.exec(candidate);
 const after=(await db.query(securityQuery)).rows[0].jsonb_agg;
 assert.deepEqual(after.filter(x=>!before.some(y=>JSON.stringify(x)===JSON.stringify(y))).map(x=>x[1].split('(')[0]).sort(),['public.create_battle_match_v2','public.join_battle_match','public.set_battle_ready','public.start_battle_match']);assert.equal(before.length,after.length);
 for(const p of report.functions){const r=(await db.query('select proacl::text,prosecdef,proconfig,pg_get_userbyid(proowner) owner from pg_proc where oid=$1',[p.oid])).rows[0];assert.deepEqual(r,{proacl:p.proacl,prosecdef:p.prosecdef,proconfig:p.proconfig,owner:p.owner})}
 assert.equal((await ready()).compatible,false);await db.exec(await read('database/battle-player-processing-hold-readiness-v1.sql'));assert.equal((await ready()).compatible,true);
 pass('exactly four admission bodies changed; legacy wrapper, completion, ratings, reports, ACL/RLS and Definer metadata unchanged; matching readiness');
 if(process.argv.includes('--battle-signal-hold')){
  await db.exec(await read('database/battle-signal-processing-hold-v1.sql'));
  await db.exec(await read('database/battle-signal-processing-hold-readiness-v1.sql'));
 }
 if(process.argv.includes('--spectator-withdrawal')){
  await db.exec(await read('database/battle-spectator-withdrawal-v1.sql'));
  await db.exec(await read('database/battle-spectator-withdrawal-readiness-v1.sql'));
 }
 for(const u of users)for(const s of ['normal','processing','closure','safety']){
  for(const action of actions)await tx(async()=>{
   const q=await setup(u,action);await state(u,s);const before=await snapshot();await claim(u);
   if(s==='normal'){await db.query(q.sql,q.args);if(action==='start'){await db.exec('reset role');assert.equal(await scalar('select status v from public.battle_matches where id=$1',[q.m]),'live')}}
   else{await deny(q.sql,q.args,s==='processing'?/account_data_processing_restricted/:/battle_account_unavailable|BATTLE ist für diesen Account eingeschränkt/);assert.deepEqual(await snapshot(),before)}
   // A separate unheld actor can still create; no global Battle block.
   await claim(C);await db.query("select public.create_battle_match_v2('one_piece','public','Control','de','ranked')");
  });pass(`${u===A?'A':'B'} ${s}: 13 admission variants; denied calls preserve matches; independent control actor works`);
 }
 for(const u of users)for(const s of ['normal','processing','closure'])await tx(async()=>{
  const other=u===A?B:A,m=await match(u,other,'live','public','ranked'),waiting=await match(u),asGuest=await match(other,u,'ready');
  await state(u,s);await claim(u);
  assert.equal(await scalar("select public.report_battle_result($1,'host') v",[m]),'live');
  await claim(other);assert.equal(await scalar("select public.report_battle_result($1,'guest') v",[m]),'dispute');assert.equal(await scalar("select public.report_battle_result($1,'host') v",[m]),'completed');
  await claim(u);assert.equal((await db.query('select * from public.get_my_battle_history(20)')).rows.some(x=>x.id===m&&x.result==='win'),true);
  const ratings=(await db.query('select * from public.get_my_battle_ratings()')).rows;assert.equal(ratings.find(x=>x.tcg==='pokemon').games,1);
  const rid=await scalar("select public.report_battle_user($1,$2,'other','G4 synthetic report') v",[m,other]);assert.ok(rid);
  await db.query('select public.leave_battle_match($1)',[waiting]);await db.exec('reset role');assert.equal(await scalar('select status v from public.battle_matches where id=$1',[waiting]),'cancelled');
  await claim(u);await db.query('select public.leave_battle_match($1)',[asGuest]);await db.exec('reset role');assert.equal(await scalar('select guest_id v from public.battle_matches where id=$1',[asGuest]),null);
  assert.equal(await scalar('select count(*)::int v from public.battle_matches where id=any($1::uuid[])',[[m,waiting]]),2,'no match deletion');
  assert.equal(await scalar('select count(*)::int v from public.battle_rating_events where match_id=$1',[m]),1);
  await claim(C);await deny("select public.report_battle_result($1,'host')",[m],/Nicht erlaubt/);await deny("select public.report_battle_user($1,$2,'other','foreign')",[m,u],/Not a participant/);assert.equal((await db.query('select * from public.get_my_battle_history(20)')).rows.length,0);
  pass(`${u===A?'A':'B'} ${s}: result completion, ranked evidence, own history/ratings/report and waiting leave retained; foreign evidence protected`);
 });
 // Actual browser Safety is not broadened into a shell-wide Hold block: existing
 // completion routes stay reachable; actual admission RPCs above are authoritative.
 const browser=await read('battle-safety.js');
 for(const s of ['normal','processing','closure','safety']){
  const nodes=new Map();const node=id=>{if(!nodes.has(id))nodes.set(id,{classList:{add(){},remove(){}},showModal(){throw Error('unexpected missing consent')}});return nodes.get(id)};
  const profile={age_band:'18_plus',conduct_accepted_at:'2026-09-01',conduct_version:'battle-v1-2026-09',safety_restricted:['closure','safety'].includes(s),data_processing_restricted_at:['closure','processing'].includes(s)?'2026-09-27':null};
  const context={window:{},document:{getElementById:node}};vm.runInNewContext(browser,context);
  const dbStub={from(t){assert.equal(t,'profiles');return{select(){return{eq(){return{single:async()=>({data:profile,error:null})}}}}}}};
  assert.equal(await context.window.DV_BATTLE_SAFETY.init(dbStub,{id:A}),!profile.safety_restricted);
 }
 pass('unchanged browser Safety evaluated: Closure/Safety block retained; Processing-only does not hide completion shell; RPC enforcement verified separately');
 for(const u of users)for(const role of ['authenticated','service_role','postgres'])await tx(async()=>{
  await claim(u,role);const normal=await scalar("select public.create_battle_match('pokemon') v");await db.query('select public.leave_battle_match($1)',[normal]);
  for(const action of ['create_legacy','create_ranked','join_id','ready_host_true','start']){
   const q=await setup(u,action);await state(u,'processing');await claim(u,role);
   await db.query("select set_config('request.jwt.claims',$1,false),set_config('app.battle_hold_override','true',false)",[JSON.stringify({sub:u,role:'service_role',aal:'aal2'})]);await deny(q.sql,q.args);
  }
 });
 pass('A/B authenticated, service-role RPC and Owner/Definer contexts work normally but cannot bypass Hold via JWT/GUC');
 for(const u of users)await tx(async()=>{
  const m=await match(C,u,'ready'),foreign=await match(C,null,'waiting','private');await claim(u);
  await deny('select public.start_battle_match($1)',[m],/Nur der Host/);
  await deny('select public.set_battle_ready($1,true)',[foreign],/Nicht erlaubt/);
  await deny('select public.join_battle_match($1,null)',[foreign],/Ungültiger Einladungscode/);
  for(const role of ['authenticated','service_role']){
   await claim(u,role);for(const sql of ['insert into public.battle_matches(host_id,tcg) values($1,\'pokemon\')','update public.battle_matches set host_ready=false where host_id=$1','delete from public.battle_matches where host_id=$1'])await deny(sql,[u],/permission denied/);
  }
  await claim(u,'anon');await deny("select public.create_battle_match('pokemon')",[],/permission denied/);
  for(const role of ['authenticated','service_role']){await claim(null,role);for(const sql of ["select public.create_battle_match('pokemon')",`select public.join_battle_match('${m}',null)`,`select public.set_battle_ready('${m}',true)`,`select public.start_battle_match('${m}')`])await deny(sql,[],/not_authenticated/)}
 });
 pass('A/B foreign participant/host/private-invite boundaries, direct DML, anon and missing-subject rejection retained');
 for(const action of ['create_legacy','create_ranked','join_id','ready_host_true','start'])await tx(async()=>{
  const q=await setup(A,action);await db.query("update public.profiles set account_status='suspended' where id=$1",[A]);await claim(A);await deny(q.sql,q.args,/Account ist nicht aktiv|battle_account_unavailable/);
 });
 pass('suspended-account boundary remains independent of Hold and Safety');
 // Functional rollback of one candidate body must fail matching readiness closed.
 await tx(async()=>{await db.exec(report.functions.find(x=>x.proname==='start_battle_match').definition);assert.equal((await ready()).compatible,false)});
 pass('missing admission guard fails G4 readiness closed');
 if(native){
  for(const u of users)for(const action of ['create_legacy','create_ranked','join_id','ready_host_true','start']){
   const q=await setup(u,action),before=await snapshot();const writer=await db.connect(),observer=await db.connect();
   await db.exec('begin');await state(u,'processing');await claim(u,'authenticated',writer);const pid=(await writer.query('select pg_backend_pid() pid')).rows[0].pid;
   const pending=writer.query(q.sql,q.args).then(()=>({ok:true}),e=>({ok:false,error:e.message}));
   let blocked=false;for(let i=0;i<100;i++){if((await observer.query('select cardinality(pg_blocking_pids($1)) n',[pid])).rows[0].n){blocked=true;break}await new Promise(r=>setTimeout(r,20))}
   assert.equal(blocked,true);await db.exec('commit;reset role');const out=await pending;assert.equal(out.ok,false);assert.match(out.error,/account_data_processing_restricted/);assert.deepEqual(await snapshot(),before);
   // Owner fixture cleanup only; no application unlock path is introduced.
   await db.query('update public.profiles set data_processing_restricted_at=null where id=$1',[u]);
   if(q.m)await db.query("update public.battle_matches set status='cancelled' where id=$1",[q.m]);
  }
  pass('A/B native concurrent Hold writes: both Create entries, Join, Ready and Start wait then reject after commit; no match changes');
 }
 assert.equal((await ready()).compatible,true);report.passed=true;
}catch(e){report.error={message:e.message,detail:e.detail,where:e.where,stack:e.stack};console.error(report.error);process.exitCode=1}
finally{try{await db.exec('rollback;reset role')}catch{}await db.close();report.cleanup='disposable database closed/deleted';await mkdir('test-results',{recursive:true});await writeFile(`test-results/battle-player-processing-hold-${native?'native':'wasm'}${process.argv.includes('--battle-signal-hold')?'-g5':''}${process.argv.includes('--spectator-withdrawal')?'-d1':''}.json`,JSON.stringify(report,null,2))}
