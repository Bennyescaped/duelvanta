// Synthetic only. PGlite is preparation; --native is PostgreSQL 17 acceptance.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {publicationFixture,A,B,C,D,O,J,uid,sid,fid,claim,admin} from './helpers/publication-hold-fixture.mjs';
import {read} from './helpers/security-schema-fixture.mjs';
const native=process.argv.includes('--native');
const db=native?await(await import('./helpers/f3-native-db.mjs')).createDatabase():new(await import('@electric-sql/pglite')).PGlite({extensions:{pgcrypto:(await import('@electric-sql/pglite/contrib/pgcrypto')).pgcrypto}});
const out={native,acceptance:false,passed:false,version:db.version||'PGlite',cases:[]};
const scalar=async(s,p=[])=>(await db.query(s,p)).rows[0]?.v;
const prep='select prepare_account_deletion_data($1,$2) v';
async function deny(fn,re){await assert.rejects(fn,re);}
async function check(name,fn){await fn();out.cases.push(name);console.log('PASS',name);}
async function fresh(kind=null,seed=false){const seedIds={folder:randomUUID(),item:randomUUID(),listing:randomUUID()};await admin(db);const u=randomUUID();await db.query('insert into auth.users(id,email) values($1,$2)',[u,u+'@example.invalid']);await db.query("insert into profiles(id,email,username,display_name,avatar_path,role,account_status,collection_visibility) values($1,$2,$3,'Individual',$4,'player','active','public')",[u,u+'@example.invalid','u'+u.replaceAll('-','').slice(0,12),u+'/avatar.jpg']);await db.query("insert into auth.sessions(id,user_id,aal) values($1,$2,'aal1')",[sid(u),u]);
 if(seed){
 await admin(db);await db.query("insert into market_seller_accounts(seller_id,seller_type,onboarding_status,trader_display_name) values($1,'trader','draft','Individual')",[u]);
 const {folder,item,listing}=seedIds;
 // Existing SQL mutations exercised with real schema, no stubbed Prepare body.
 await db.query("insert into collection_folders(id,user_id,name) values($1,$2,'Private collection')",[folder,u]);
 await db.query("insert into collection_items(id,user_id,tcg,card_name) values($1,$2,'pokemon','Fixture')",[item,u]);
 await db.exec('begin;alter table market_listings disable trigger a00_production_trade_lock_v1;alter table market_listing_images disable trigger a00_production_trade_lock_v1');
 await db.query("insert into market_listings(id,seller_id,tcg,card_name,status,collection_item_id,image_path,seller_note,seller_display_name,shipping_method) values($1,$2,'pokemon','Fixture','paused',$3,$4,'Private note','Individual','pickup')",[listing,u,item,u+'/card.jpg']);
 await db.query("insert into market_listing_images(listing_id,seller_id,storage_path) values($1,$2,$3)",[listing,u,u+'/card.jpg']);
 await db.exec('alter table market_listings enable trigger a00_production_trade_lock_v1;alter table market_listing_images enable trigger a00_production_trade_lock_v1;commit');

 }
 if(kind)await db.query("insert into dv_market_private.battle_safety_causes(target_id,kind,actor_id,report_id,reason) values($1,$2,$3,$4,'fixture')",[u,kind,O,randomUUID()]);
 await claim(db,u);const r=(await scalar("select request_my_account_deletion('KONTO LÖSCHEN',$1) v",[randomUUID()])).request_id;assert.ok(r);await claim(db,null,'service_role');const t=randomUUID();assert.ok((await db.query('select * from claim_account_deletion_requests(20,$1)',[t])).rows.some(x=>x.request_id===r));return {u,r,t,seedIds};}
