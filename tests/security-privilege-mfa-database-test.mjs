// Real PostgreSQL17 CI is mandatory. --pglite is only fast local feedback, never live evidence.
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {securitySchemaFixture,read} from './helpers/security-schema-fixture.mjs';
import {securityQuery} from './generate-security-readiness.mjs';
const local=process.argv.includes('--pglite');let db;
if(local){const {PGlite}=await import('@electric-sql/pglite'),{pgcrypto}=await import('@electric-sql/pglite/contrib/pgcrypto');db=new PGlite({extensions:{pgcrypto}})}
else{const {createDatabase}=await import('./helpers/f3-native-db.mjs');db=await createDatabase()}
const report={native:!local,serverVersion:db.version||null,head:process.env.F3_HEAD_SHA||null,synthetic:true,liveApplied:false,cases:[],passed:false};
const pass=name=>{report.cases.push(name);console.log('PASS:',name)};
const uid=n=>`91000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const OWNER=uid(1),ADMIN=uid(2),MOD=uid(3),JUDGE=uid(4),BUYER=uid(5),SELLER=uid(6),OTHER=uid(7),MATCH=uid(20),FOLDER=uid(21),ITEM=uid(22),LIST=uid(23);
const users=[OWNER,ADMIN,MOD,JUDGE,BUYER,SELLER,OTHER],roles=['owner','admin','moderator','judge','player','player','player'];
const sessions=new Map(users.map((u,i)=>[u,uid(100+i)])),factors=new Map(users.map((u,i)=>[u,uid(200+i)]));
const claim=async(u=OWNER,{aal='aal2',role='authenticated',sid=sessions.get(u),jwtRole=role,anonymous=false}={})=>{
 await db.exec('reset role');await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:u,role:jwtRole,aal,session_id:sid,is_anonymous:anonymous})]);await db.exec('set role '+role);
};
const deny=async(sql,pattern=/permission denied|mfa_step_up_required|privileged_session_required|human_session_required|not_authenticated/)=>assert.rejects(()=>db.query(sql),pattern,sql);
const scalar=async(sql)=>(await db.query(sql)).rows[0].v;
const changed=async(sql,fn)=>{await db.exec('reset role;begin');try{await db.exec(sql);await fn()}finally{await db.exec('rollback;reset role')}};
try{
 await securitySchemaFixture(db);
 const appSchemas=['public','dv_market_private','dv_v16_private','dv_collect_private','battle_spectator_private','battle_spectator_media_private'];
 const inventory=JSON.parse(gunzipSync(await readFile(new URL('../evidence/production-readiness-20260924/staging-catalog.json.gz',import.meta.url)))).functions.filter(f=>appSchemas.includes(f.schema));
 const baseline=(await db.query("select n.nspname schema,p.proname name,pg_get_function_identity_arguments(p.oid) args,md5(pg_get_functiondef(p.oid)) definition_md5 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname=any($1)",[appSchemas])).rows;
 const key=f=>[f.schema,f.name,f.args].join('.');
 assert.equal(baseline.length,inventory.length);
 for(const f of inventory)assert.equal(baseline.find(x=>key(x)===key(f))?.definition_md5,f.definition_md5,key(f));
 report.baseline={functions:baseline.length,missing:0,changed:0};pass('all 299 baseline application function definitions match V51 evidence');
 await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,'info@duelvanta.de',now())",[OWNER]);
 await db.query("insert into public.profiles(id,email,role,account_status) values($1,'info@duelvanta.de','owner','beta')",[OWNER]);
 const files=['database/auth-privileged-step-up-v1.sql','database/security-privilege-mfa-hardening-v1.sql','database/security-readiness-v1.sql'];
 report.sources={};for(const f of files){const sql=await read(f);report.sources[f]=createHash('sha256').update(sql).digest('hex');await db.exec(sql)}
 const security=()=>scalar('select public.get_security_schema_readiness_v1() v');
 const legal=()=>scalar('select public.get_market_legal_schema_readiness_v1() v');
 if(!(await security()).compatible){const expected=JSON.parse((await read(files[2])).split('$catalog$')[1]);await db.exec('set search_path=pg_catalog,public');const actual=(await db.query(securityQuery)).rows[0].jsonb_agg;console.error('security catalog differences',actual.filter(x=>!expected.some(e=>JSON.stringify(e)===JSON.stringify(x))).map(x=>x.slice(0,2)));}
 assert.equal((await security()).compatible,true);assert.equal((await legal()).compatible,true);pass('authored security + legal readiness, not live fingerprints');
 // Repeat the candidate to prove no rename collisions or progressively widening rights.
 for(const f of files)await db.exec(await read(f));assert.equal((await security()).compatible,true);pass('candidate reapplication is idempotent');
 for(let i=0;i<users.length;i++){
  const u=users[i],email=u===OWNER?'info@duelvanta.de':`synthetic-${i}@example.invalid`;
  await db.query('insert into auth.users(id,email) values($1,$2) on conflict(id) do nothing',[u,email]);
  await db.query("insert into public.profiles(id,email,role,account_status,age_band) values($1,$2,$3,'active','18_plus') on conflict(id) do update set age_band='18_plus',account_status='active'",[u,email,roles[i]]);
  await db.query("insert into auth.mfa_factors(id,user_id,status) values($1,$2,'verified')",[factors.get(u),u]);
  await db.query("insert into auth.sessions(id,user_id,factor_id,aal) values($1,$2,$3,'aal2')",[sessions.get(u),u,factors.get(u)]);
 }
 await db.exec('reset role');
 assert.equal(await scalar(`select public.is_duelvanta_owner('${OWNER}') v`),true);
 assert.equal(await scalar("select public.is_duelvanta_owner('516e648b-e513-41fa-ab0e-8fb8f9b39171') v"),false);
 await changed(`update auth.users set email='changed@example.invalid' where id='${OWNER}'`,async()=>{
  assert.equal(await scalar(`select public.is_duelvanta_owner('${OWNER}') v`),false);
  await db.query(`update auth.users set email='info@duelvanta.de',email_confirmed_at=now() where id='${BUYER}'`);
  await db.exec((await read(files[0])).replace(/^(begin|commit);$/gm,''));
  assert.equal(await scalar(`select public.is_duelvanta_owner('${BUYER}') v`),false);
  assert.equal(await scalar('select user_id::text v from dv_v16_private.operator_identity_v1'),OWNER);
  await deny(`delete from public.profiles where id='${OWNER}'`,/owner cannot be deleted/i);
 });
 await changed(`update auth.users set email_confirmed_at=null where id='${OWNER}'`,async()=>assert.equal(await scalar(`select public.is_duelvanta_owner('${OWNER}') v`),false));
 await deny(`update public.profiles set role='player' where id='${OWNER}'`,/owner identity is protected/i);
 await deny(`update public.profiles set role='owner' where id='${BUYER}'`,/Owner role is reserved/);
 await deny(`delete from auth.users where id='${OWNER}'`,/foreign key|owner/i);
 for(const role of ['anon','authenticated','service_role']){
  await claim(OWNER,{role});await deny('select * from dv_v16_private.operator_identity_v1');
  await deny(`update dv_v16_private.operator_identity_v1 set user_id='${BUYER}'`);
 }
 await db.exec('reset role');
 await changed('delete from dv_v16_private.operator_identity_v1',async()=>assert.equal(await scalar(`select public.is_duelvanta_owner('${OWNER}') v`),false));
 pass('project-local operator binding: no legacy UUID fallback, unverified email, reassignment or browser/service writes');
 await db.query("insert into public.staff_permissions(user_id,permission,granted_by) values($1,'battle_moderate',$3),($2,'battle_moderate',$3),($2,'reports_review',$3),($2,'users_restrict',$3)",[JUDGE,MOD,OWNER]);
 await db.query("insert into public.battle_matches(id,host_id,guest_id,tcg,status,visibility) values($1,$2,$3,'pokemon','live','private')",[MATCH,BUYER,SELLER]);
 await db.query("insert into public.battle_reports(reporter_id,reported_user_id,match_id,category) values($1,$2,$3,'other')",[BUYER,SELLER,MATCH]);
 await db.query("insert into public.admin_audit_log(actor_id,action) values($1,'synthetic_fixture')",[OWNER]);
 // Full table and sequence ACL matrix, including technical service rights and all private schemas.
 const matrix=(await db.query(`select n.nspname schema,c.relname name,r role,p privilege,has_table_privilege(r,c.oid,p) allowed from pg_class c join pg_namespace n on n.oid=c.relnamespace cross join unnest(array['anon','authenticated','service_role']) r cross join unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','MAINTAIN','REFERENCES','TRIGGER']) p where n.nspname in ('public','dv_market_private','dv_v16_private','battle_spectator_private','battle_spectator_media_private','dv_collect_private') and c.relkind='r' order by 1,2,3,4`)).rows;
 report.acl=matrix;
 assert.equal(matrix.filter(x=>['TRUNCATE','MAINTAIN','REFERENCES','TRIGGER'].includes(x.privilege)&&x.allowed).length,0);
 assert.equal(matrix.filter(x=>x.schema!=='public'&&x.role!=='service_role'&&x.allowed).length,0);pass('no browser/service TRUNCATE MAINTAIN REFERENCES TRIGGER; private tables closed');
 const intended={admin_audit_log:['SELECT'],battle_matches:['SELECT'],battle_ratings:['SELECT'],battle_reports:['SELECT','INSERT'],battle_signals:['SELECT','INSERT'],collection_folders:['SELECT','INSERT','UPDATE'],collection_items:['SELECT','INSERT','UPDATE','DELETE'],market_listings:['SELECT','INSERT','UPDATE','DELETE'],market_offers:['SELECT','DELETE'],market_seller_accounts:['SELECT'],profiles:['SELECT','UPDATE'],staff_applications:['SELECT'],staff_permissions:['SELECT'],beta_waitlist:['SELECT']};
 for(const name of new Set(matrix.filter(x=>x.schema==='public').map(x=>x.name)))assert.deepEqual(matrix.filter(x=>x.schema==='public'&&x.name===name&&x.role==='authenticated'&&x.allowed).map(x=>x.privilege).sort(),(intended[name]||[]).sort(),name);
 pass('explicit per-table browser DML allowlist');
 const serviceSelect=['profiles','collection_folders','collection_items','market_listings'];
 for(const x of matrix.filter(x=>x.role==='service_role'))assert.equal(x.allowed,x.schema==='public'&&x.privilege==='SELECT'&&serviceSelect.includes(x.name),x.name+' service '+x.privilege);
 report.functionAcl=(await db.query(`select n.nspname schema,p.oid::regprocedure signature,r role,has_function_privilege(r,p.oid,'EXECUTE') allowed from pg_proc p join pg_namespace n on n.oid=p.pronamespace cross join unnest(array['anon','authenticated','service_role']) r where n.nspname=any($1) order by 1,2,3`,[appSchemas])).rows;
 await claim(OWNER,{aal:'aal1'});
 for(const t of ['profiles','battle_reports','collection_items','beta_waitlist'])await deny(`truncate public.${t}`);
 await deny(`select setval('public.beta_waitlist_id_seq',999)`);await deny('select * from auth.sessions');
 for(const t of ['dv_market_private.market_pickup_handovers','dv_market_private.trade_user_eligibility','public.market_notification_sync_state']){
  await claim(BUYER,{aal:'aal1'});await deny('select * from '+t);
  await changed(`grant usage on schema dv_market_private to authenticated;grant select on ${t} to authenticated`,async()=>{await claim(BUYER,{aal:'aal1'});assert.equal((await db.query('select * from '+t)).rows.length,0)});
 }
 await db.exec('reset role');assert.equal(Number(await scalar("select count(*) v from pg_class where oid in ('dv_market_private.market_pickup_handovers'::regclass,'dv_market_private.trade_user_eligibility'::regclass,'public.market_notification_sync_state'::regclass) and relrowsecurity")),3);pass('three RLS gaps closed with default deny even after accidental SELECT grant');
 // Enumerate independently expected privileged implementation paths. Every overload must be guarded or inaccessible.
 const names=['join_battle_as_moderator','leave_battle_moderation','moderate_battle_report','review_battle_report','review_staff_application','set_battle_moderation_pause','set_staff_permission','set_staff_role','get_battle_disputes_for_moderation','resolve_battle_dispute','review_market_seller_onboarding','set_marketplace_seller_onboarding_enforcement','get_owner_marketplace_notices','decide_marketplace_listing_notice','review_marketplace_notice_appeal','get_owner_market_seller_reviews','get_owner_market_delivery_reviews_b07','review_market_order_delivery_b07','owner_openai_scan_settings_for_caller','update_openai_scan_policy_for_caller'];
 const fs=(await db.query(`select n.nspname schema,p.proname name,p.oid::regprocedure signature,p.prosrc,p.proargtypes::regtype[]::text[] types from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.proname=any($1) order by 1,2`,[names])).rows;
 assert.equal(fs.length,20);report.guarded=fs.map(f=>f.signature);
 for(const f of fs){
  assert.ok(f.prosrc.includes('perform public.require_duelvanta_privileged_session();'),f.signature);
  const call=`select * from ${f.schema}.${f.name}(${f.types.map(t=>'null::'+t).join(',')})`;
  for(const opts of [{aal:'aal1'},{sid:uid(999)},{sid:'malformed'},{sid:sessions.get(OTHER)},{anonymous:true}]){await claim(OWNER,opts);await deny(call)}
  await claim(null,{role:'service_role',sid:null});await deny(call);
  await claim(OWNER,{role:'anon'});await deny(call);
 }
 pass('all 20 privileged implementations reject AAL1 revoked foreign malformed anonymous and service sessions');
 for(const mutation of ["delete from auth.sessions where user_id='"+OWNER+"'",`update auth.sessions set not_after=now()-interval '1 second' where user_id='${OWNER}'`,`update auth.sessions set aal='aal1' where user_id='${OWNER}'`,`update auth.mfa_factors set status='unverified' where user_id='${OWNER}'`,`delete from auth.mfa_factors where user_id='${OWNER}'`,`update public.profiles set account_status='suspended' where id='${MOD}'`,`update public.profiles set safety_restricted=true where id='${MOD}'`])await changed(mutation,async()=>{await claim(mutation.includes(MOD)?MOD:OWNER);await deny('select public.get_battle_disputes_for_moderation()')});
 await claim(OWNER,{jwtRole:'service_role'});await deny('select public.get_battle_disputes_for_moderation()');
 await claim(BUYER);await deny('select public.get_battle_disputes_for_moderation()');pass('server factor session expiry revocation account status and role checks');
 // Direct administrative table policies, including existing permissive alternatives.
 for(const u of [OWNER,ADMIN,MOD,JUDGE]){
  await claim(u,{aal:'aal1'});
  assert.equal((await db.query('select * from public.admin_audit_log')).rows.length,0);
  assert.equal((await db.query('select * from public.battle_reports')).rows.length,0);
  assert.equal((await db.query(`select * from public.battle_matches where id='${MATCH}'`)).rows.length,0);
  assert.equal((await db.query('select * from public.profiles')).rows.length,1);
 }
 await claim(OWNER);assert.ok((await db.query('select * from public.admin_audit_log')).rows.length);
 assert.equal((await db.query('select * from public.profiles')).rows.length,7);
 await db.query(`update public.profiles set role='admin' where id='${BUYER}'`);await db.exec('reset role');assert.equal(await scalar(`select role v from public.profiles where id='${BUYER}'`),'player');
 pass('AAL1 staff cannot use table policies or direct role writes to bypass RPC');
 // Owner and permission-bound staff continue through actual business implementations.
 await claim(OWNER);await db.query(`select public.set_staff_permission('${ADMIN}','battle_moderate',true)`);
 for(const u of [ADMIN,MOD,JUDGE]){await claim(u);await db.query(`select public.join_battle_as_moderator('${MATCH}')`);await db.query(`select public.set_battle_moderation_pause('${MATCH}',true,'synthetic')`);await db.query(`select public.set_battle_moderation_pause('${MATCH}',false,'synthetic')`);await db.query(`select public.leave_battle_moderation('${MATCH}','synthetic')`);await deny(`select public.set_staff_role('${BUYER}','admin','forbidden')`,/owner/i)}
 await claim(OWNER);await db.query(`select public.set_staff_role('${OTHER}','judge','synthetic')`);await db.query(`select public.set_staff_role('${OTHER}','player','synthetic')`);
 await claim(JUDGE);await deny(`select public.moderate_battle_report(null,'restrict','no permission')`,/reports_review permission/);
 await db.exec(`reset role;update public.battle_matches set status='dispute',host_result='host',guest_result='guest' where id='${MATCH}'`);
 await claim(JUDGE);assert.equal((await db.query('select * from public.get_battle_disputes_for_moderation()')).rows.length,1);await db.query(`select public.resolve_battle_dispute('${MATCH}','draw','synthetic decision')`);
 await claim(OWNER);await db.query('select public.dv_v16_owner_openai_scan_settings()');await db.query('select public.dv_v16_owner_update_openai_scan_policy(false,10,2,100)');
 await db.query("select public.get_owner_market_seller_reviews('pending_review')");await db.query('select public.get_owner_marketplace_notices(null)');await db.query("select public.set_marketplace_seller_onboarding_enforcement(false)");
 pass('real Owner Admin Moderator Judge workflows preserve role and permission boundaries');
 // Nonprivileged browser paths remain AAL1; ownership checks still reject foreign records.
 await claim(BUYER,{aal:'aal1'});
 await db.query(`insert into public.collection_folders(id,user_id,name) values('${FOLDER}','${BUYER}','Synthetic binder')`);
 await db.query(`insert into public.collection_items(id,user_id,tcg,card_name,folder_id) values('${ITEM}','${BUYER}','pokemon','Synthetic card','${FOLDER}')`);
 await db.query(`update public.collection_items set quantity=2 where id='${ITEM}'`);
 await deny(`delete from public.collection_folders where id='${FOLDER}'`);
 await claim(OTHER,{aal:'aal1'});assert.equal((await db.query(`select * from public.collection_items where id='${ITEM}'`)).rows.length,0);
 await claim(BUYER,{aal:'aal1'});await db.query(`delete from public.collection_items where id='${ITEM}'`);await db.query(`select public.dv_collect_delete_empty_binder('${FOLDER}')`);
 await db.query("update public.profiles set display_name='Synthetic player' where id=auth.uid()");await deny("update public.profiles set role='owner' where id=auth.uid()",/row-level security|Owner role/);
 await db.query("select public.dv_v16_openai_scan_budget()");await db.query('select public.get_my_market_deals()');await db.query('select public.get_my_battle_history(10)');
 await claim(null,{role:'anon',sid:null,aal:'aal1'});await db.query("insert into public.beta_waitlist(email,consent,source) values('synthetic-waitlist@example.invalid',true,'landingpage')");await deny('select * from public.beta_waitlist');
 await deny("insert into public.beta_waitlist(email,consent,source,beta_status) values('bad@example.invalid',true,'landingpage','invited')");
 await claim(OWNER,{aal:'aal1'});assert.equal((await db.query('select * from public.beta_waitlist')).rows.length,0);
 await claim(OWNER);assert.equal((await db.query('select * from public.beta_waitlist')).rows.length,1);await db.query("update public.beta_waitlist set founder_eligible=true where email='synthetic-waitlist@example.invalid'");
 pass('COLLECT F3 profile scanner ordinary TRADE reads and least-privilege waitlist remain usable');
 // Ordinary AAL1 price-offer -> B2C contract -> withdrawal against the entire hardened stack.
 await db.exec(`reset role;
 insert into dv_market_private.trade_user_eligibility(user_id,date_of_birth,residence_country_code,private_buyer_confirmed) values('${BUYER}','1990-01-01','DE',true),('${SELLER}','1990-01-01','DE',true);
 insert into public.market_seller_accounts(seller_id,seller_type,onboarding_status,terms_version,verified_at,trader_display_name) values('${SELLER}','trader','active','synthetic-v1',now(),'Synthetic shop');
 insert into dv_market_private.seller_legal_profiles(seller_id,legal_first_name,legal_last_name,date_of_birth,business_name,legal_form,street_line1,postal_code,city,country_code,public_email) values('${SELLER}','Synthetic','Seller','1990-01-01','Synthetic shop','Einzelunternehmen','Fixtureweg 1','75100','Fixturestadt','DE','seller@example.invalid');`);
 await claim(SELLER,{aal:'aal1'});await db.query(`insert into public.market_listings(id,seller_id,status,listing_type,pricing_mode,asking_price,shipping_method,shipping_cost,tcg,card_name) values('${LIST}','${SELLER}','active','sale','negotiable',10,'pickup',0,'pokemon','Synthetic test card')`);
 await claim(BUYER,{aal:'aal1'});const review=await scalar(`select public.review_market_price_offer_v1('${LIST}',1,9) v`);assert.equal(review.contract_classification,'b2c');
 const offer=(await db.query('select public.create_market_offer_v3($1,1,9,$2,$3,$4) v',[LIST,'synthetic',review.listing_updated_at,review.offer_review_hash])).rows[0].v;
 await claim(SELLER,{aal:'aal1'});await db.query('select public.respond_to_market_offer($1,$2)',[offer,'accepted']);
 await db.exec('reset role');const snapshot=(await db.query(`select id,order_id from dv_market_private.market_contract_snapshots where buyer_id='${BUYER}'`)).rows[0];assert.ok(snapshot);
 await claim(BUYER,{aal:'aal1'});await db.query('select public.get_my_market_order_contract_documents($1)',[snapshot.order_id]);
 const withdrawal=(await db.query('select public.prepare_market_withdrawal_v1($1,$2,$3) v',[snapshot.id,'Synthetic Buyer','buyer@example.invalid'])).rows[0].v;
 await db.query('select public.confirm_market_withdrawal_v1($1)',[withdrawal.draft_id]);
 await claim(OTHER,{aal:'aal1'});await deny(`select public.get_my_market_order_contract_documents('${snapshot.order_id}')`,/access_denied/);
 await claim(null,{role:'service_role',sid:null});const claimed=(await db.query(`select * from public.claim_marketplace_message_delivery(25,'${uid(800)}')`)).rows;assert.ok(claimed.length>=2);
 assert.equal((await db.query('select * from public.get_pending_battle_spectator_media_revocations(1)')).rows.length,0);
 await claim(BUYER,{aal:'aal1'});await deny(`select * from public.claim_marketplace_message_delivery(25,'${uid(800)}')`);await deny('select * from public.get_pending_battle_spectator_media_revocations(1)');
 pass('AAL1 listing price offer B2C snapshot withdrawal; authorized service outbox/media worker; no provider call');
 // Fixed-price SQL contract with synthetic provider identifiers in disposable DB only.
 await db.exec(`reset role;
 insert into dv_market_private.market_payment_configuration(singleton,sandbox_enabled,live_mode,platform_fee_bps,platform_fee_fixed_cents) values(true,true,false,0,0);
 insert into dv_market_private.market_stripe_accounts(seller_id,stripe_account_id,live_mode,onboarding_status,charges_enabled,details_submitted) values('${SELLER}','acct_step9afixture',false,'ready',true,true);`);
 await claim(SELLER,{aal:'aal1'});await db.query(`insert into public.market_listings(id,seller_id,status,listing_type,pricing_mode,asking_price,shipping_method,shipping_cost,tcg,card_name) values('${uid(24)}','${SELLER}','active','sale','fixed',10,'pickup',0,'pokemon','Synthetic fixed price')`);
 await claim(BUYER,{aal:'aal1'});const fixedReview=await scalar(`select public.review_market_checkout('${uid(24)}',1) v`);
 const fixed=(await db.query('select public.prepare_fixed_price_market_offer_v1($1,1,$2,$3,$4,false) v',[uid(24),uid(25),fixedReview.listing_updated_at,fixedReview.checkout_hash])).rows[0].v;
 await deny(`select public.accept_fixed_price_market_offer_v1('${fixed.offer_id}','${fixed.payment_attempt_id}','cs_test_step9a_fixture',now(),false)`);
 await claim(null,{role:'service_role',sid:null});
 const accepted=await scalar(`select public.accept_fixed_price_market_offer_v1('${fixed.offer_id}','${fixed.payment_attempt_id}','cs_test_step9a_fixture',now(),false) v`);
 assert.ok(accepted.order_id);await db.query(`select public.accept_fixed_price_market_offer_v1('${fixed.offer_id}','${fixed.payment_attempt_id}','cs_test_step9a_fixture',now(),false)`);
 await db.exec('reset role');assert.equal(Number(await scalar(`select count(*) v from dv_market_private.market_payment_attempts where id='${fixed.payment_attempt_id}'`)),1);
 assert.equal(Number(await scalar(`select count(*) v from public.market_deals where offer_id='${fixed.offer_id}'`)),1);
 assert.equal(Number(await scalar(`select count(*) v from dv_market_private.market_payment_allocations where attempt_id='${fixed.payment_attempt_id}'`)),1);
 pass('hardened fixed-price user/service separation and idempotent attempt/order/allocation; synthetic SQL only');
 // Privileged cores/aliases cannot be used, even if a legacy core exists from the old B06 draft.
 await db.exec(`reset role;create function public.dv_core_set_staff_role(uuid,text,text) returns text language sql security definer as $$select 'unsafe legacy'$$;grant execute on function public.dv_core_set_staff_role(uuid,text,text) to public,anon,authenticated,service_role`);
 await db.exec(await read(files[0]));for(const r of ['anon','authenticated','service_role']){await claim(OWNER,{role:r});await deny(`select public.dv_core_set_staff_role('${BUYER}','owner',null)`)}await db.exec('reset role;drop function public.dv_core_set_staff_role(uuid,text,text)');
 pass('old dv_core aliases inaccessible to browser and service');
 // Future-object privileges: schema-specific and global defaults, including extension schema authored by postgres.
 for(const s of ['public','dv_market_private','dv_v16_private','battle_spectator_private','battle_spectator_media_private','dv_collect_private'])await changed(`create table ${s}.security_future(id integer);create sequence ${s}.security_future_seq;create function ${s}.security_future_fn() returns integer language sql as $$select 1$$`,async()=>{
  for(const r of ['anon','authenticated','service_role']){
   assert.equal(await scalar(`select has_table_privilege('${r}','${s}.security_future','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,MAINTAIN,TRIGGER,REFERENCES') v`),false);
   assert.equal(await scalar(`select has_sequence_privilege('${r}','${s}.security_future_seq','USAGE,SELECT,UPDATE') v`),false);
   assert.equal(await scalar(`select has_function_privilege('${r}','${s}.security_future_fn()','EXECUTE') v`),false);
  }
 });pass('future tables sequences and functions default closed for every application schema');
 // Prove deliberate security regressions cannot be accepted by merely rewriting a migration fingerprint.
 const corruptions=[['browser truncate','grant truncate on public.profiles to authenticated'],['browser maintain','grant maintain on public.collection_items to authenticated'],['service maintenance','grant maintain on public.profiles to service_role'],['column escalation','grant update(role) on public.profiles to anon'],['sequence reset','grant update on sequence public.beta_waitlist_id_seq to anon'],['RLS gap','alter table dv_market_private.trade_user_eligibility disable row level security'],['RLS policy bypass',"create policy security_bad on public.admin_audit_log for select to authenticated using(true)"],['defaults widened','alter default privileges for role postgres in schema public grant all on tables to authenticated'],['PUBLIC function default','alter default privileges for role postgres grant execute on functions to public'],['guard weakened',"create or replace function public.has_duelvanta_privileged_session() returns boolean language sql stable security definer set search_path='' as $$select true$$"],['alternate public core',"create function public.dv_core_admin_bypass() returns boolean language sql security definer as $$select true$$"],['private schema leak','grant usage on schema dv_market_private to authenticated'],['legacy trade exposed','grant execute on function public.buy_market_listing_v3(uuid,integer,uuid,timestamptz,text) to authenticated']];
 for(const [name,sql] of corruptions){await changed(sql,async()=>{assert.equal((await security()).compatible,false,name);assert.equal((await legal()).compatible,false,name)});assert.equal((await security()).compatible,true);pass('fail closed: '+name)}
 await claim(OWNER);const access=await scalar('select public.get_my_privileged_access_v1() v');assert.deepEqual(access,{owner:true,privileged:true});await claim(OWNER,{aal:'aal1'});assert.deepEqual(await scalar('select public.get_my_privileged_access_v1() v'),{owner:false,privileged:false});
 pass('user-JWT Edge invitation gate denies AAL1 before service escalation');
 report.passed=true;
}catch(e){report.failure={message:e.message,code:e.code,where:e.where};console.error(report.failure);process.exitCode=1}
finally{await mkdir(new URL('../test-results/',import.meta.url),{recursive:true});await writeFile(new URL('../test-results/security-step9a.json',import.meta.url),JSON.stringify(report,null,2)+'\n');await db.close()}
