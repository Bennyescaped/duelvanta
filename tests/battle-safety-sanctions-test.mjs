// Isolated B1 semantics. Only --native can attest real PG17 lock races.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';
import {publicationFixture,uid,O,J,A,B,C,D,claim,admin} from './helpers/publication-hold-fixture.mjs';
import {read} from './helpers/security-schema-fixture.mjs';
const native=process.argv.includes('--native');let db;
if(native){db=await (await import('./helpers/f3-native-db.mjs')).createDatabase();}
else {const {PGlite}=await import('@electric-sql/pglite');const {pgcrypto}=await import('@electric-sql/pglite/contrib/pgcrypto');db=new PGlite({extensions:{pgcrypto}});}
const out={native,acceptance:false,passed:false,cases:[],races:[],version:db.version||'PGlite preparation'};
let seq=3000;
const scalar=async(sql,p=[],c=db)=>(await c.query(sql,p)).rows[0]?.v;
const restrictSQL="select public.moderate_battle_report($1,'restrict','synthetic decision') v";
const undoSQL='select public.owner_unrestrict_battle_sanction($1,$2) v';
const legacySQL='select public.owner_review_legacy_battle_safety($1,$2) v';
const deletionSQL="select public.request_my_account_deletion('KONTO LÖSCHEN',$1) v";
async function report(target=B){await admin(db);const m=uid(seq++),r=uid(seq++);await db.query("insert into battle_matches(id,host_id,guest_id,tcg,status,visibility,mode) values($1,$2,$3,'pokemon','dispute','private','ranked')",[m,A,target]);await db.query("insert into battle_reports(id,match_id,reporter_id,reported_user_id,category) values($1,$2,$3,$4,'other')",[r,m,A,target]);return r;}
async function sanction(target=B){const r=await report(target);await claim(db,O);await db.query(restrictSQL,[r]);await admin(db);const id=await scalar("select id v from dv_market_private.battle_safety_causes where report_id=$1",[r]);assert.ok(id);return {r,id};}
async function safety(target=B){await admin(db);return scalar('select safety_restricted v from profiles where id=$1',[target]);}
const tables=['public.profiles','public.battle_reports','public.battle_matches','public.battle_ratings','public.battle_rating_events','public.admin_audit_log','auth.users','auth.sessions','public.market_seller_accounts','dv_market_private.account_deletion_requests','dv_market_private.account_deletion_holds','dv_market_private.battle_safety_causes','dv_market_private.battle_safety_releases'];
async function snap(){await admin(db);const s={};for(const t of tables)s[t]=await scalar(`select coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text),'[]') v from ${t} x`);return s;}
async function tx(label,fn){await admin(db);await db.exec('begin');try{await fn();out.cases.push(label);}finally{await db.exec('rollback');await admin(db);}}
async function deny(label,u,sql,p,pattern,role='authenticated',extra={}){
 const before=await snap();await claim(db,u,role,extra);await db.exec('savepoint denied');let error;
 try{await db.query(sql,p);}catch(e){error=e;await db.exec('rollback to savepoint denied');}
 await db.exec('release savepoint denied');assert.ok(error,label);assert.match(error.message,pattern,label);assert.deepEqual(await snap(),before,label+' atomic denial');
}
try{
 await publicationFixture(db);await admin(db);
 await db.exec('alter table auth.users add column banned_until timestamptz');
 await db.query("insert into dv_market_private.data_retention_rules(category,purpose,legal_basis,retention_rule,policy_version) values('contract_evidence','synthetic fixture','synthetic fixture','synthetic fixture','fixture') on conflict do nothing");
 await db.exec(await read('database/publication-processing-hold-v1.sql'));
 await db.exec(await read('database/publication-processing-hold-readiness-v1.sql'));
 await db.query('update profiles set safety_restricted=true where id=$1',[D]);
 const candidate=await read('database/battle-safety-sanctions-v1.sql');await db.exec(candidate);await db.exec(candidate);
 assert.equal(await scalar("select count(*)::int v from dv_market_private.battle_safety_causes where target_id=$1 and kind='legacy_unknown'",[D]),1);
 assert.equal((await scalar('select get_security_schema_readiness_v1() v')).compatible,false);
 await db.exec(await read('database/battle-safety-sanctions-readiness-v1.sql'));
 assert.equal((await scalar('select get_security_schema_readiness_v1() v')).compatible,true);
 assert.equal((await scalar('select get_market_legal_schema_readiness_v1() v')).compatible,true);
 if(process.argv.includes('--c-withdrawal')){await db.exec(await read('database/account-deletion-withdrawal-v1.sql'));await db.exec(await read('database/account-deletion-withdrawal-readiness-v1.sql'));}

 await tx('normal restriction; exact audit/report binding; immutable originals; idempotent undo',async()=>{
  const {r,id}=await sanction();assert.equal(await safety(),true);
  const audit=await scalar("select details v from admin_audit_log where details->>'report_id'=$1",[r]);assert.equal(audit.sanction_id,id);
  await claim(db,O);out.ui=await scalar('select get_owner_battle_safety_causes($1) v',[B]);
  const before=await snap();await claim(db,O);const result=await scalar(undoSQL,[id,'Decision was incorrect']);assert.equal(result.safety_restricted,false);
  const after=await snap();for(const t of tables.filter(t=>!['public.profiles','public.admin_audit_log','dv_market_private.battle_safety_releases'].includes(t)))assert.deepEqual(after[t],before[t],t);
  const stableProfiles=rows=>rows.map(({safety_restricted,updated_at,...rest})=>rest);assert.deepEqual(stableProfiles(after['public.profiles']),stableProfiles(before['public.profiles']));
  assert.deepEqual(after['public.admin_audit_log'].filter(x=>x.action==='battle_report_restrict'),before['public.admin_audit_log']);
  await claim(db,O);assert.equal((await scalar(undoSQL,[id,'repeat'])).replayed,true);assert.deepEqual(await snap(),after);
  await deny('immutable cause',O,'update dv_market_private.battle_safety_causes set reason=$2 where id=$1',[id,'overwrite'],/permission denied/);
  await deny('even direct owner DML cannot rewrite original evidence',null,'update dv_market_private.battle_safety_causes set reason=$2 where id=$1',[id,'overwrite'],/safety_evidence_immutable/,'postgres');
 });
 await tx('two active B1 causes: undo one preserves the other',async()=>{const x=await sanction(),y=await sanction();await claim(db,O);assert.equal((await scalar(undoSQL,[x.id,'first incorrect'])).safety_restricted,true);await claim(db,O);assert.equal((await scalar(undoSQL,[y.id,'second incorrect'])).safety_restricted,false);});
 await tx('independent account, Auth and seller suspension preserved',async()=>{
  const x=await sanction();await db.query("update profiles set account_status='suspended' where id=$1",[B]);await db.query("update auth.users set banned_until=now()+interval '1 year' where id=$1",[B]);
  await db.query("insert into market_seller_accounts(seller_id,seller_type,onboarding_status,suspended_at) values($1,'private','suspended',now())",[B]);
  const before=await snap();await claim(db,O);await scalar(undoSQL,[x.id,'Only B1 incorrect']);const after=await snap();
  for(const t of ['auth.users','public.market_seller_accounts','dv_market_private.account_deletion_holds'])assert.deepEqual(after[t],before[t]);assert.equal(await scalar('select account_status v from profiles where id=$1',[B]),'suspended');
 });
 await tx('B1 then C and D; no undo, no retention release or cross-system mutation',async()=>{
  const x=await sanction();await claim(db,B);const request=await scalar(deletionSQL,[uid(seq++)]);assert.equal(request.accepted,true);
  await admin(db);await db.query("insert into dv_market_private.account_deletion_holds(request_id,user_id,category,reason,manual_review_required) values($1,$2,'contract_evidence','Synthetic retained evidence',true)",[request.request_id,B]);
  await deny('B1+C+D',O,undoSQL,[x.id,'incorrect'],/data_rights_hold/);assert.equal(await safety(),true);
 });
 for(const state of ['processing','closure','request_only'])await tx('target '+state+' fails closed',async()=>{
  const x=await sanction();await admin(db);
  if(state==='request_only')await db.query("insert into dv_market_private.account_deletion_requests(user_id,request_key,status) values($1,$2,'failed')",[B,uid(seq++)]);
  else await db.query(`update profiles set ${state==='processing'?'data_processing_restricted_at':'account_closure_requested_at'}=now() where id=$1`,[B]);
  await deny(state,O,undoSQL,[x.id,'incorrect'],/data_rights_hold/);
 });
 for(const role of ['admin','moderator','judge'])await tx(role+' cannot owner-unrestrict',async()=>{
  const x=await sanction();await db.query('update profiles set role=$2 where id=$1',[J,role]);for(const p of ['reports_review','users_restrict'])await db.query('insert into staff_permissions(user_id,permission,granted_by) values($1,$2,$3) on conflict do nothing',[J,p,O]);
  await deny(role,J,undoSQL,[x.id,'incorrect'],/owner_access_required/);
 });
 await tx('Owner AAL1, actor processing, actor safety and service-role denied',async()=>{
  const x=await sanction();await deny('AAL1',O,undoSQL,[x.id,'incorrect'],/mfa_step_up_required/,'authenticated',{aal:'aal1'});
  await deny('service',O,undoSQL,[x.id,'incorrect'],/permission denied/,'service_role');
  await db.query('update profiles set data_processing_restricted_at=now() where id=$1',[O]);
  await deny('actor',O,undoSQL,[x.id,'incorrect'],/privileged_session_required|staff_actor_processing_hold/);
 });
 await tx('actor safety denied',async()=>{const x=await sanction();await db.query('update profiles set safety_restricted=true where id=$1',[O]);await deny('actor safety',O,undoSQL,[x.id,'incorrect'],/privileged_session_required/);});
 await tx('Legacy cannot auto-release; explicit owner review only when no other cause',async()=>{
  const id=await scalar("select id v from dv_market_private.battle_safety_causes where target_id=$1",[D]);
  await deny('wrong endpoint',O,undoSQL,[id,'incorrect'],/safety_cause_not_found/);
  await deny('blank',O,legacySQL,[id,' '],/correction_reason_required/);
  const x=await sanction(D);await deny('active B1',O,legacySQL,[id,'reviewed evidence'],/other_safety_cause_active/);
  await claim(db,O);assert.equal((await scalar(undoSQL,[x.id,'wrong B1'])).safety_restricted,true);
  await claim(db,O);assert.equal((await scalar(legacySQL,[id,'Owner reviewed legacy facts'])).safety_restricted,false);
 });
 await tx('Legacy target Hold blocks separate review',async()=>{const id=await scalar('select id v from dv_market_private.battle_safety_causes where target_id=$1',[D]);await db.query('update profiles set account_closure_requested_at=now() where id=$1',[D]);await deny('legacy hold',O,legacySQL,[id,'reviewed'],/data_rights_hold/);});
 await tx('unexplained flag becomes unknown; raw false never drops cause',async()=>{await db.query('update profiles set safety_restricted=true where id=$1',[B]);assert.equal(await scalar("select count(*)::int v from dv_market_private.battle_safety_causes where target_id=$1 and kind='legacy_unknown'",[B]),1);await db.query('update profiles set safety_restricted=false where id=$1',[B]);assert.equal(await safety(),true);});
 await tx('review restriction disabled, owner target protected, invalid permissions denied',async()=>{
  const r=await report();await deny('old review',O,"select review_battle_report($1,'restrict','note')",[r],/review_action_disabled/);
  const ownerReport=await report(O);await deny('owner target',O,restrictSQL,[ownerReport],/Owner cannot be targeted/);
  await deny('missing users_restrict',J,restrictSQL,[r],/users_restrict permission required/);
 });
 await tx('stale readiness fails closed on disabled projection',async()=>{await db.exec('alter table profiles disable trigger b1_safety_projection');assert.equal((await scalar('select get_security_schema_readiness_v1() v')).compatible,false);});
 // Real independent connections and observed pg_stat_activity lock waits.
 if(native){
  await admin(db);await db.query("insert into staff_permissions(user_id,permission,granted_by) values($1,'users_restrict',$2) on conflict do nothing",[J,O]);
  async function race(kind,reverse=false,isolation='read committed'){
   await admin(db);const target=uid(seq++);await db.query('insert into auth.users(id,email) values($1,$2)',[target,target+'@example.invalid']);await db.query("insert into profiles(id,email,role,account_status) values($1,$2,'player','active')",[target,target+'@example.invalid']);
   const x=await sanction(target),r=await report(target);const a=await db.connect(),b=await db.connect();
   const first=reverse?'undo':kind,second=reverse?kind:'undo';
   // Different authorized actors: prove target-row serialization, not merely
   // contention on the same Owner's actor row.
   const actor=t=>t==='delete'?target:t==='restrict'?J:O;
   const operation=async(c,t)=>{if(t==='delete')return scalar(deletionSQL,[uid(seq++)],c);if(t==='restrict')return scalar(restrictSQL,[r],c);return scalar(undoSQL,[x.id,'race correction'],c);};
   await claim(a,actor(first));await a.query('begin');await operation(a,first);
   await claim(b,actor(second));await b.query('begin isolation level '+isolation);
   if(isolation!=='read committed')await b.query('select count(*) from public.profiles');
   const pid=(await b.query('select pg_backend_pid() pid')).rows[0].pid;
   let done=false;const pending=operation(b,second).then(value=>({value}),error=>({error:error.message})).finally(()=>{done=true});
   let waited=false;for(let i=0;i<100&&!done;i++){const row=(await db.query('select wait_event_type from pg_stat_activity where pid=$1',[pid])).rows[0];if(row?.wait_event_type==='Lock'){waited=true;break}await delay(20);}
   assert.equal(waited,true,'native contender must actually wait');await a.query('commit');const outcome=await pending;
   if(outcome.error)await b.query('rollback');else await b.query('commit');
   if(!reverse&&kind==='delete')assert.match(outcome.error,/data_rights_hold|could not serialize/);
   else if(isolation==='read committed')assert.equal(outcome.error,undefined);
   else assert.match(outcome.error,/could not serialize/);
   assert.equal(await safety(target),true,'other cause remains');
   out.races.push({kind,reverse,isolation,waited,...outcome});
  }
  for(const kind of ['delete','restrict'])for(const reverse of [false,true])await race(kind,reverse);
  for(const kind of ['delete','restrict'])await race(kind,false,'repeatable read');
 }
 out.passed=true;out.acceptance=native&&out.races.length===6;
}finally{
 await mkdir('test-results',{recursive:true});await writeFile('test-results/battle-safety-sanctions-'+(native?'native':'preparation')+'.json',JSON.stringify(out,null,2));await db.close();
}
console.log(JSON.stringify({passed:out.passed,native,acceptance:out.acceptance,cases:out.cases.length,races:out.races.length}));
