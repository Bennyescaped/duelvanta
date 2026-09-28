// Evidence only: unchanged application through D2, disposable native PG17 only.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {createDatabase} from './helpers/f3-native-db.mjs';
import {securitySchemaFixture,read} from './helpers/security-schema-fixture.mjs';
import {epochSecurityQuery} from './generate-security-readiness.mjs';
const db=await createDatabase();
const output={native:true,version:db.version,applicationChanged:false,liveApplied:false,head:process.env.GITHUB_SHA||null,sources:{},cases:[],locks:[],events:[],passed:false};
const uid=n=>`81000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const O=uid(1),J=uid(2);let seq=100;const clients=[];
const scalar=async(c,q,p=[])=>(await c.query(q,p)).rows[0]?.v;
const sid=u=>u.replace('81000000','81100000'),fid=u=>u.replace('81000000','81200000');
async function claim(c,u,role='authenticated'){await c.query('reset role');await c.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:u,role,aal:'aal2',session_id:sid(u)})]);await c.query('set role '+role);}
const admin=()=>claim(db,O,'postgres');
async function user(role='player') {const u=uid(seq++),email=role==='owner'?'info@duelvanta.de':u+'@example.invalid';await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[u,email]);await db.query("insert into public.profiles(id,email,role,account_status,age_band,conduct_accepted_at,conduct_version) values($1,$2,$3,'active','18_plus',now(),'battle-v1-2026-09')",[u,email,role]);await db.query("insert into auth.mfa_factors(id,user_id,status) values($1,$2,'verified')",[fid(u),u]);await db.query("insert into auth.sessions(id,user_id,factor_id,aal) values($1,$2,$3,'aal2')",[sid(u),u,fid(u)]);return u;}
async function conn(u,role='authenticated'){const c=await db.connect();clients.push(c);await claim(c,u,role);return c;}
async function event(label,c=db){const r=(await c.query('select clock_timestamp()::text observed_at,now()::text tx_start,pg_backend_pid() pid')).rows[0];output.events.push({label,...r});return r;}
async function pending(c,q,p=[]){const pid=await scalar(c,'select pg_backend_pid() v');return{pid,result:c.query(q,p).then(r=>({ok:true,rows:r.rows}),e=>({ok:false,message:e.message,code:e.code}))};}
async function blocked(task,label){for(let n=0;n<150;n++){const r=(await observer.query("select pid,pg_blocking_pids(pid) blockers,wait_event_type,wait_event from pg_stat_activity where pid=$1",[task.pid])).rows[0];if(r?.blockers.length){const locks=(await observer.query('select locktype,mode,granted,relation::regclass::text relation,transactionid::text transactionid from pg_locks where pid=$1 order by locktype,mode,granted',[task.pid])).rows;output.locks.push({label,...r,locks});assert.ok(locks.some(l=>!l.granted));return;}await delay(20);}throw Error('No actual blocking: '+label);}
async function finish(task){const r=await task.result;assert.equal(r.ok,true,JSON.stringify(r));return r.rows[0]?.v;}
async function fixture(swap){await admin();const a=await user(),b=await user(),host=swap?b:a,guest=swap?a:b,m=uid(seq++);await db.query("insert into public.battle_matches(id,host_id,guest_id,tcg,status,visibility,mode) values($1,$2,$3,'pokemon','live','private','ranked')",[m,host,guest]);return{a,b,host,guest,m,target:b,reporter:a};}
async function closure(c,f,label){const r=await scalar(c,"select public.request_my_account_deletion('KONTO LÖSCHEN',$1) v",[uid(seq++)]);assert.equal(r.accepted,true,JSON.stringify(r));await event(label,c);return r;}
async function reportState(id){await admin();return(await db.query(`select r.id,r.status,r.created_at::text report_created_at,r.reviewing_at::text,r.resolved_at::text,r.reviewer_id,r.resolution_action,
 p.data_processing_restricted_at::text hold_at,r.created_at<p.data_processing_restricted_at report_time_before_hold,
 (select jsonb_agg(jsonb_build_object('action',a.action,'actor',a.actor_id,'target',a.target_user_id,'created_at',a.created_at::text,'before_hold',a.created_at<p.data_processing_restricted_at,'details',a.details) order by a.id) from public.admin_audit_log a where a.details->>'report_id'=r.id::text) audits
 from public.battle_reports r join public.profiles p on p.id=r.reported_user_id where r.id=$1`,[id])).rows[0];}
async function matchState(f){await admin();return(await db.query(`select m.status,m.host_result,m.guest_result,m.created_at::text,m.updated_at::text,p.data_processing_restricted_at::text hold_at,
 m.updated_at<p.data_processing_restricted_at match_time_before_hold,
 (select count(*)::int from public.battle_rating_events e where e.match_id=m.id) rating_events
 from public.battle_matches m join public.profiles p on p.id=$2 where m.id=$1`,[f.m,f.target])).rows[0];}
let observer;
try{
 await securitySchemaFixture(db);
 for(const [u,role,email] of [[O,'owner','info@duelvanta.de'],[J,'judge','d3-judge@example.invalid']]){
  await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[u,email]);
  await db.query("insert into public.profiles(id,email,role,account_status,age_band) values($1,$2,$3,'active','18_plus')",[u,email,role]);
  await db.query("insert into auth.mfa_factors(id,user_id,status) values($1,$2,'verified')",[fid(u),u]);
  await db.query("insert into auth.sessions(id,user_id,factor_id,aal) values($1,$2,$3,'aal2')",[sid(u),u,fid(u)]);
 }
 const files=['auth-privileged-step-up-v1','security-privilege-mfa-hardening-v1','security-readiness-v1','market-production-trade-lock-v1','market-production-trade-lock-readiness-v1','account-data-export-collect-battle-v1','account-data-export-trade-lock-readiness-v1','account-processing-markers-v1','account-processing-markers-readiness-v1','account-closure-privacy-v1','account-closure-privacy-readiness-v1','scanner-processing-hold-v1','scanner-processing-hold-readiness-v1','battle-player-processing-hold-v1','battle-player-processing-hold-readiness-v1','battle-signal-processing-hold-v1','battle-signal-processing-hold-readiness-v1','battle-spectator-withdrawal-v1','battle-spectator-withdrawal-readiness-v1','battle-spectator-epoch-processing-hold-v1','battle-spectator-epoch-processing-hold-readiness-v1'];
 for(const f of files){const s=await read('database/'+f+'.sql');output.sources[f]=createHash('sha256').update(s).digest('hex');await db.exec(s);}
 // The existing historical permission string is fixture data, no new permission or alias.
 await db.query("insert into public.staff_permissions(user_id,permission,granted_by) values($1,'review_reports',$2),($1,'reports_review',$2),($1,'battle_moderate',$2)",[J,O]);
 observer=await conn(O,'postgres');
 output.server=(await db.query("select version(),current_setting('track_commit_timestamp') track_commit_timestamp,current_setting('transaction_isolation') isolation")).rows[0];
 const catalog=(await db.query(epochSecurityQuery)).rows;
 output.functions=(await db.query("select n.nspname schema,p.proname name,pg_get_functiondef(p.oid) definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where (n.nspname='public' and p.proname in ('report_battle_user','review_battle_report','moderate_battle_report','report_battle_result','resolve_battle_dispute','request_my_account_deletion')) or (n.nspname='dv_market_private' and p.proname='account_deletion_blockers') order by 1,2")).rows;
 output.columns=(await db.query("select table_schema,table_name,column_name,column_default,data_type from information_schema.columns where (table_schema='public' and table_name in ('battle_reports','battle_matches','admin_audit_log')) or (table_schema='dv_market_private' and table_name in ('account_deletion_requests','account_data_rights_audit')) order by 1,2,ordinal_position")).rows;
 for(const swap of [false,true]){
  // An actual RPC starts before the Hold, blocked in its existing legacy permission SELECT.
  // The report does not yet exist. Only the authentic reporter's broad INSERT supplies its ID.
  for(const fake of [false,true]){
   const f=await fixture(swap),id=uid(seq++),staff=await conn(J),holder=await conn(f.target),reporter=await conn(f.reporter),lock=await conn(O,'postgres');
   await lock.query('begin;lock table public.staff_permissions in access exclusive mode');
   await staff.query('begin');await event('staff begins before report/Hold',staff);
   const task=await pending(staff,"select public.review_battle_report($1,'review','native temporal evidence') v",[id]);await blocked(task,'review permission lock before Hold');
   await closure(holder,f,'real Closure completed');await event('Closure committed',holder);
   await reporter.query(`insert into public.battle_reports(id,match_id,reporter_id,reported_user_id,category${fake?',created_at,status,reviewer_id,reviewing_at,resolved_at,resolution_action':''}) values($1,$2,$3,$4,'other'${fake?",'2000-01-01','reviewing',$5,'2000-01-02','2000-01-03','restrict'":''})`,fake?[id,f.m,f.reporter,f.target,O]:[id,f.m,f.reporter,f.target]);
   await event('new report committed after Closure',reporter);await lock.query('commit');assert.equal(await finish(task),'review');await staff.query('commit');await event('old staff transaction committed',staff);
   const state=await reportState(id);assert.equal(state.audits.length,1);assert.equal(state.audits[0].before_hold,true);assert.equal(state.report_time_before_hold,fake);assert.equal(state.reviewer_id,J);
   output.cases.push({kind:'report_created_after_hold_old_waiting_review',swap,fake,state,conclusion:'audit timestamp is a false positive; report fields are spoofable'});
  }
  for(const auditBefore of [false,true]){
   const f=await fixture(swap),reporter=await conn(f.reporter),staff=await conn(J),holder=await conn(f.target),lock=await conn(O,'postgres');
   const id=await scalar(reporter,"select public.report_battle_user($1,$2,'other','existing report') v",[f.m,f.target]);await event('RPC report committed before Hold',reporter);
   if(auditBefore){assert.equal(await scalar(staff,"select public.moderate_battle_report($1,'review','prior review') v",[id]),'review');await event('prior audit committed before Hold',staff);}
   await holder.query('begin');await closure(holder,f,'Closure pending commit');
   // Hold real report row so the later review demonstrably waits; Closure itself does not lock reports.
   await lock.query('begin');await lock.query('select id from public.battle_reports where id=$1 for update',[id]);
   const task=await pending(staff,"select public.moderate_battle_report($1,'review','after hold review') v",[id]);await blocked(task,'existing report row lock');
   await holder.query('commit');await event('Closure commit before review completion',holder);await lock.query('commit');assert.equal(await finish(task),'review');
   const state=await reportState(id);assert.equal(state.report_time_before_hold,true);assert.equal(state.audits.length,auditBefore?2:1);assert.equal(state.audits[0].before_hold,auditBefore);
   output.cases.push({kind:'report_exists_before_hold',swap,auditBefore,state,conclusion:'known test schedule proves age; stored audit chronology alone does not universally prove it'});
  }
  // Participant result transaction starts first; Closure acquires the real match lock first.
  for(const first of ['closure','result']){
   const f=await fixture(swap),a=await conn(f.host),b=await conn(f.guest),holder=await conn(f.target);
   assert.equal(await scalar(a,"select public.report_battle_result($1,'host') v",[f.m]),'live');await event('first player result committed',a);
   await b.query('begin');await event('second result transaction starts',b);
   if(first==='closure'){
    await holder.query('begin');await closure(holder,f,'Closure owns profile and match locks');
    const task=await pending(b,"select public.report_battle_result($1,'guest') v",[f.m]);await blocked(task,'result behind actual Closure match lock');
    await holder.query('commit');await event('Closure committed before dispute exists',holder);assert.equal(await finish(task),'dispute');await b.query('commit');await event('new dispute committed after Closure',b);
   }else{
    assert.equal(await scalar(b,"select public.report_battle_result($1,'guest') v",[f.m]),'dispute');await event('dispute uncommitted, owns match',b);
    const task=await pending(holder,"select public.request_my_account_deletion('KONTO LÖSCHEN',$1) v",[uid(seq++)]);await blocked(task,'actual Closure behind result match lock');
    await b.query('commit');await event('dispute committed before Closure completion',b);assert.equal((await finish(task)).accepted,true);await event('Closure committed after dispute',holder);
   }
   const state=await matchState(f);assert.equal(state.status,'dispute');assert.equal(state.match_time_before_hold,true);assert.equal(state.rating_events,0);
   output.cases.push({kind:'dispute_real_lock_orders',swap,first,state,conclusion:first==='closure'?'updated_at is false positive for pre-Hold dispute':'control: dispute commits first'});
  }
  // Long-lived report creator: even the unmodified report RPC defaults can predate a later Hold.
  {
   const f=await fixture(swap),reporter=await conn(f.reporter),holder=await conn(f.target),staff=await conn(J),lock=await conn(O,'postgres');
   await reporter.query('begin');await event('report creator transaction starts first',reporter);
   await closure(holder,f,'Closure committed before RPC report creation');
   const id=await scalar(reporter,"select public.report_battle_user($1,$2,'other','late RPC insert') v",[f.m,f.target]);await reporter.query('commit');
   await lock.query('begin');await lock.query('select id from public.battle_reports where id=$1 for update',[id]);
   const task=await pending(staff,"select public.review_battle_report($1,'review','after hold') v",[id]);await blocked(task,'RPC-created report review row wait');await lock.query('commit');await finish(task);
   const state=await reportState(id);assert.equal(state.report_time_before_hold,true);assert.equal(state.audits[0].before_hold,false);
   output.cases.push({kind:'report_rpc_default_backdates_in_long_transaction',swap,state});
  }
 }
 await admin();assert.deepEqual((await db.query(epochSecurityQuery)).rows,catalog,'application/catalog must remain identical');
 assert.equal((await scalar(db,'select public.get_security_schema_readiness_v1() v')).compatible,true);
 assert.equal((await scalar(db,'select public.get_market_legal_schema_readiness_v1() v')).compatible,true);
 output.passed=true;output.result='B';output.scope='Existing persisted application timestamps/audit references alone do not prove pre-Hold existence. Test observer ordering is evidence about synthetic runs, not a new application evidence source.';
 console.log('D3_TEMPORAL_RESULT '+JSON.stringify({passed:true,result:output.result,version:db.version,cases:output.cases.length,realLockWaits:output.locks.length,applicationChanged:false}));
}catch(e){output.error={message:e.message,stack:e.stack};console.error(output.error);process.exitCode=1;}
finally{for(const c of clients){try{await c.query('rollback')}catch{}}try{await db.exec('rollback')}catch{}await db.close();output.cleanup='disposable database dropped';await mkdir('test-results',{recursive:true});await writeFile('test-results/battle-d3-temporal-native.json',JSON.stringify(output,null,2));}