async function gate(x){await claim(db,null,'service_role');return scalar('select enter_account_deletion_prepare($1,$2) v',[x.r,x.t]);}
async function prepare(x){await claim(db,null,'service_role');return scalar(prep,[x.r,x.t]);}
async function profile(u){await admin(db);return scalar('select to_jsonb(p) v from profiles p where id=$1',[u]);}
async function empty(){await admin(db);assert.equal(await scalar('select count(*)::int v from dv_market_private.l1_profile_reductions'),0);}
const stableTables=['auth.users','dv_market_private.battle_safety_causes','dv_market_private.battle_safety_releases','dv_market_private.account_deletion_holds','public.battle_reports','public.battle_matches','public.battle_ratings','public.battle_rating_events','public.admin_audit_log','battle_spectator_private.links','battle_spectator_private.grants','battle_spectator_private.presence','battle_spectator_media_private.consents','battle_spectator_media_private.epochs','battle_spectator_media_private.revocations'];
async function snapshot(){await admin(db);const s={};for(const t of stableTables)s[t]=await scalar(`select coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text),'[]') v from ${t} x`);return s;}
try{
 await publicationFixture(db);for(const f of ['publication-processing-hold-v1','battle-safety-sanctions-v1','account-deletion-withdrawal-v1'])await db.exec(await read('database/'+f+'.sql'));
 await db.query("insert into dv_market_private.data_retention_rules(category,purpose,legal_basis,retention_rule,policy_version) values('contract_evidence','fixture','fixture','fixture','fixture') on conflict do nothing");
 const fks=(await db.query("select oid,pg_get_constraintdef(oid) def from pg_constraint where contype='f' order by oid")).rows;
 const source=(await db.query("select oid,prosrc,proacl::text,proowner,prosecdef,proconfig from pg_proc where oid in ('public.prepare_account_deletion_data(uuid,uuid)'::regprocedure,'public.guard_profile_username_direct_update()'::regprocedure,'dv_market_private.d4_protect_public_profile()'::regprocedure,'public.set_my_public_profile(text,text,text)'::regprocedure)")).rows;
 await db.exec(await read('database/account-erasure-l1-v1.sql'));await db.exec(await read('database/account-erasure-l1-v1.sql'));await db.exec(await read('database/account-erasure-l1-readiness-v1.sql'));
 assert.equal((await scalar('select get_security_schema_readiness_v1() v')).compatible,true);assert.equal((await scalar('select get_market_legal_schema_readiness_v1() v')).compatible,true);
 const normalRPC=await scalar("select prosrc v from pg_proc where oid='public.set_my_public_profile(text,text,text)'::regprocedure");assert.equal(normalRPC,source.find(f=>f.prosrc.includes('v_old_username')).prosrc);
 for(const f of source){const n=(await db.query('select oid,prosrc,proacl::text,proowner,prosecdef,proconfig from pg_proc where oid=$1',[f.oid])).rows[0];assert.deepEqual({...n,prosrc:f.prosrc},f);}
 assert.deepEqual((await db.query("select oid,pg_get_constraintdef(oid) def from pg_constraint where contype='f' and conrelid<>'dv_market_private.l1_profile_reductions'::regclass order by oid")).rows,fks);
 await check('native ACL/guard ownership retained; no setter, C/L2 untouched',async()=>{
 for(const role of ['anon','authenticated','service_role']){assert.equal(await scalar("select has_table_privilege($1,'dv_market_private.l1_profile_reductions','INSERT') v",[role]),false);assert.equal(await scalar("select has_table_privilege($1,'dv_market_private.l1_profile_reductions','UPDATE') v",[role]),false);}
 });
 const x=await fresh(null,true);await gate(x);
 const {listing}=x.seedIds;
 const before=await profile(x.u),stable=await snapshot();
 await check('committed gate + current attempt: fixed profile and existing seller/listing/collection reductions',async()=>{
 const result=await prepare(x);assert.equal(result.user_id,x.u);const after=await profile(x.u);assert.equal(after.display_name,'Gelöschtes Mitglied');assert.equal(after.username,null);assert.equal(after.avatar_path,null);assert.equal(after.collection_visibility,'private');assert.match(after.email,/^deleted-[0-9a-f-]+@invalid\.local$/);
 for(const k of Object.keys(before))if(!['display_name','username','avatar_path','collection_visibility','email','updated_at'].includes(k))assert.deepEqual(after[k],before[k],k);
 assert.deepEqual(await snapshot(),stable);for(const table of ['collection_items','collection_folders'])assert.equal(await scalar(`select count(*)::int v from ${table} where user_id=$1`,[x.u]),0);
 const l=await scalar('select to_jsonb(l) v from market_listings l where id=$1',[listing]);assert.equal(l.image_path,null);assert.equal(l.seller_note,null);assert.equal(l.collection_item_id,null);assert.equal(l.seller_display_name,'Gelöschtes Mitglied');assert.equal(l.status,'paused');
 assert.equal(await scalar('select count(*)::int v from market_listing_images where seller_id=$1',[x.u]),0);const s=await scalar('select to_jsonb(s) v from market_seller_accounts s where seller_id=$1',[x.u]);assert.equal(s.onboarding_status,'suspended');assert.equal(s.trader_display_name,null);await empty();
 });
 await check('retry reduces only; context does not survive successful call or transaction',async()=>{await prepare(x);await empty();await deny(()=>db.query("update profiles set display_name='Published' where id=$1",[x.u]),/processing_restricted/);});
 await check('free GUC/claims/role cannot grant erasure; normal held user, Judge and Owner remain blocked',async()=>{
 for(const role of ['authenticated','service_role','postgres'])for(const actor of [x.u,J,O]){await claim(db,actor,role,{l1_erasure:true,request_id:x.r,attempt_id:randomUUID()});await db.query("select set_config('duelvanta.username_rpc','allowed',false),set_config('duelvanta.l1_erasure','allowed',false)");
 for(const field of ['display_name','username','avatar_path']){let err;try{const r=await db.query(`update profiles set ${field}='spoofed' where id=$1 returning id`,[x.u]);assert.equal(r.rows.length,0);}catch(e){err=e;}if(err)assert.match(err.message,/permission denied|processing_restricted|row-level/);}
 }await admin(db);await db.query("select set_config('duelvanta.username_rpc','',false)");await empty();
 });
 await check('normal username direct update denied; existing validated RPC unchanged',async()=>{await admin(db);await deny(()=>db.query("update profiles set username='directspoof' where id=$1",[B]),/protected profile function/);await claim(db,B);await scalar("select set_my_public_profile('bravonew',null,null) v");});
 const y=await fresh();
 await check('missing gate, wrong request and wrong token denied',async()=>{await deny(()=>prepare(y),/must_be_committed/);await deny(()=>prepare({...y,r:randomUUID()}),/profile_missing|lock_invalid/);await gate(y);await deny(()=>prepare({...y,t:randomUUID()}),/lock_invalid/);});
 await check('same-transaction gate does not authorize Prepare',async()=>{const z=await fresh();await db.exec('begin');await gate(z);let e;try{await prepare(z);}catch(err){e=err;}await db.exec('rollback');assert.match(e.message,/must_be_committed/);});
 await check('wrong target/origin binding and incoherent markers fail closed',async()=>{await admin(db);await db.exec('begin');await db.query('update dv_market_private.account_deletion_requests set user_id=$1 where id=$2',[D,y.r]);let e;try{await prepare(y);}catch(err){e=err;}await db.exec('rollback');assert.match(e.message,/l1_c_binding_invalid/);await empty();});
 await check('current token without authoritative attempt denied',async()=>{await admin(db);await db.exec('begin');const forged=randomUUID();await db.query('update dv_market_private.account_deletion_requests set lock_token=$1 where id=$2',[forged,y.r]);let e;try{await prepare({...y,t:forged});}catch(err){e=err;}await db.exec('rollback');assert.match(e.message,/attempt_invalid/);await empty();});
 await check('existing owner target blocker still denies despite a committed gate',async()=>{await admin(db);await db.exec('begin');await db.query('update dv_market_private.account_deletion_requests set user_id=$1 where id=$2',[O,y.r]);let e;try{await prepare(y);}catch(err){e=err;}await db.exec('rollback');assert.match(e.message,/blockers_changed/);await empty();});
 await check('active internal context rejects arbitrary replacement identity and visibility',async()=>{
 for(const assignment of ["new.display_name:='Replacement'","new.username:='replacement'","new.avatar_path:='replacement.jpg'","new.collection_visibility:='public'","new.founder_number:=123"]){await admin(db);await db.exec(`create function public.l1_fixture_substitute() returns trigger language plpgsql as $$begin ${assignment};return new;end$$;create trigger c_l1_fixture_substitute before update on profiles for each row execute function public.l1_fixture_substitute()`);await deny(()=>prepare(y),/processing_restricted/);await empty();await db.exec('drop trigger c_l1_fixture_substitute on profiles;drop function public.l1_fixture_substitute()');}
 });
 await check('new attempt requires own gate; old token cannot resume',async()=>{await claim(db,null,'service_role');await scalar('select finish_account_deletion_request($1,$2,false,$3) v',[y.r,y.t,'synthetic retry']);const old=y.t;y.t=randomUUID();await db.query('select * from claim_account_deletion_requests(20,$1)',[y.t]);await deny(()=>prepare({...y,t:old}),/lock_invalid/);await deny(()=>prepare(y),/must_be_committed/);await gate(y);await prepare(y);await empty();});
 for(const kind of ['b1','legacy_unknown'])await check(kind+' + C: independent causes/markers/retention/Auth/Reports/D1/D2 unchanged',async()=>{const z=await fresh(kind);await gate(z);await admin(db);await db.query("insert into dv_market_private.account_deletion_holds(request_id,user_id,category,reason,manual_review_required) values($1,$2,'contract_evidence','fixture',true)",[z.r,z.u]);const p=await profile(z.u),s=await snapshot();await prepare(z);const q=await profile(z.u);for(const k of ['data_processing_restricted_at','account_closure_requested_at','safety_restricted','account_status'])assert.deepEqual(q[k],p[k]);assert.equal(q.safety_restricted,true);assert.deepEqual(await snapshot(),s);await empty();});
 await check('late Prepare error rolls back all reductions and capability; C remains permanently closed',async()=>{
 const z=await fresh();await gate(z);const p=await profile(z.u);await db.exec("create function public.l1_fail_audit() returns trigger language plpgsql as $$begin if new.event_type='data_erasure_prepared' then raise exception 'synthetic_late_failure';end if;return new;end$$;create trigger l1_fail_audit before insert on dv_market_private.account_data_rights_audit for each row execute function public.l1_fail_audit()");await deny(()=>prepare(z),/synthetic_late_failure/);assert.deepEqual(await profile(z.u),p);await empty();await db.exec('drop trigger l1_fail_audit on dv_market_private.account_data_rights_audit;drop function public.l1_fail_audit()');
 await claim(db,z.u);const ch=await scalar('select begin_my_account_deletion_withdrawal($1) v',[z.r]);await new Promise(resolve=>setTimeout(resolve,5));await admin(db);const session=randomUUID();await db.query("insert into auth.sessions(id,user_id,aal,created_at) values($1,$2,'aal1',clock_timestamp())",[session,z.u]);await claim(db,z.u,'authenticated',{session_id:session});await deny(()=>scalar('select withdraw_my_account_deletion($1,$2) v',[z.r,ch]),/prepare_or_history/);await prepare(z);await empty();
 });
 await check('withdraw wins: old token and Prepare stay revoked',async()=>{const z=await fresh();await claim(db,z.u);const ch=await scalar('select begin_my_account_deletion_withdrawal($1) v',[z.r]);await new Promise(resolve=>setTimeout(resolve,5));await admin(db);const session=randomUUID();await db.query("insert into auth.sessions(id,user_id,aal,created_at) values($1,$2,'aal1',clock_timestamp())",[session,z.u]);await claim(db,z.u,'authenticated',{session_id:session});assert.equal((await scalar('select withdraw_my_account_deletion($1,$2) v',[z.r,ch])).withdrawn,true);await deny(()=>prepare(z),/lock_invalid/);await empty();});
 out.passed=true;out.acceptance=native;
}finally{await mkdir('test-results',{recursive:true});await writeFile('test-results/account-erasure-l1-'+(native?'native':'preparation')+'.json',JSON.stringify(out,null,2));await db.close();}
