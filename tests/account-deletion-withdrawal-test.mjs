// No real users/services. PGlite prepares semantics; only --native attests PG17 races.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';
import {publicationFixture,A,B,C,D,O,J,uid,sid,fid,claim,admin} from './helpers/publication-hold-fixture.mjs';
import {read} from './helpers/security-schema-fixture.mjs';
const native=process.argv.includes('--native');
const db=native?await(await import('./helpers/f3-native-db.mjs')).createDatabase():new(await import('@electric-sql/pglite')).PGlite({extensions:{pgcrypto:(await import('@electric-sql/pglite/contrib/pgcrypto')).pgcrypto}});
const out={native,acceptance:false,passed:false,cases:[],races:[],version:db.version||'PGlite preparation'};
const scalar=async(sql,p=[],c=db)=>(await c.query(sql,p)).rows[0]?.v;
const requestSQL="select request_my_account_deletion('KONTO LÖSCHEN',$1) v",withdrawSQL='select withdraw_my_account_deletion($1,$2) v',enterSQL='select enter_account_deletion_prepare($1,$2) v';
const snapshots=['auth.users','public.market_seller_accounts','dv_market_private.account_deletion_holds','public.battle_reports','public.battle_matches','public.battle_ratings','public.battle_rating_events','public.admin_audit_log','dv_market_private.battle_safety_causes','dv_market_private.battle_safety_releases'];
async function snap(){await admin(db);const o={};for(const t of snapshots)o[t]=await scalar(`select coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text),'[]') v from ${t} x`);return o;}
async function request(u=B){await claim(db,u);return (await scalar(requestSQL,[randomUUID()])).request_id;}
async function reauth(r,u=B,c=db){await claim(c,u);const ch=await scalar('select begin_my_account_deletion_withdrawal($1) v',[r],c);await admin(c);const s=randomUUID();await c.query("insert into auth.sessions(id,user_id,factor_id,aal,created_at) values($1,$2,$3,'aal2',clock_timestamp())",[s,u,fid(u)]);await claim(c,u,'authenticated',{session_id:s});return {ch,s};}
async function withdraw(r,auth,u=B,c=db){await claim(c,u,'authenticated',{session_id:auth.s});return scalar(withdrawSQL,[r,auth.ch],c);}
async function worker(r,c=db){await claim(c,null,'service_role');const token=randomUUID();const rows=(await c.query('select * from claim_account_deletion_requests(20,$1)',[token])).rows;assert.ok(rows.some(x=>x.request_id===r));return token;}
async function deny(fn,re){await db.exec('savepoint denied');let error;try{await fn();}catch(e){error=e;await db.exec('rollback to savepoint denied');}await db.exec('release savepoint denied');assert.ok(error,'expected denial');assert.match(error.message,re);}
async function tx(name,fn){await admin(db);await db.exec('begin');try{await fn();out.cases.push(name);}finally{await db.exec('rollback');await admin(db);}}
try{
 await publicationFixture(db);await admin(db);
 const fks=async()=>{await admin(db);return(await db.query("select conrelid::regclass::text source,confrelid::regclass::text target,conname,confdeltype,pg_get_constraintdef(oid) definition from pg_constraint where contype='f' and (confrelid='auth.users'::regclass or conrelid in ('public.profiles'::regclass,'public.battle_reports'::regclass,'public.battle_matches'::regclass)) order by conrelid,conname")).rows;};const originalFK=await fks();
 for(const f of ['publication-processing-hold-v1','publication-processing-hold-readiness-v1','battle-safety-sanctions-v1','battle-safety-sanctions-readiness-v1','account-deletion-withdrawal-v1'])await db.exec(await read('database/'+f+'.sql'));
 await db.exec(await read('database/account-deletion-withdrawal-v1.sql'));
 await db.exec(await read('database/account-deletion-withdrawal-readiness-v1.sql'));
 out.L2=await fks();assert.deepEqual(out.L2,originalFK,'C does not change Auth/Profile/BATTLE deletion cascades');
 assert.equal((await scalar('select get_security_schema_readiness_v1() v')).compatible,true);
 assert.equal((await scalar('select get_market_legal_schema_readiness_v1() v')).compatible,true);
 await tx('requested -> exact C withdrawal; immutable receipt; idempotence; new request independent',async()=>{
 const r=await request(),a=await reauth(r);const before=await snap();const result=await withdraw(r,a);assert.equal(result.withdrawn,true);
 assert.deepEqual(await snap(),before);const p=await scalar('select to_jsonb(p) v from profiles p where id=$1',[B]);assert.equal(p.data_processing_restricted_at,null);assert.equal(p.account_closure_requested_at,null);assert.equal(p.safety_restricted,false);assert.equal(p.collection_visibility,'private');
 assert.equal((await withdraw(r,a)).receipt_id,result.receipt_id);
 const next=await request();assert.notEqual(next,r);assert.equal((await withdraw(r,a)).replayed,true);
 await admin(db);assert.equal(await scalar('select status v from dv_market_private.account_deletion_requests where id=$1',[next]),'requested');assert.ok(await scalar('select data_processing_restricted_at v from profiles where id=$1',[B]));
 await deny(()=>db.query('delete from dv_market_private.c_withdrawal_receipts where request_id=$1',[r]),/immutable/);
 });
 await tx('claim is reversible; old token loses prepare and finish; future claim empty',async()=>{
 const r=await request(),a=await reauth(r),t=await worker(r);await withdraw(r,a);await claim(db,null,'service_role');
 await deny(()=>db.query(enterSQL,[r,t]),/lock_invalid/);await deny(()=>db.query('select prepare_account_deletion_data($1,$2)',[r,t]),/lock_invalid/);await deny(()=>db.query('select finish_account_deletion_request($1,$2,false,null)',[r,t]),/lock_invalid/);
 assert.equal((await db.query('select * from claim_account_deletion_requests(20,$1)',[randomUUID()])).rows.length,0);
 });
 await tx('entry gate cannot be combined with prepare in one transaction',async()=>{
 const r=await request(),t=await worker(r);await db.query(enterSQL,[r,t]);await deny(()=>db.query('select prepare_account_deletion_data($1,$2)',[r,t]),/must_be_committed/);
 const a=await reauth(r);await deny(()=>withdraw(r,a),/prepare_or_history/);
 });
 for(const state of ['failed','cancelled','requested','retained','completed'])await tx('historical '+state+' never becomes trusted',async()=>{
 await admin(db);const old=randomUUID();await db.query('insert into dv_market_private.account_deletion_requests(id,user_id,request_key,status) values($1,$2,$3,$4)',[old,B,randomUUID(),state]);
 let r=old;if(['failed','cancelled','completed'].includes(state))r=await request();
 const a=await reauth(r);await deny(()=>withdraw(r,a),/provenance|history/);
 });
 for(const kind of ['b1','legacy_unknown'])await tx(kind+' + C preserves sanction, D, account/Auth/seller and evidence',async()=>{
 await admin(db);await db.query("insert into dv_market_private.battle_safety_causes(target_id,kind,actor_id,report_id,reason) values($1,$2,$3,$4,'fixture provenance')",[B,kind,O,randomUUID()]);
 await db.query("update profiles set safety_restricted=true,account_status='suspended' where id=$1",[B]);
 await db.query("insert into market_seller_accounts(seller_id,seller_type,onboarding_status,suspended_at) values($1,'private','suspended',now())",[B]);
 const r=await request();await admin(db);
 await db.query("insert into dv_market_private.data_retention_rules(category,purpose,legal_basis,retention_rule,policy_version) values('contract_evidence','fixture','fixture','fixture','fixture') on conflict do nothing");
 await db.query("insert into dv_market_private.account_deletion_holds(request_id,user_id,category,reason,manual_review_required) values($1,$2,'contract_evidence','fixture',true)",[r,B]);
 const a=await reauth(r),before=await snap();await withdraw(r,a);assert.deepEqual(await snap(),before);await admin(db);
 assert.equal(await scalar('select safety_restricted v from profiles where id=$1',[B]),true);assert.equal(await scalar('select account_status v from profiles where id=$1',[B]),'suspended');
 assert.equal(await scalar('select dv_market_private.b1_data_rights_blocked($1) v',[B]),false);
 });
 await tx('D1 consent/link withdrawals and D2 held epoch/revocation stay closed after C withdrawal',async()=>{
 await admin(db);const m=randomUUID();await db.query("update battle_spectator_media_private.config set media_enabled=true");await db.query("insert into battle_matches(id,host_id,guest_id,tcg,status,visibility) values($1,$2,$3,'pokemon','live','private')",[m,B,C]);
 await claim(db,B);await scalar('select set_battle_spectator_link($1,true) v',[m]);await scalar('select set_battle_spectator_media_consent($1,true) v',[m]);await claim(db,C);assert.equal((await scalar('select set_battle_spectator_media_consent($1,true) v',[m])).media_open,true);
 const r=await request();await claim(db,B);await scalar('select set_battle_spectator_media_consent($1,false) v',[m]);await scalar('select set_battle_spectator_link($1,false) v',[m]);const a=await reauth(r);
 const tabs=['battle_spectator_private.links','battle_spectator_private.grants','battle_spectator_private.presence','battle_spectator_media_private.consents','battle_spectator_media_private.epochs','battle_spectator_media_private.revocations'];
 async function media(){await admin(db);const o={};for(const t of tabs)o[t]=await scalar(`select coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text),'[]') v from ${t} x`);return o;}
 const before=await media();await withdraw(r,a);assert.deepEqual(await media(),before);assert.equal(await scalar('select media_open v from battle_spectator_media_private.epochs where match_id=$1',[m]),false);
 });
 await tx('unrelated or pre-existing marker ownership fails closed',async()=>{
 await admin(db);await db.query('update profiles set data_processing_restricted_at=clock_timestamp() where id=$1',[B]);const r=await request(),a=await reauth(r);await deny(()=>withdraw(r,a),/provenance/);
 });
 await tx('failed after a claim but before Prepare remains provably reversible',async()=>{
 const r=await request(),t=await worker(r);await db.query('select finish_account_deletion_request($1,$2,false,$3)',[r,t,'No prepare entry']);const a=await reauth(r);assert.equal((await withdraw(r,a)).withdrawn,true);
 });
 await tx('marker changed after request is not cleared',async()=>{
 const r=await request(),a=await reauth(r);await admin(db);await db.query("update profiles set data_processing_restricted_at=clock_timestamp()+interval '1 second' where id=$1",[B]);await deny(()=>withdraw(r,a),/provenance/);
 });
 await tx('self-only, renewed session, MFA and revoked session boundaries',async()=>{
 const r=await request();await claim(db,B);const ch=await scalar('select begin_my_account_deletion_withdrawal($1) v',[r]);await deny(()=>scalar(withdrawSQL,[r,ch]),/renewed_auth/);
 const a=await reauth(r);
 for(const u of [A,O,J]){await claim(db,u);await deny(()=>scalar(withdrawSQL,[r,a.ch]),/renewed_auth|not_owned/);await deny(()=>scalar('select begin_my_account_deletion_withdrawal($1) v',[r]),/not_owned/);}
 await claim(db,B,'authenticated',{session_id:a.s,aal:'aal1'});await deny(()=>scalar(withdrawSQL,[r,a.ch]),/mfa_required/);
 await claim(db,B,'service_role',{session_id:a.s});await deny(()=>scalar(withdrawSQL,[r,a.ch]),/permission denied|self_authenticated/);
 await claim(db,B,'postgres',{session_id:a.s,role:'authenticated'});await deny(()=>scalar(withdrawSQL,[r,a.ch]),/self_authenticated/);
 await admin(db);await db.query('delete from auth.sessions where id=$1',[a.s]);await claim(db,B,'authenticated',{session_id:a.s});await deny(()=>scalar(withdrawSQL,[r,a.ch]),/session_invalid/);
 });
 // Committed entry must survive a failed/rolled-back data transaction (L1 stays open).
 const r=await request(A),a=await reauth(r,A),t=await worker(r);await db.query(enterSQL,[r,t]);
 await db.exec('begin');await deny(()=>db.query('select prepare_account_deletion_data($1,$2)',[r,t]),/account_publication_processing_restricted|username/);await db.exec('rollback');
 await claim(db,null,'service_role');await db.query('select finish_account_deletion_request($1,$2,false,$3)',[r,t,'Known L1 guard']);
 await tx('committed Prepare entry + rollback + failed permanently rejects withdrawal; L1 unrepaired',async()=>{await deny(()=>withdraw(r,a,A),/prepare_or_history/);});
 if(native){
 let n=7000;
 async function fresh(){await admin(db);const u=uid(n++);await db.query('insert into auth.users(id,email) values($1,$2)',[u,u+'@example.invalid']);await db.query("insert into profiles(id,email,role,account_status,username) values($1,$2,'player','active',$3)",[u,u+'@example.invalid','race'+n]);await db.query("insert into auth.mfa_factors values($1,$2,'verified')",[fid(u),u]);await db.query("insert into auth.sessions(id,user_id,factor_id,aal) values($1,$2,$3,'aal2')",[sid(u),u,fid(u)]);const r=await request(u),auth=await reauth(r,u);return {u,r,auth};}
 async function race(first,second,isolation='read committed'){
 const x=await fresh();const token=await worker(x.r);await admin(db);const ca=await db.connect(),cb=await db.connect();
 const op=async(c,kind)=>{if(kind==='withdraw')return withdraw(x.r,x.auth,x.u,c);await claim(c,null,'service_role');return scalar(enterSQL,[x.r,token],c);};
 await ca.query('begin');await op(ca,first);await cb.query('begin isolation level '+isolation);if(isolation!=='read committed')await cb.query('select count(*) from profiles');
 const pid=(await cb.query('select pg_backend_pid() pid')).rows[0].pid;let done=false;const pending=op(cb,second).then(value=>({value}),e=>({error:e.message})).finally(()=>done=true);
 let waited=false;for(let i=0;i<100&&!done;i++){if((await db.query('select wait_event_type from pg_stat_activity where pid=$1',[pid])).rows[0]?.wait_event_type==='Lock'){waited=true;break;}await delay(20);}
 assert.equal(waited,true);await ca.query('commit');const result=await pending;await cb.query('rollback');assert.match(result.error,/lock_invalid|prepare_or_history|could not serialize/);out.races.push({first,second,isolation,waited,...result});
 }
 for(const isolation of ['read committed','repeatable read']){await race('withdraw','prepare',isolation);await race('prepare','withdraw',isolation);}
 // Claim uses SKIP LOCKED; assert actual interleaving and no claim of withdrawn target.
 const x=await fresh(),ca=await db.connect(),cb=await db.connect();await ca.query('begin');await withdraw(x.r,x.auth,x.u,ca);await claim(cb,null,'service_role');const claimed=await cb.query('select * from claim_account_deletion_requests(20,$1)',[randomUUID()]);assert.equal(claimed.rows.some(v=>v.request_id===x.r),false);await ca.query('commit');out.races.push({first:'withdraw',second:'claim',skipLocked:true});
 const y=await fresh(),cc=await db.connect(),cd=await db.connect();await admin(db);await cc.query('begin');const yt=await worker(y.r,cc);await claim(cd,y.u,'authenticated',{session_id:y.auth.s});const pid=(await cd.query('select pg_backend_pid() pid')).rows[0].pid;let done=false;const pending=scalar(withdrawSQL,[y.r,y.auth.ch],cd).finally(()=>done=true);let waited=false;for(let i=0;i<100&&!done;i++){if((await db.query('select wait_event_type from pg_stat_activity where pid=$1',[pid])).rows[0]?.wait_event_type==='Lock'){waited=true;break;}await delay(20);}assert.equal(waited,true);await cc.query('commit');assert.equal((await pending).withdrawn,true);out.races.push({first:'claim',second:'withdraw',waited,revoked:yt});
 }
 out.passed=true;out.acceptance=native&&out.races.length===6;
}finally{await mkdir('test-results',{recursive:true});await writeFile('test-results/account-deletion-withdrawal-'+(native?'native':'preparation')+'.json',JSON.stringify(out,null,2));await db.close();}
console.log(JSON.stringify(out));
