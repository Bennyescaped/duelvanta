// D3 closed subset. --native is mandatory for acceptance; WASM is preparation only.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';
import {securitySchemaFixture,read} from './helpers/security-schema-fixture.mjs';
import {epochSecurityQuery} from './generate-security-readiness.mjs';
const native=process.argv.includes('--native');let db;
if(native){const {createDatabase}=await import('./helpers/f3-native-db.mjs');db=await createDatabase();}
else{const {PGlite}=await import('@electric-sql/pglite');const {pgcrypto}=await import('@electric-sql/pglite/contrib/pgcrypto');db=new PGlite({extensions:{pgcrypto}});}
const out={native,version:db.version||null,passed:false,acceptance:false,cases:[],races:[],scope:'closed D3 subset only; target-Hold old-case exception HARD STOP'};
const uid=n=>`82000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const [O,AD,MOD,J,A,B,X]=[1,2,3,4,5,6,7].map(uid),sid=u=>u?.replace('82000000','82100000'),fid=u=>u?.replace('82000000','82200000');let seq=100;
const scalar=async(q,p=[],c=db)=>(await c.query(q,p)).rows[0]?.v;
async function claim(u,role='authenticated',extra={},c=db){await c.query('reset role');await c.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:u,role,aal:'aal2',session_id:sid(u),...extra})]);await c.query('set role '+role);}
const admin=()=>claim(null,'postgres');
async function tx(f){await admin();await db.exec('begin');try{await f();}finally{await db.exec('rollback');await admin();}}
async function snap(){await admin();const r={};for(const t of ['public.profiles','public.battle_matches','public.battle_reports','public.staff_permissions','public.staff_applications','public.admin_audit_log','public.battle_rating_events','dv_v16_private.openai_scan_policy'])r[t]=await scalar(`select coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text),'[]') v from ${t} x`);return r;}
async function attempt(label,u,q,p=[],allowed=true,extra={},role='authenticated'){
 const before=await snap();await claim(u,role,extra);await db.exec('savepoint action');let value,error;
 try{value=await scalar(q,p);}catch(e){error=e;await db.exec('rollback to savepoint action');}
 await db.exec('release savepoint action');assert.equal(!error,allowed,label+': '+(error?.message||'unexpected success'));
 if(error){assert.ok(!/column .* does not exist|syntax error|function .* does not exist/i.test(error.message),label+' must fail on controlled boundary');assert.deepEqual(await snap(),before,label+' denied without mutation/audit');}
 out.cases.push({label,allowed,value,error:error?.message});return value;
}
async function state(u,s){await admin();if(s==='hold')await db.query('update public.profiles set data_processing_restricted_at=now() where id=$1',[u]);if(s==='safety')await db.query('update public.profiles set safety_restricted=true where id=$1',[u]);if(s==='closure'){await claim(u);assert.equal((await scalar("select public.request_my_account_deletion('KONTO LÖSCHEN',$1) v",[uid(seq++)])).accepted,true);await admin();}}
async function fixture(actor=J,target=B,status='open'){
 await admin();const m=uid(seq++),r=uid(seq++),app=uid(seq++);
 await db.query("insert into public.battle_matches(id,host_id,guest_id,tcg,status,visibility,mode,moderator_id,moderation_state) values($1,$2,$3,'pokemon','dispute','private','ranked',$4,'joined')",[m,A,target,actor]);
 await db.query("insert into public.battle_reports(id,match_id,reporter_id,reported_user_id,category,status) values($1,$2,$3,$4,'other',$5)",[r,m,A,target,status]);
 return {m,r,app};
}
const review="select public.review_battle_report($1,$2,$3) v",moderate="select public.moderate_battle_report($1,$2,$3) v";
let baseline;
try{
 await securitySchemaFixture(db);
 for(const [u,role] of [[O,'owner'],[AD,'admin'],[MOD,'moderator'],[J,'judge'],[A,'player'],[B,'player'],[X,'player']]){
  const email=u===O?'info@duelvanta.de':u+'@example.invalid';
  await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[u,email]);
  await db.query("insert into public.profiles(id,email,role,account_status,age_band,conduct_accepted_at,conduct_version) values($1,$2,$3,'active','18_plus',now(),'battle-v1-2026-09')",[u,email,role]);
  await db.query("insert into auth.mfa_factors(id,user_id,status) values($1,$2,'verified')",[fid(u),u]);
  await db.query("insert into auth.sessions(id,user_id,factor_id,aal) values($1,$2,$3,'aal2')",[sid(u),u,fid(u)]);
 }
 const chain=['auth-privileged-step-up-v1','security-privilege-mfa-hardening-v1','security-readiness-v1','market-production-trade-lock-v1','market-production-trade-lock-readiness-v1','account-data-export-collect-battle-v1','account-data-export-trade-lock-readiness-v1','account-processing-markers-v1','account-processing-markers-readiness-v1','account-closure-privacy-v1','account-closure-privacy-readiness-v1','scanner-processing-hold-v1','scanner-processing-hold-readiness-v1','battle-player-processing-hold-v1','battle-player-processing-hold-readiness-v1','battle-signal-processing-hold-v1','battle-signal-processing-hold-readiness-v1','battle-spectator-withdrawal-v1','battle-spectator-withdrawal-readiness-v1','battle-spectator-epoch-processing-hold-v1','battle-spectator-epoch-processing-hold-readiness-v1'];
 for(const f of chain)await db.exec(await read('database/'+f+'.sql'));
 const signatures=['public.join_battle_as_moderator(uuid)','public.set_battle_moderation_pause(uuid,boolean,text)','public.leave_battle_moderation(uuid,text)','public.resolve_battle_dispute(uuid,text,text)','public.moderate_battle_report(uuid,text,text)','public.review_battle_report(uuid,text,text)','public.review_staff_application(uuid,text,text)','public.set_staff_role(uuid,text,text)','public.set_staff_permission(uuid,text,boolean)','dv_v16_private.update_openai_scan_policy_for_caller(boolean,integer,integer,integer)'];
 const metadataQ="select oid,proacl::text,prosecdef,proconfig,proowner,provolatile from pg_proc where oid=any($1::regprocedure[]) order by oid";
 const meta=(await db.query(metadataQ,[signatures])).rows;
 const before=(await db.query(epochSecurityQuery)).rows[0].jsonb_agg;
 const candidate=await read('database/staff-processing-hold-v1.sql');await db.exec(candidate);await db.exec(candidate);
 assert.deepEqual((await db.query(metadataQ,[signatures])).rows,meta);
 const after=(await db.query(epochSecurityQuery)).rows[0].jsonb_agg;
 const changed=after.filter(x=>!before.some(y=>JSON.stringify(x)===JSON.stringify(y)));
 assert.equal(after.length,before.length);assert.equal(changed.length,10);assert.ok(changed.every(x=>x[0]==='function'&&signatures.some(s=>x[1].startsWith(s.split('(')[0]+'('))));
 out.changed=changed;out.catalog=after;
 assert.equal((await scalar('select public.get_security_schema_readiness_v1() v')).compatible,false);
 await db.exec(await read('database/staff-processing-hold-readiness-v1.sql'));
 if(process.argv.includes('--publication-hold')){
  await db.exec(await read('database/publication-processing-hold-v1.sql'));
  await db.exec(await read('database/publication-processing-hold-readiness-v1.sql'));
 }
 assert.equal((await scalar('select public.get_security_schema_readiness_v1() v')).compatible,true);
 assert.equal((await scalar('select public.get_market_legal_schema_readiness_v1() v')).compatible,true);
 for(const u of [AD,MOD,J])for(const p of ['battle_moderate','reports_review','users_restrict','review_reports'])await db.query('insert into public.staff_permissions(user_id,permission,granted_by) values($1,$2,$3) on conflict do nothing',[u,p,O]);
 baseline=await snap();
 // All role/permission/status/action combinations, each in its own rollback.
 for(const actor of [O,AD,MOD,J])for(const bits of [0,1,2,3,4,5,6,7])for(const status of ['open','reviewing','resolved','dismissed'])for(const rpc of ['review','moderate'])for(const action of rpc==='review'?['review','warning','restrict','resolve','dismiss']:['review','warn','restrict','resolve','dismiss'])await tx(async()=>{
  await db.query('delete from public.staff_permissions where user_id=$1 and permission in (\'reports_review\',\'users_restrict\',\'review_reports\')',[actor]);
  for(const [bit,p] of [[1,'reports_review'],[2,'users_restrict'],[4,'review_reports']])if(bits&bit)await db.query('insert into public.staff_permissions(user_id,permission,granted_by) values($1,$2,$3)',[actor,p,O]);
  const f=await fixture(actor);await db.query('update public.battle_reports set status=$2 where id=$1',[f.r,status]);
  const rr=actor===O||!!(bits&1),ur=actor===O||!!(bits&2),legacy=actor!==J||!!(bits&4),open=['open','reviewing'].includes(status);
  const ok=rpc==='review'?legacy&&(action==='review'||(['resolve','dismiss'].includes(action)&&rr&&open)):rr&&(action!=='restrict'||ur);
  await attempt(`${rpc}/${actor}/${bits}/${status}/${action}`,actor,rpc==='review'?review:moderate,[f.r,action,'  real note  '],ok);
  if(ok){await admin();const a=await scalar("select count(*)::int v from public.admin_audit_log where details->>'report_id'=$1",[f.r]);assert.equal(a,1);const audit=(await db.query("select actor_id,target_user_id,action from public.admin_audit_log where details->>'report_id'=$1",[f.r])).rows[0];assert.equal(audit.actor_id,actor);assert.equal(audit.target_user_id,B);assert.equal(audit.action,'battle_report_'+action);
   if(rpc==='review'&&action!=='review'){const r=(await db.query('select * from public.battle_reports where id=$1',[f.r])).rows[0];assert.equal(r.reviewer_id,actor);assert.equal(r.resolution_action,'none');assert.equal(r.reviewer_note,'real note');assert.ok(r.resolved_at);await attempt('repeat same closure',actor,review,[f.r,action,'repeat'],false);await attempt('closure switch',actor,review,[f.r,action==='resolve'?'dismiss':'resolve','switch'],false);}
  }
 });
 const ops=f=>[
 ['join','select public.join_battle_as_moderator($1) v',[f.m]],
 ['pause','select public.set_battle_moderation_pause($1,true,$2) v',[f.m,'note']],
 ['resume','select public.set_battle_moderation_pause($1,false,$2) v',[f.m,'note']],
 ['leave','select public.leave_battle_moderation($1,$2) v',[f.m,'note']],
 ['dispute','select public.resolve_battle_dispute($1,\'host\',$2) v',[f.m,'note']],
 ...['review','warning','restrict','resolve','dismiss'].map(a=>['review-'+a,review,[f.r,a,'note']]),
 ...['review','warn','restrict','resolve','dismiss'].map(a=>['moderate-'+a,moderate,[f.r,a,'note']])];
 for(const actor of [O,AD,MOD,J])for(const as of ['normal','hold','safety',...(actor===O?[]:['closure'])])for(const ts of ['normal','hold','safety','closure'])for(const aal of ['aal1','aal2'])for(let i=0;i<15;i++)await tx(async()=>{
  const f=await fixture(actor);await state(actor,as);await state(B,ts);const [name,q,p]=ops(f)[i];
  const ok=as==='normal'&&!['hold','closure'].includes(ts)&&aal==='aal2'&&!['review-warning','review-restrict'].includes(name);
  await attempt(`${name}/${actor}/${as}->${ts}/${aal}`,actor,q,p,ok,{aal});
  if(ok&&name==='dispute'){await admin();assert.equal(await scalar('select count(*)::int v from public.battle_rating_events where match_id=$1',[f.m]),1);await attempt('dispute repeated',actor,q,p,false);}
 });
 // Explicit owner target: Review review remains its historical normal path;
 // only newly compatible Review closures gain the Owner protection.
 for(const rpc of [review,moderate])for(const action of ['review','resolve','dismiss','restrict'])await tx(async()=>{const f=await fixture(J,O);await attempt('owner target '+rpc+action,J,rpc,[f.r,action,'note'],rpc===review&&action==='review');});
 // Staff applications: held target never receives a new decision, including rejection.
 for(const as of ['normal','hold','safety'])for(const ts of ['normal','hold','safety','closure'])for(const action of ['approved','rejected','question'])await tx(async()=>{
  const id=uid(seq++);await db.query("insert into public.staff_applications(id,applicant_id,requested_role,motivation) values($1,$2,'judge','synthetic application')",[id,X]);
  await state(O,as);await state(X,ts);
  await attempt('application '+as+'/'+ts+'/'+action,O,'select public.review_staff_application($1,$2,$3) v',[id,action,'note'],as==='normal'&&!['hold','closure'].includes(ts));
 });
 // Session/factor gates, SQL-definer contexts and direct DML boundaries.
 for(const fault of ['no-session','foreign-session','expired','session-aal1','factor-unverified','factor-deleted','jwt-aal1','malformed','anonymous','service-jwt','player'])await tx(async()=>{
  const f=await fixture();let extra={},u=J;
  if(fault==='no-session')extra.session_id=null;if(fault==='foreign-session')extra.session_id=sid(AD);
  if(fault==='expired')await db.query("update auth.sessions set not_after=now()-interval '1 minute' where user_id=$1",[J]);
  if(fault==='session-aal1')await db.query("update auth.sessions set aal='aal1' where user_id=$1",[J]);
  if(fault==='factor-unverified')await db.query("update auth.mfa_factors set status='unverified' where user_id=$1",[J]);
  if(fault==='factor-deleted')await db.query('delete from auth.mfa_factors where user_id=$1',[J]);
  if(fault==='jwt-aal1')extra.aal='aal1';if(fault==='malformed')extra.session_id='invalid';if(fault==='anonymous')extra.is_anonymous=true;if(fault==='service-jwt')extra.role='service_role';if(fault==='player')u=X;
  await attempt('session '+fault,u,review,[f.r,'resolve','note'],false,extra);
 });
 for(const role of ['anon','authenticated','service_role','postgres'])await tx(async()=>{const f=await fixture();await attempt('RPC SQL role '+role,X,review,[f.r,'resolve','note'],false,{},role);if(role!=='postgres')for(const t of ['battle_matches','battle_reports','admin_audit_log'])await attempt('DML '+role+t,J,'delete from public.'+t,[],false,{},role);});
 // Owner governance. Only actual existing permission removal or staff -> player.
 for(const as of ['normal','hold','safety'])for(const ts of ['normal','hold','safety','closure'])for(const op of ['grant','revoke','role-player','role-judge','role-admin','policy','settings'])await tx(async()=>{
  await state(O,as);await state(J,ts);let q,p=[];
  if(op==='grant'||op==='revoke'){q='select public.set_staff_permission($1,\'reports_review\',$2) v';p=[J,op==='grant'];}
  if(op.startsWith('role-')){q='select public.set_staff_role($1,$2,\'test\') v';p=[J,op.slice(5)];}
  if(op==='policy')q='select public.dv_v16_owner_update_openai_scan_policy(false,10,2,100) v';
  if(op==='settings')q='select public.dv_v16_owner_openai_scan_settings() v';
  const ok=op==='settings'?as!=='safety':as==='normal'&&(!['hold','closure'].includes(ts)||['revoke','role-player','policy'].includes(op));
  await attempt('owner '+as+'/'+ts+'/'+op,O,q,p,ok);
 });
 await tx(async()=>{await state(J,'hold');await attempt('held null role denied',O,'select public.set_staff_role($1,null,null) v',[J],false);});
 await tx(async()=>{await state(J,'hold');await db.query("delete from public.staff_permissions where user_id=$1 and permission='reports_review'",[J]);await attempt('held absent permission is not existing revoke',O,"select public.set_staff_permission($1,'reports_review',false) v",[J],false);});
 for(const s of ['normal','hold','safety','closure'])await tx(async()=>{await fixture();await state(J,s);await attempt('read desk '+s,J,'select count(*) v from public.get_battle_disputes_for_moderation()',[],['normal','hold'].includes(s));});
 await tx(async()=>{const f=await fixture();await state(B,'hold');await db.query("update public.battle_reports set created_at='2000-01-01',reviewing_at='2000-01-01',reviewer_id=$2 where id=$1",[f.r,J]);await attempt('forged old fields never admit held target',J,review,[f.r,'resolve','note'],false);});
 assert.deepEqual(await snap(),baseline,'all isolated cases rollback');
 if(native){
  // Each race uses separate real sessions and actual pg_locks observations.
  const observer=await db.connect();await claim(null,'postgres',{},observer);
  async function blocked(pid,label){for(let i=0;i<150;i++){const r=(await observer.query('select pg_blocking_pids($1) blockers',[pid])).rows[0];if(r.blockers.length){const locks=(await observer.query('select locktype,mode,granted,relation::regclass::text relation from pg_locks where pid=$1',[pid])).rows;assert.ok(locks.some(l=>!l.granted));out.races.push({label,pid,...r,locks});return;}await delay(20);}throw Error('no lock wait '+label);}
  for(const who of ['actor','target'])for(const first of ['hold','mutation'])for(const op of ['review','dispute']){
   await admin();const actor=uid(seq++),target=uid(seq++);
   for(const [u,role] of [[actor,'judge'],[target,'player']]){
    await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[u,u+'@example.invalid']);
    await db.query("insert into public.profiles(id,email,role,account_status,age_band) values($1,$2,$3,'active','18_plus')",[u,u+'@example.invalid',role]);
    await db.query("insert into auth.mfa_factors(id,user_id,status) values($1,$2,'verified')",[fid(u),u]);
    await db.query("insert into auth.sessions(id,user_id,factor_id,aal) values($1,$2,$3,'aal2')",[sid(u),u,fid(u)]);
   }
   for(const permission of ['reports_review','review_reports','battle_moderate'])await db.query('insert into public.staff_permissions(user_id,permission,granted_by) values($1,$2,$3)',[actor,permission,O]);
   const f=await fixture(actor,target),held=who==='actor'?actor:target,hold=await db.connect(),staff=await db.connect();await claim(held,'authenticated',{},hold);await claim(actor,'authenticated',{},staff);
   const q=op==='review'?review:"select public.resolve_battle_dispute($1,'host',$2) v",p=op==='review'?[f.r,'resolve','race']:[f.m,'race'];
   const close=()=>hold.query("select public.request_my_account_deletion('KONTO LÖSCHEN',$1) v",[uid(seq++)]);
   await hold.query('begin');await staff.query('begin');
   if(first==='hold'){
    assert.equal((await close()).rows[0].v.accepted,true);const pid=(await staff.query('select pg_backend_pid() pid')).rows[0].pid;
    const pending=staff.query(q,p).then(()=>({ok:true}),e=>({ok:false,message:e.message}));await blocked(pid,who+'/'+op+'/hold-first');await hold.query('commit');const r=await pending;assert.equal(r.ok,false);assert.match(r.message,/processing_hold|privileged_session_required/);await staff.query('rollback');
   }else{
    await staff.query(q,p);const pid=(await hold.query('select pg_backend_pid() pid')).rows[0].pid;const pending=close();await blocked(pid,who+'/'+op+'/mutation-first');await staff.query('commit');assert.equal((await pending).rows[0].v.accepted,true);await hold.query('commit');
   }
   await admin();
   const row=(await db.query('select status from public.battle_reports where id=$1',[f.r])).rows[0];
   const match=(await db.query('select status from public.battle_matches where id=$1',[f.m])).rows[0];
   assert.equal(row.status,first==='mutation'&&op==='review'?'resolved':'open');
   assert.equal(match.status,first==='mutation'&&op==='dispute'?'completed':'dispute');
   assert.equal(await scalar('select count(*)::int v from public.battle_rating_events where match_id=$1',[f.m]),first==='mutation'&&op==='dispute'?1:0);
   assert.equal(await scalar("select count(*)::int v from public.admin_audit_log where details->>'report_id'=$1 or details->>'match_id'=$2",[f.r,f.m]),first==='mutation'?1:0);
   // Every race uses fresh users; no Hold clearing or reused Closure request.
  }
  for(const firstAction of ['resolve','dismiss']){
   const f=await fixture(),c1=await db.connect(),c2=await db.connect();await claim(J,'authenticated',{},c1);await claim(AD,'authenticated',{},c2);await c1.query('begin');await c2.query('begin');
   await c1.query(review,[f.r,firstAction,'first']);const pid=(await c2.query('select pg_backend_pid() pid')).rows[0].pid;
   const pending=c2.query(review,[f.r,firstAction==='resolve'?'dismiss':'resolve','second']).then(()=>({ok:true}),e=>({ok:false,message:e.message}));
   await blocked(pid,'concurrent closure '+firstAction);await c1.query('commit');const r=await pending;assert.equal(r.ok,false);assert.match(r.message,/report_already_closed/);await c2.query('rollback');await admin();
   assert.equal(await scalar("select count(*)::int v from public.admin_audit_log where details->>'report_id'=$1",[f.r]),1);
   assert.equal(await scalar('select reviewer_id v from public.battle_reports where id=$1',[f.r]),J);
  }
 }
 out.passed=true;out.acceptance=native;
}finally{await mkdir('test-results',{recursive:true});await writeFile('test-results/staff-processing-hold-'+(native?'native':'preparation')+'.json',JSON.stringify(out,null,2));await db.close();}
console.log(JSON.stringify({passed:out.passed,native,acceptance:out.acceptance,cases:out.cases.length,races:out.races.length}));
