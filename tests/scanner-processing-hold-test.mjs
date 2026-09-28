// G3: actual SQL/RPC and actual server handler, synthetic users, provider stubs only.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {securitySchemaFixture,read} from './helpers/security-schema-fixture.mjs';
import {securityQuery} from './generate-security-readiness.mjs';
const require=createRequire(import.meta.url),{createHandler}=require('../benchmark/scanner-pilot/recognize-server.cjs');
const native=process.argv.includes('--native');let db;
if(native){const {createDatabase}=await import('./helpers/f3-native-db.mjs');db=await createDatabase()}
else{const {PGlite}=await import('@electric-sql/pglite'),{pgcrypto}=await import('@electric-sql/pglite/contrib/pgcrypto');db=new PGlite({extensions:{pgcrypto}})}
const report={engine:native?'native-postgresql17':'pglite',version:db.version||null,synthetic:true,realProviderCalls:0,liveApplied:false,cases:[],passed:false};
const pass=s=>{report.cases.push(s);console.log('PASS:',s)};
const uid=n=>`71000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const [A,B,OWNER]=[1,2,3].map(uid),users=[A,B],KEY='G3_TEST_ONLY_ACCOUNTING_KEY_32_BYTES';let sequence=100,providerCalls=0;
const scalar=async(sql,args=[],client=db)=>(await client.query(sql,args)).rows[0].v;
const claim=async(u,role='authenticated',key=KEY,client=db,anonymous=false)=>{
 await client.query('reset role');await client.query("select set_config('request.jwt.claims',$1,false),set_config('request.headers',$2,false)",[JSON.stringify({sub:u,role,aal:'aal1',is_anonymous:anonymous}),JSON.stringify({'x-dv-accounting-key':key})]);await client.query('set role '+role);
};
const reserve=(id=uid(sequence++),kind='raw',fn='public.dv_v16_reserve_openai_scan',client=db)=>scalar(`select ${fn}($1,$2,'pokemon',$3) v`,[id,id.replaceAll('-','').repeat(2),kind],client);
const settle=(id,client=db)=>scalar('select public.dv_v16_settle_openai_scan($1,100,20,173,200) v',[id],client);
const budget=()=>scalar('select public.dv_v16_openai_scan_budget() v');
const ready=()=>scalar('select public.get_market_legal_schema_readiness_v1() v');
const deny=async(sql,args=[],pattern=/permission denied/)=>{
 await db.exec('savepoint denied');try{await assert.rejects(()=>db.query(sql,args),pattern)}finally{await db.exec('rollback to savepoint denied;release savepoint denied')}
};
const hold=async(u,closure=false)=>{await db.exec('reset role');if(closure){await claim(u);assert.equal((await scalar("select public.request_my_account_deletion('KONTO LÖSCHEN',$1) v",[uid(sequence++)])).accepted,true)}else await db.query('update public.profiles set data_processing_restricted_at=now() where id=$1',[u]);await db.exec('reset role')};
const ledger=async()=>{await db.exec('reset role');const out={};for(const t of ['openai_scan_policy','openai_scan_reservation','openai_weekly_usage','openai_monthly_cost','scan_reservation','weekly_usage','credit_period'])out[t]=await scalar(`select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]') v from dv_v16_private.${t} t`);return out};
const env={VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'scanner-v16',OPENAI_API_KEY:'G3_TEST_ONLY_NO_REAL_KEY',DV_OPENAI_ACCOUNTING_KEY:KEY};
// This adapter executes actual candidate SQL. No network fallback exists.
async function handler(u,{kind='raw',envOverride={},afterReserve,insideProvider,budgetFault,providerFailure=false}={}){
 const id=uid(sequence++);let rpcCalls=0;
 const fetchImpl=async(url,options)=>{
  assert.equal(options.redirect,'error');assert.equal(options.headers.Authorization,'Bearer g3-'+u);
  assert.ok(options.headers.apikey.startsWith('sb_publishable_'));
  if(url.endsWith('/auth/v1/user'))return{ok:true,json:async()=>({id:u})};
  const path=new URL(url).pathname,body=JSON.parse(options.body);rpcCalls++;
  assert.ok(path.startsWith('/rest/v1/rpc/'),'no real provider/network requests');
  await claim(u,'authenticated',options.headers['x-dv-accounting-key']||'');let v;
  if(path.endsWith('/dv_v16_reserve_openai_scan')){
   assert.equal(options.headers['x-dv-accounting-key'],KEY);
   v=await scalar('select public.dv_v16_reserve_openai_scan($1,$2,$3,$4) v',[body.p_request_id,body.p_image_sha256,body.p_tcg,body.p_kind]);
   if(v.allowed&&afterReserve)await afterReserve(id);
  }else if(path.endsWith('/dv_v16_openai_scan_budget')){
   assert.equal(options.headers['x-dv-accounting-key'],undefined);v=await budget();
   if(budgetFault==='missing')delete v.processingRestricted;
   if(budgetFault==='unavailable')throw Error('synthetic RPC outage');
  }else if(path.endsWith('/dv_v16_settle_openai_scan')){
   assert.equal(options.headers['x-dv-accounting-key'],KEY);
   v=await scalar('select public.dv_v16_settle_openai_scan($1,$2,$3,$4,$5) v',[body.p_request_id,body.p_input_tokens,body.p_output_tokens,body.p_estimated_cost_eur_micros,body.p_estimated_cost_usd_micros]);
  }else throw Error('unexpected network URL');
  return{ok:true,json:async()=>v};
 };
 const provider=async()=>{providerCalls++;if(insideProvider)await insideProvider();const result={model:'stub',usage:{inputTokens:100,outputTokens:20},estimatedCostUsd:.0002};if(providerFailure)throw Object.assign(Error('stub incomplete'),{status:502,code:'provider_incomplete_or_blocked',accounting:result});return result};
 const f=createHandler({env:{...env,...envOverride},config:{enabled:true},fetchImpl,callProvider:provider,callSlabProvider:provider});
 const res={setHeader(){},status(n){this.statusCode=n;return this},json(v){this.body=v;return this}};
 await f({method:'POST',headers:{authorization:'Bearer g3-'+u,'content-type':'application/json'},body:{imageBase64:Buffer.from([255,216,255,...Buffer.from(id)]).toString('base64'),requestId:id,tcg:'pokemon',kind}},res);
 await db.exec('reset role');return{...res,id,rpcCalls};
}
try{
 await securitySchemaFixture(db);
 for(const [u,email,role] of [[OWNER,'info@duelvanta.de','owner'],[A,'g3-a@example.invalid','player'],[B,'g3-b@example.invalid','player']]){
  await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[u,email]);
  await db.query("insert into public.profiles(id,email,role,account_status,age_band) values($1,$2,$3,'active','18_plus')",[u,email,role]);
 }
 for(const f of ['auth-privileged-step-up-v1','security-privilege-mfa-hardening-v1','security-readiness-v1','market-production-trade-lock-v1','market-production-trade-lock-readiness-v1','account-data-export-collect-battle-v1','account-data-export-trade-lock-readiness-v1','account-processing-markers-v1','account-processing-markers-readiness-v1','account-closure-privacy-v1','account-closure-privacy-readiness-v1'])await db.exec(await read('database/'+f+'.sql'));
 await db.query("update dv_v16_private.openai_scan_policy set accounting_key_sha256=encode(sha256(convert_to($1,'UTF8')),'hex')",[KEY]);
 for(const u of users){await db.exec('begin');await hold(u);await claim(u);assert.equal((await reserve()).allowed,true);assert.equal((await budget()).enabled,true);await db.exec('rollback;reset role')}
 pass('A/B baseline: new reservation and enabled budget despite Processing-Hold; rolled back');
 report.baseline=(await db.query("select p.oid,n.nspname,p.proname,p.prosecdef,pg_get_userbyid(p.proowner) owner,p.proacl::text,p.proconfig,pg_get_functiondef(p.oid) definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='dv_v16_private' or (n.nspname='public' and p.proname like 'dv_v16_%') order by 1,2")).rows;
 report.relations=(await db.query("select c.relname,c.relrowsecurity,c.relacl::text from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='dv_v16_private' and c.relkind='r' order by 1")).rows;
 const before=(await db.query(securityQuery)).rows[0].jsonb_agg;
 const candidate=await read('database/scanner-processing-hold-v1.sql');await db.exec(candidate);await db.exec(candidate);
 const after=(await db.query(securityQuery)).rows[0].jsonb_agg;
 assert.deepEqual(after.filter(x=>!before.some(y=>JSON.stringify(x)===JSON.stringify(y))).map(x=>x[1]),['dv_v16_private.openai_scan_budget_for_caller()','dv_v16_private.reserve_openai_for_caller(p_request_id uuid, p_image_sha256 text, p_tcg text, p_kind text)']);
 assert.equal(before.length,after.length);assert.equal((await ready()).compatible,false);
 await db.exec(await read('database/scanner-processing-hold-readiness-v1.sql'));assert.equal((await ready()).compatible,true);
 for(const p of report.baseline){const r=(await db.query('select proacl::text,prosecdef,proconfig,pg_get_userbyid(proowner) owner from pg_proc where oid=$1',[p.oid])).rows[0];assert.deepEqual(r,{proacl:p.proacl,prosecdef:p.prosecdef,proconfig:p.proconfig,owner:p.owner})}
 pass('idempotent candidate changes exactly reserve/budget bodies; all ACL/RLS, signatures, G1/G2/T2 and settlement retained; readiness matches');

 if(process.argv.includes('--battle-player-hold')){
  await db.exec(await read('database/battle-player-processing-hold-v1.sql'));
  await db.exec(await read('database/battle-player-processing-hold-readiness-v1.sql'));
  pass('G4 installed before complete regression');
 }
 if(process.argv.includes('--battle-signal-hold')){
  await db.exec(await read('database/battle-signal-processing-hold-v1.sql'));
  await db.exec(await read('database/battle-signal-processing-hold-readiness-v1.sql'));
 }
 if(process.argv.includes('--spectator-withdrawal')){
  await db.exec(await read('database/battle-spectator-withdrawal-v1.sql'));
  await db.exec(await read('database/battle-spectator-withdrawal-readiness-v1.sql'));
 }
 if(process.argv.includes('--spectator-epoch-hold')){
  await db.exec(await read('database/battle-spectator-epoch-processing-hold-v1.sql'));
  await db.exec(await read('database/battle-spectator-epoch-processing-hold-readiness-v1.sql'));
 }
 if(process.argv.includes('--staff-hold')){
  if(!process.argv.includes('--spectator-epoch-hold'))throw Error('D3 regression requires D2');
  await db.exec(await read('database/staff-processing-hold-v1.sql'));
  await db.exec(await read('database/staff-processing-hold-readiness-v1.sql'));
 }
 if(process.argv.includes('--publication-hold')){
  if(!process.argv.includes('--staff-hold'))throw Error('D4 requires closed D3');
  await db.exec(await read('database/publication-processing-hold-v1.sql'));
  await db.exec(await read('database/publication-processing-hold-readiness-v1.sql'));
 if(process.argv.includes('--b1-safety')){await db.exec(await read('database/battle-safety-sanctions-v1.sql'));await db.exec(await read('database/battle-safety-sanctions-readiness-v1.sql'));}

 }
 for(const u of users)for(const state of ['normal','hold','closure']){
  const other=u===A?B:A;await db.exec('begin');if(state!=='normal')await hold(u,state==='closure');
  const before=await ledger();await claim(u);const b=await budget();assert.equal(b.processingRestricted,state!=='normal');assert.equal(b.enabled,state==='normal');
  if(state!=='normal')assert.equal(b.remaining+b.slabRemaining,0);
  for(const kind of ['raw','slab'])for(const fn of ['public.dv_v16_reserve_openai_scan','dv_v16_private.reserve_openai_for_caller']){
   const r=await reserve(uid(sequence++),kind,fn);assert.equal(r.allowed,state==='normal');if(state!=='normal')assert.equal(r.reason,'account_data_processing_restricted');
  }
  if(state!=='normal')assert.deepEqual(await ledger(),before,'denied requests change no ledger or quota');
  const paid=providerCalls;
  for(const kind of ['raw','slab']){const r=await handler(u,{kind});assert.equal(r.statusCode,state==='normal'?200:403);if(state!=='normal')assert.equal(r.body.error,'account_data_processing_restricted');else assert.equal(r.body.accountingState,'settled')}
  assert.equal(providerCalls-paid,state==='normal'?2:0);
  const control=await handler(other);assert.equal(control.statusCode,200);assert.equal(control.body.accountingState,'settled');
  await db.exec('rollback;reset role');pass(`${u===A?'A':'B'} ${state}: raw/slab public+private RPC and real handler; correct budget, unchanged denied ledgers, other user works`);
 }
 for(const u of users){
  await db.exec('begin');await claim(u);const id=uid(sequence++);assert.equal((await reserve(id)).allowed,true);await hold(u,true);await claim(u);
  const before=await ledger();await claim(u);assert.equal((await settle(id)).settled,true);const done=await ledger();
  const month=done.openai_monthly_cost.find(x=>x.period_start===before.openai_monthly_cost.find(y=>y.reserved_eur_micros>0).period_start);
  const oldMonth=before.openai_monthly_cost.find(x=>x.period_start===month.period_start);
  assert.equal(month.reserved_eur_micros,oldMonth.reserved_eur_micros-500000);assert.equal(month.settled_eur_micros,oldMonth.settled_eur_micros+173);assert.equal(month.successful_scans,oldMonth.successful_scans+1);assert.equal(month.input_tokens,oldMonth.input_tokens+100);assert.equal(month.output_tokens,oldMonth.output_tokens+20);
  assert.deepEqual(done.openai_weekly_usage,before.openai_weekly_usage);await claim(u);assert.equal((await settle(id)).duplicate,true);assert.deepEqual(await ledger(),done);
  await claim(u===A?B:A);await deny('select public.dv_v16_settle_openai_scan($1,100,20,173,200)',[id],/reservation not found/);
  await claim(u,'authenticated','');await deny('select public.dv_v16_settle_openai_scan($1,100,20,173,200)',[id],/server accounting authorization required/);
  await db.exec('rollback;reset role');pass(`${u===A?'A':'B'} pre-Hold reservation settles after real Closure exactly once; foreign/key/quotas preserved`);
 }
 for(const u of users)for(const timing of ['afterReserve','insideProvider','incompleteProvider']){
  await db.exec('begin');const count=providerCalls;
  const options=timing==='afterReserve'?{afterReserve:()=>hold(u)}:{insideProvider:()=>hold(u),providerFailure:timing==='incompleteProvider'};
  const r=await handler(u,options);assert.equal(r.statusCode,timing==='afterReserve'?403:timing==='insideProvider'?200:502);
  assert.equal(providerCalls-count,timing==='afterReserve'?0:1);
  const row=await scalar('select to_jsonb(r) v from dv_v16_private.openai_scan_reservation r where user_id=$1 and request_id=$2',[u,r.id]);
  assert.equal(row.settled_at!==null,timing!=='afterReserve');
  // No new refund/cancellation/in-flight rule. Existing authorized settlement stays callable.
  if(timing==='afterReserve'){await claim(u);assert.equal((await settle(r.id)).settled,true)}
  await db.exec('rollback;reset role');pass(`${u===A?'A':'B'} ${timing}: no post-Hold provider start; existing successful/incomplete accounting retained`);
 }
 for(const u of users){
  await db.exec('begin');await hold(u);
  for(const role of ['authenticated','postgres']){
   await claim(u,role);await db.query("select set_config('request.jwt.claims',$1,false),set_config('app.processing_override','true',false)",[JSON.stringify({sub:u,role:'service_role',aal:'aal2'})]);
   assert.equal((await reserve()).reason,'account_data_processing_restricted');
  }
  await db.exec('rollback;reset role');
 }
 pass('A/B: actual Definer/owner contexts and spoofed JWT/GUC cannot bypass new admission Hold');
 for(const fault of ['missing','unavailable']){
  await db.exec('begin');const count=providerCalls;const r=await handler(A,{budgetFault:fault});assert.equal(r.statusCode,503);assert.equal(providerCalls,count);await db.exec('rollback;reset role');
 }
 pass('missing Hold response and unavailable preflight fail closed without provider start');
 // Authentication/server credential and existing admission limits, in actual DB.
 await db.exec('begin');
 for(const role of ['anon','service_role']){await claim(A,role);await deny('select public.dv_v16_reserve_openai_scan($1,$2,\'pokemon\',\'raw\')',[uid(sequence++),'a'.repeat(64)]);await deny('insert into dv_v16_private.openai_scan_reservation(user_id) values($1)',[A])}
 await claim(A);await deny('insert into dv_v16_private.openai_scan_reservation(user_id) values($1)',[B]);
 await deny('update dv_v16_private.openai_weekly_usage set raw_used=0');
 for(const key of ['',KEY+'wrong']){await claim(A,'authenticated',key);await deny('select public.dv_v16_reserve_openai_scan($1,$2,\'pokemon\',\'raw\')',[uid(sequence++),'a'.repeat(64)],/server accounting authorization required/)}
 await claim(null);await deny('select public.dv_v16_reserve_openai_scan($1,$2,\'pokemon\',\'raw\')',[uid(sequence++),'a'.repeat(64)],/authentication required/);
 await claim(A,'authenticated',KEY,db,true);await deny('select public.dv_v16_reserve_openai_scan($1,$2,\'pokemon\',\'raw\')',[uid(sequence++),'a'.repeat(64)],/authentication required/);
 await db.exec('reset role');await db.query("update public.profiles set account_status='suspended' where id=$1",[A]);await claim(A);await deny('select public.dv_v16_reserve_openai_scan($1,$2,\'pokemon\',\'raw\')',[uid(sequence++),'a'.repeat(64)],/active account required/);
 await db.exec('rollback;reset role');pass('anon/service/direct DML, anonymous JWT, missing subject/key and inactive account boundaries preserved');
 for(const u of users){
  await db.exec('begin');await db.exec('update dv_v16_private.openai_scan_policy set raw_weekly_limit=1,slab_weekly_limit=1');await claim(u);
  const id=uid(sequence++);assert.equal((await reserve(id)).allowed,true);assert.equal((await reserve(id)).reason,'duplicate');assert.equal((await reserve()).reason,'weekly_limit');assert.equal((await reserve(uid(sequence++),'slab')).allowed,true);
  await db.exec('reset role;update dv_v16_private.openai_scan_policy set monthly_budget_eur_micros=1000000');await claim(u);assert.equal((await reserve()).reason,'monthly_budget');
  await db.exec('reset role;update dv_v16_private.openai_scan_policy set enabled=false');await claim(u);assert.equal((await reserve()).reason,'closed');assert.equal((await settle(id)).settled,true);
  await db.exec('rollback;reset role');
 }
 pass('A/B duplicate, separate raw/slab quota, monthly limit, owner closed switch and settlement after closure retained');
 for(const e of [{VERCEL_GIT_COMMIT_REF:'marketplace-ux-v1'},{VERCEL_ENV:'production',VERCEL_GIT_COMMIT_REF:'marketplace-ux-v1'}]){const count=providerCalls;const r=await handler(A,{envOverride:e});assert.equal(r.statusCode,404);assert.equal(r.rpcCalls,0);assert.equal(providerCalls,count)}
 await db.exec('begin');const r=await handler(A,{envOverride:{VERCEL_ENV:'production',VERCEL_GIT_COMMIT_REF:'main'}});assert.equal(r.statusCode,200);await db.exec('rollback;reset role');
 pass('deployment gates unchanged: marketplace preview/production denied, simulated main/approved preview work only through stubs');
 if(native){
  // Real row-lock evidence: Hold already writing -> reserve must wait and reject after commit.
  for(const u of users){
   const writer=await db.connect(),observer=await db.connect();await db.exec('begin');await hold(u,true);
   await claim(u,'authenticated',KEY,writer);const pid=(await writer.query('select pg_backend_pid() pid')).rows[0].pid;
   const pending=reserve(uid(sequence++),'raw','public.dv_v16_reserve_openai_scan',writer);
   let blocked=false;for(let i=0;i<100;i++){if((await observer.query('select cardinality(pg_blocking_pids($1)) n',[pid])).rows[0].n){blocked=true;break}await new Promise(r=>setTimeout(r,20))}
   assert.equal(blocked,true);await db.exec('commit;reset role');assert.equal((await pending).reason,'account_data_processing_restricted');
   pass(`${u===A?'A':'B'} native real Closure lock precedes reserve: blocked then rejected without ledger increment`);
  }
 }
 assert.equal((await ready()).compatible,true);report.providerStubCalls=providerCalls;report.passed=true;
}catch(e){report.error={message:e.message,detail:e.detail,where:e.where,stack:e.stack};console.error(report.error);process.exitCode=1}
finally{try{await db.exec('rollback;reset role')}catch{}await db.close();report.cleanup='disposable database closed/deleted';await mkdir('test-results',{recursive:true});await writeFile(`test-results/scanner-processing-hold-${native?'native':'wasm'}${process.argv.includes('--battle-player-hold')?'-g4':''}${process.argv.includes('--battle-signal-hold')?'-g5':''}${process.argv.includes('--spectator-withdrawal')?'-d1':''}${process.argv.includes('--spectator-epoch-hold')?'-d2':''}.json`,JSON.stringify(report,null,2))}
