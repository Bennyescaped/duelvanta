// G5: shipped browser signal functions + real SQL, synthetic media/Realtime doubles only.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {mkdir,writeFile} from 'node:fs/promises';
import {securitySchemaFixture,read} from './helpers/security-schema-fixture.mjs';
import {securityQuery,signalSecurityQuery} from './generate-security-readiness.mjs';
const native=process.argv.includes('--native');let db;
if(native){const {createDatabase}=await import('./helpers/f3-native-db.mjs');db=await createDatabase()}
else{const {PGlite}=await import('@electric-sql/pglite'),{pgcrypto}=await import('@electric-sql/pglite/contrib/pgcrypto');db=new PGlite({extensions:{pgcrypto}})}
const report={engine:native?'native-postgresql17':'pglite',version:db.version||null,synthetic:true,liveApplied:false,cases:[],passed:false};
const pass=s=>{report.cases.push(s);console.log('PASS:',s)};
const uid=n=>`73000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const [A,B,C,O]=[1,2,3,4].map(uid),types=['offer','answer','ice','hangup'];let seq=100;
const scalar=async(sql,args=[],client=db)=>(await client.query(sql,args)).rows[0].v;
const claim=async(u,role='authenticated',client=db)=>{await client.query('reset role');await client.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:u,role,aal:'aal1'})]);await client.query('set role '+role)};
const ready=()=>scalar('select public.get_market_legal_schema_readiness_v1() v');
const tx=async(fn)=>{await db.exec('begin');try{await fn()}finally{await db.exec('rollback;reset role')}};
const deny=async(sql,args=[],pattern=/account_data_processing_restricted/)=>{await db.exec('savepoint denied');try{await assert.rejects(()=>db.query(sql,args),pattern)}finally{await db.exec('rollback to savepoint denied;release savepoint denied')}};
const insert="insert into public.battle_signals(match_id,sender_id,signal_type,payload) values($1,$2,$3,$4::jsonb) returning id";
const args=(m,u,type)=>[m,u,type,JSON.stringify({synthetic:'G5',type})];
const match=async(host=A,guest=B,status='live')=>{await db.exec('reset role');const id=uid(seq++);await db.query("insert into public.battle_matches(id,host_id,guest_id,tcg,status) values($1,$2,$3,'pokemon',$4)",[id,host,guest,status]);return id};
const state=async(u,s)=>{await db.exec('reset role');if(s==='processing')await db.query('update public.profiles set data_processing_restricted_at=now() where id=$1',[u]);if(s==='closure'){await claim(u);assert.equal((await scalar("select public.request_my_account_deletion('KONTO LÖSCHEN',$1) v",[uid(seq++)])).accepted,true)}await db.exec('reset role')};
const snapshot=async()=>{await db.exec('reset role');return scalar("select coalesce(jsonb_agg(to_jsonb(s) order by id),'[]') v from public.battle_signals s")};
async function browser(u,m,s){
 const errors=[],writes=[],reads=[],channels=[],clears=[],nodes=new Map();
 const node=id=>{if(!nodes.has(id))nodes.set(id,{onclick:null,classList:{add(){},remove(){},toggle(){}},textContent:'',value:'',srcObject:null});return nodes.get(id)};
 const context={user:{id:u},currentMatch:{id:m,host_id:A,guest_id:B,status:'live'},stream:null,document:{getElementById:node},console:{error:(...a)=>errors.push(a),warn(){}},setInterval(){},setTimeout(){},addEventListener(){},L:()=>({camera:'camera'}),RTCIceCandidate:class{constructor(v){Object.assign(this,v)}},RTCPeerConnection:class{constructor(){throw Error('no media allowed in G5 test')}},
 db:{from(table){assert.equal(table,'battle_signals');return{
 async insert(row){writes.push(row);await db.exec('savepoint browser_insert');try{await claim(u);await db.query(insert,[row.match_id,row.sender_id,row.signal_type,JSON.stringify(row.payload)]);await db.exec('release savepoint browser_insert');return{error:null}}catch(e){await db.exec('rollback to savepoint browser_insert;release savepoint browser_insert');return{error:{code:e.code,message:e.message}}}},
 select(){return{eq(column,value){assert.equal(column,'match_id');assert.equal(value,m);return{order(column,opt){assert.equal(column,'id');assert.equal(opt.ascending,true);return{async limit(n){assert.equal(n,80);await claim(u);const data=(await db.query('select * from public.battle_signals where match_id=$1 order by id limit 80',[m])).rows;reads.push(data);return{data}}}}}}}}
 }},async rpc(name,p){assert.equal(name,'clear_my_battle_signals');clears.push(p);await claim(u);await db.query('select public.clear_my_battle_signals($1)',[p.p_match_id]);return{error:null}},
 channel(name){const c={name,on(event,filter,cb){this.filter=filter;this.receive=cb;assert.equal(event,'postgres_changes');return this},subscribe(cb){this.subscribed=cb;return this}};channels.push(c);return c},async removeChannel(){}}
 };
 context.window=context;
 // Test-only exposure of the shipped lexical functions. Their bodies are unchanged.
 const source=(await read('battle-webrtc.js')).replace('window.DV_BATTLE_RTC={','window.__G5={sendSignal,subscribeSignals};window.DV_BATTLE_RTC={');vm.runInNewContext(source,context);
 for(const t of types)await context.__G5.sendSignal(t,{synthetic:true});
 assert.equal(writes.length,4);assert.equal(errors.length,s==='normal'?0:4);for(const e of errors)assert.match(e[1].message,/account_data_processing_restricted/);
 await context.__G5.subscribeSignals();assert.equal(clears.length,1);assert.equal(channels.length,1);
 const channel=channels[0];assert.equal(channel.filter.event,'INSERT');assert.equal(channel.filter.table,'battle_signals');assert.equal(channel.filter.filter,`match_id=eq.${m}`);
 await channel.subscribed('SUBSCRIBED');assert.equal(reads.length,1);
 // Existing peer ICE can still be received: no new read or incoming-event guard.
 await channel.receive({new:{id:999999,match_id:m,sender_id:u===A?B:A,signal_type:'ice',payload:{candidate:{synthetic:true}}}});
 return{writes:writes.length,rejections:errors.length,clear:clears.length,realtimeFilter:channel.filter};
}
try{
 await securitySchemaFixture(db);
 for(const [u,email,role] of [[O,'info@duelvanta.de','owner'],[A,'g5-a@example.invalid','player'],[B,'g5-b@example.invalid','player'],[C,'g5-c@example.invalid','player']]){
 await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[u,email]);await db.query("insert into public.profiles(id,email,role,account_status,age_band,conduct_accepted_at,conduct_version) values($1,$2,$3,'beta','18_plus',now(),'battle-v1-2026-09')",[u,email,role]);}
 await db.query("update public.profiles set account_status='active' where id=$1",[B]);
 for(const f of ['auth-privileged-step-up-v1','security-privilege-mfa-hardening-v1','security-readiness-v1','market-production-trade-lock-v1','market-production-trade-lock-readiness-v1','account-data-export-collect-battle-v1','account-data-export-trade-lock-readiness-v1','account-processing-markers-v1','account-processing-markers-readiness-v1','account-closure-privacy-v1','account-closure-privacy-readiness-v1','scanner-processing-hold-v1','scanner-processing-hold-readiness-v1','battle-player-processing-hold-v1','battle-player-processing-hold-readiness-v1'])await db.exec(await read('database/'+f+'.sql'));
 for(const u of [A,B])for(const s of ['processing','closure'])await tx(async()=>{const m=await match();await state(u,s);await claim(u);for(const t of types)await db.query(insert,args(m,u,t))});
 pass('A/B baseline reproduces all four new signal types under Processing-only and real Closure; rolled back');
 report.policies=(await db.query("select * from pg_policies where schemaname='public' and tablename='battle_signals' order by policyname")).rows;
 report.functions=(await db.query("select p.proname,p.prosecdef,p.proacl::text,p.proconfig,pg_get_userbyid(p.proowner) owner,pg_get_functiondef(p.oid) definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosrc ilike '%battle_signals%' and p.proname<>'get_security_schema_readiness_v1' order by p.proname")).rows;
 assert.deepEqual(report.functions.map(x=>x.proname),['clear_my_battle_signals']);
 const before=(await db.query(securityQuery)).rows[0].jsonb_agg;
 const candidate=await read('database/battle-signal-processing-hold-v1.sql');await db.exec(candidate);await db.exec(candidate);
 const after=(await db.query(securityQuery)).rows[0].jsonb_agg;
 assert.deepEqual(after.filter(x=>!before.some(y=>JSON.stringify(x)===JSON.stringify(y))).map(x=>x[1]),['public.guard_battle_signal_processing_hold()']);assert.equal(after.length,before.length+1);
 assert.equal((await ready()).compatible,false);await db.exec(await read('database/battle-signal-processing-hold-readiness-v1.sql'));assert.equal((await ready()).compatible,true);
 report.trigger=(await db.query("select pg_get_triggerdef(oid) definition,tgenabled from pg_trigger where tgname='battle_signal_processing_hold'")).rows;
 assert.equal(report.trigger.length,1);assert.match(report.trigger[0].definition,/BEFORE INSERT/);
 assert.deepEqual((await db.query("select * from pg_policies where schemaname='public' and tablename='battle_signals' order by policyname")).rows,report.policies);
 pass('only new non-callable trigger function and INSERT trigger; existing ACL/RLS/functions unchanged; idempotent candidate and G5 readiness');
 if(process.argv.includes('--spectator-withdrawal')){
  await db.exec(await read('database/battle-spectator-withdrawal-v1.sql'));
  await db.exec(await read('database/battle-spectator-withdrawal-readiness-v1.sql'));
 }
 for(const u of [A,B])for(const s of ['normal','processing','closure'])await tx(async()=>{
 const m=await match(),other=u===A?B:A;
 // Signals predate Hold, including one stale opposite-party signal.
 await db.query(insert,args(m,u,'ice'));await db.query(insert,args(m,other,'ice'));
 await db.query("insert into public.battle_signals(match_id,sender_id,signal_type,created_at) values($1,$2,'ice',now()-interval '2 days')",[m,other]);
 const pre=await snapshot();await state(u,s);assert.deepEqual(await snapshot(),pre,'Hold must not delete existing signals');
 await claim(u);assert.equal((await db.query('select * from public.battle_signals where match_id=$1',[m])).rows.length,3,'read retained');
 for(const t of types){if(s==='normal')await db.query(insert,args(m,u,t));else await deny(insert,args(m,u,t))}
 // Unheld counterpart remains allowed in the same match.
 await claim(other);for(const t of types)await db.query(insert,args(m,other,t));
 await claim(C);assert.equal((await db.query('select * from public.battle_signals where match_id=$1',[m])).rows.length,0);await deny(insert,args(m,C,'ice'),/row-level security/);await deny('select public.clear_my_battle_signals($1)',[m],/not_allowed/);
 await claim(u);await db.query('select public.clear_my_battle_signals($1)',[m]);await db.exec('reset role');
 const remaining=(await db.query('select * from public.battle_signals where match_id=$1',[m])).rows;assert.equal(remaining.length,5);assert.ok(remaining.every(r=>r.sender_id===other));
 assert.equal(await scalar('select status v from public.battle_matches where id=$1',[m]),'live');
 pass(`${u===A?'A':'B'} ${s}: four signal types, unheld peer, existing SELECT, no retrospective deletion, participant Clear with existing stale-row rule, foreign protection`);
 });
 for(const u of [A,B])for(const s of ['normal','processing','closure'])await tx(async()=>{const m=await match();await state(u,s);report.browser??=[];report.browser.push({user:u,state:s,...await browser(u,m,s)});pass(`${u===A?'A':'B'} ${s}: shipped sendSignal and subscribe/Clear/SELECT/Realtime callback with SQL-backed transport; no real media`)});
 for(const u of [A,B])await tx(async()=>{
 const m=await match(),foreign=await match(C,null);
 await claim(u);await deny(insert,args(m,u===A?B:A,'ice'),/row-level security/);await deny(insert,args(foreign,u,'ice'),/row-level security/);
 for(const status of ['waiting','ready','live','dispute','completed','cancelled']){await db.exec('reset role');await db.query('update public.battle_matches set status=$1 where id=$2',[status,m]);await claim(u);if(['completed','cancelled'].includes(status))await deny(insert,args(m,u,'ice'),/row-level security/);else await db.query(insert,args(m,u,'ice'))}
 for(const role of ['authenticated','service_role','anon']){await claim(u,role);for(const sql of ['update public.battle_signals set payload=\'{}\' where match_id=$1','delete from public.battle_signals where match_id=$1'])await deny(sql,[m],/permission denied/);if(role!=='authenticated')await deny(insert,args(m,u,'ice'),/permission denied/);await deny('select public.guard_battle_signal_processing_hold()',[],/permission denied/)}
 await claim(null);await deny(insert,args(m,u,'ice'),/row-level security/);
 pass(`${u===A?'A':'B'}: sender, foreign match, status, missing subject, direct UPDATE/DELETE, service/anon INSERT and trigger-function ACL boundaries`);
 });
 for(const u of [A,B])await tx(async()=>{
 const m=await match();await state(u,'processing');
 await claim(u);await db.query("select set_config('request.jwt.claims',$1,false),set_config('app.battle_hold_override','true',false)",[JSON.stringify({sub:u,role:'service_role',aal:'aal2'})]);await deny(insert,args(m,u,'ice'));
 // Actual owner INSERT bypasses RLS but still executes trigger. No role/no-subject exception.
 for(const sub of [u,null]){await claim(sub,'postgres');for(const t of types)await deny(insert,args(m,u,t))}
 for(const role of ['authenticated','service_role','postgres']){await claim(u,role);await db.query('select public.clear_my_battle_signals($1)',[m]);await claim(C,role);await deny('select public.clear_my_battle_signals($1)',[m],/not_allowed/)}
 pass(`${u===A?'A':'B'}: forged JWT/GUC cannot unlock; Owner INSERT with/without subject still checks sender; Definer Clear and foreign boundary retained`);
 });
 await tx(async()=>{await db.exec('alter table public.battle_signals disable trigger battle_signal_processing_hold');assert.equal((await ready()).compatible,false)});
 await tx(async()=>{await db.exec('drop trigger battle_signal_processing_hold on public.battle_signals');assert.equal((await ready()).compatible,false)});
 pass('missing or disabled signal trigger fails G5 readiness closed; prior G4 contract unchanged');
 if(native){
 for(const u of [A,B])for(const t of types){
 const m=await match(),writer=await db.connect(),observer=await db.connect();await db.exec('begin');await state(u,'processing');await claim(u,'authenticated',writer);
 const pid=(await writer.query('select pg_backend_pid() pid')).rows[0].pid;
 const pending=writer.query(insert,args(m,u,t)).then(()=>({ok:true}),e=>({ok:false,error:e.message}));
 let blocked=false;for(let i=0;i<100;i++){if((await observer.query('select cardinality(pg_blocking_pids($1)) n',[pid])).rows[0].n){blocked=true;break}await new Promise(r=>setTimeout(r,20))}
 assert.equal(blocked,true);await db.exec('commit;reset role');const out=await pending;assert.equal(out.ok,false);assert.match(out.error,/account_data_processing_restricted/);assert.equal(await scalar('select count(*)::int v from public.battle_signals where match_id=$1',[m]),0);
 await db.query('update public.profiles set data_processing_restricted_at=null where id=$1',[u]);
 }
 pass('A/B native races: all four INSERT types wait behind actual Hold write and reject after commit; no stored signal');
 }
 assert.equal((await ready()).compatible,true);report.passed=true;
}catch(e){report.error={message:e.message,detail:e.detail,where:e.where,stack:e.stack};console.error(report.error);process.exitCode=1}
finally{try{await db.exec('rollback;reset role')}catch{}await db.close();report.cleanup='disposable database closed/deleted';await mkdir('test-results',{recursive:true});await writeFile(`test-results/battle-signal-processing-hold-${native?'native':'wasm'}${process.argv.includes('--spectator-withdrawal')?'-d1':''}.json`,JSON.stringify(report,null,2))}
