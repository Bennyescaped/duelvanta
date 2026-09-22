// Isolated PGlite roles/SQL regression for Step 2 only. No shared DB or provider calls.
// Executes actual eligibility, buyer guard, review, offer and snapshot functions;
// deliberately NOT an acceptance of the complete unapplied contract/payment migration.
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const pgliteUrl=process.argv[2]?pathToFileURL(process.argv[2]).href:import.meta.resolve('@electric-sql/pglite');
const {PGlite}=await import(pgliteUrl);
const {pgcrypto}=await import(new URL('./contrib/pgcrypto.js',pgliteUrl).href);
const db=new PGlite({extensions:{pgcrypto}});
const read=name=>readFile(new URL('../'+name,import.meta.url),'utf8');
const [candidate,eligibility,seller,checkout]=await Promise.all([
 'supabase/migrations/20260921190000_trade_legal_contract_model_v1.sql',
 'database/b07-l07-01-eligibility-guard-v1.sql','database/market-seller-compliance-v1.sql','database/market-checkout-compliance-v1.sql'
].map(read));
const fn=(sql,name)=>{const a=sql.indexOf('create or replace function '+name+'('),b=sql.indexOf('\n$$;',a);assert.ok(a>=0&&b>a,name);return sql.slice(a,b+4)};
const before=(sql,marker)=>{const end=sql.indexOf(marker);assert.ok(end>0,marker);return sql.slice(0,end)};
const BUYER='a0000000-0000-4000-8000-000000000001',PRIVATE='a0000000-0000-4000-8000-000000000002',TRADER='a0000000-0000-4000-8000-000000000003',OTHER='a0000000-0000-4000-8000-000000000004';
const LIST1='b0000000-0000-4000-8000-000000000001',LIST2='b0000000-0000-4000-8000-000000000002';
const ORDER='c0000000-0000-4000-8000-000000000001',OLDDEAL='d0000000-0000-4000-8000-000000000001',OLDOFFER='e0000000-0000-4000-8000-000000000001';
const results=[];
const value=async(sql,args)=>(await db.query(sql,args)).rows[0]?.value;
const claim=async(uid,role='authenticated')=>db.exec(`reset role;select set_config('request.jwt.claim.sub','${uid||''}',false);set role ${role};`);
const success=(name)=>results.push({name,status:'PASS'});
const denied=async(name,sql,pattern,args)=>{await assert.rejects(()=>db.query(sql,args),pattern);success(name)};
const review=()=>value(`select public.review_market_checkout('${LIST2}',1) value`);
const owner=()=>db.exec('reset role');
try{
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create schema extensions;
 create table auth.users(id uuid primary key,email text);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth,public to anon,authenticated,service_role;
 create table public.profiles(id uuid primary key references auth.users(id),role text default 'player',account_status text default 'active',safety_restricted boolean default false,account_closure_requested_at timestamptz,data_processing_restricted_at timestamptz);
 create table public.market_listings(id uuid primary key,seller_id uuid not null references auth.users(id),status text default 'active',listing_type text default 'sale',pricing_mode text default 'fixed',asking_price numeric default 10,quantity_available int default 10,minimum_purchase_quantity int default 1,quantity_pricing jsonb default '[]',active_until timestamptz,shipping_method text default 'parcel',shipping_cost numeric default 2,shipping_note text,tcg text default 'pokemon',card_name text default 'Isolated fixture',set_name text,card_number text,language text,variant text,condition text,grading_company text,grade text,product_kind text default 'sealed',sealed_category text,sealed_condition text,package_contents text,units_per_container int,seller_note text,updated_at timestamptz default now());
 create table public.market_offers(id uuid primary key default gen_random_uuid(),seller_id uuid,buyer_id uuid,listing_id uuid,status text default 'pending',offer_type text default 'price',amount numeric,currency text,message text,requested_quantity int,unit_price_snapshot numeric,listed_unit_price_snapshot numeric,listed_total_snapshot numeric,listing_snapshot jsonb);
 create table public.market_orders(id uuid primary key,order_number text,seller_id uuid,buyer_id uuid,payment_provider text default 'manual_beta');
 create table public.market_deals(id uuid primary key default gen_random_uuid(),listing_id uuid references public.market_listings(id),offer_id uuid references public.market_offers(id),order_id uuid references public.market_orders(id),seller_id uuid,buyer_id uuid,amount numeric,currency text default 'EUR',status text default 'accepted',accepted_at timestamptz default now(),shipping_method text default 'parcel',shipping_cost numeric default 2,product_kind text default 'sealed',sealed_category text,item_quantity int default 1,payment_provider text default 'manual_beta');
 insert into auth.users(id,email) values('${BUYER}','buyer@example.test'),('${PRIVATE}','private@example.test'),('${TRADER}','trader@example.test'),('${OTHER}','other@example.test');
 insert into public.profiles(id) select id from auth.users;
 insert into public.market_listings(id,seller_id) values('${LIST1}','${PRIVATE}'),('${LIST2}','${TRADER}');
 insert into public.market_orders(id,order_number,seller_id,buyer_id) values('${ORDER}','ISOLATED-LEGACY','${PRIVATE}','${BUYER}');
 insert into public.market_offers(id,listing_id,buyer_id,seller_id) values('${OLDOFFER}','${LIST1}','${BUYER}','${PRIVATE}');
 insert into public.market_deals(id,listing_id,offer_id,order_id,seller_id,buyer_id,amount) values('${OLDDEAL}','${LIST1}','${OLDOFFER}','${ORDER}','${PRIVATE}','${BUYER}',10);`);
 // Actual existing table/policy definitions, without unrelated onboarding machinery.
 await db.exec(before(seller,'comment on table dv_market_private.seller_legal_profiles is'));
 await db.exec(before(checkout,'create or replace function dv_market_private.market_checkout_seller_party'));
 await db.exec(fn(checkout,'dv_market_private.market_checkout_seller_party'));
 await db.exec(fn(checkout,'dv_market_private.market_checkout_product_snapshot'));
 await db.exec(`insert into public.market_seller_accounts(seller_id,seller_type,onboarding_status,country_code) values('${PRIVATE}','private','active','DE'),('${TRADER}','trader','active','DE');
 insert into dv_market_private.seller_legal_profiles(seller_id,legal_first_name,legal_last_name,date_of_birth,business_name,street_line1,postal_code,city,country_code,public_email)
 values('${PRIVATE}','Private','Fixture','1990-01-01',null,'Fixture 1','10115','Fixture','DE',null),('${TRADER}','Trader','Fixture','1990-01-01','Fixture shop','Fixture 2','10115','Fixture','DE','fixture@example.test');
 insert into dv_market_private.market_contract_snapshots(deal_id,order_id,listing_id,offer_id,seller_id,buyer_id,seller_type,contract_classification,seller_party,platform_operator,product_snapshot,quantity,unit_price,goods_total,shipping_method,shipping_cost,total_price,currency,payment_provider,contract_formed_at,confirmation_text,content_sha256)
 values('${OLDDEAL}','${ORDER}','${LIST1}','${OLDOFFER}','${PRIVATE}','${BUYER}','private','c2c','{}','{}','{}',1,10,10,'parcel',2,12,'EUR','manual_beta','2026-09-13T10:00:00Z','Synthetic unchanged legacy evidence',digest('Synthetic unchanged legacy evidence','sha256'));
 create table dv_market_private.marketplace_message_outbox(id uuid default gen_random_uuid(),contract_snapshot_id uuid,recipient_kind text,recipient_user_id uuid,message_kind text,payload jsonb,dedupe_key text unique);`);
 const legacyBefore=await value(`select to_jsonb(s) value from dv_market_private.market_contract_snapshots s where deal_id='${OLDDEAL}'`);
 // Reuse the exact protected declaration table and existing public confirmation RPCs.
 await db.exec(before(eligibility,'-- Existing German seller onboarding'));
 for(const name of ['dv_market_private.require_trade_eligibility','public.get_my_market_trade_eligibility','public.confirm_my_market_trade_eligibility','public.confirm_my_market_private_buyer'])await db.exec(fn(eligibility,name));
 const grants=eligibility.split('\n').filter(line=>/^(revoke all|grant execute) on function /.test(line)&&/require_trade_eligibility\(|get_my_market_trade_eligibility\(|confirm_my_market_trade_eligibility\(|confirm_my_market_private_buyer\(/.test(line));
 assert.equal(grants.length,7);await db.exec(grants.join('\n'));
 await db.exec(before(candidate,'-- Sale-only guard'));
 for(const name of ['public.review_market_checkout','public.create_market_offer_v2','dv_market_private.capture_market_contract_snapshot'])await db.exec(fn(candidate,name));
 await db.exec(`revoke all on function public.review_market_checkout(uuid,integer),public.create_market_offer_v2(uuid,integer,numeric,text) from public,anon;
 grant execute on function public.review_market_checkout(uuid,integer),public.create_market_offer_v2(uuid,integer,numeric,text) to authenticated;
 grant insert on public.market_deals to service_role;
 create trigger isolated_snapshot_capture after insert or update of order_id on public.market_deals for each row execute function dv_market_private.capture_market_contract_snapshot();`);
 assert.equal(await value("select to_regclass('dv_market_private.market_buyer_profiles') value"),null);
 assert.equal(await value("select to_regprocedure('public.get_my_market_buyer_profile()') value"),null);
 assert.equal(await value("select to_regprocedure('public.set_my_market_buyer_profile(text)') value"),null);success('no second buyer table, getter, setter or schema activation');
 const legacyAfter=await value(`select to_jsonb(s)-'buyer_type'-'withdrawal_eligible' value from dv_market_private.market_contract_snapshots s where deal_id='${OLDDEAL}'`);
 assert.deepEqual(legacyAfter,legacyBefore);assert.equal(await value(`select buyer_type value from dv_market_private.market_contract_snapshots where deal_id='${OLDDEAL}'`),null);assert.equal(await value(`select buyer_type_snapshot value from public.market_offers where id='${OLDOFFER}'`),null);success('legacy row, text, hash, time, classification and NULL offer status unchanged');
 await claim(null,'anon');await denied('anonymous review denied',`select public.review_market_checkout('${LIST2}',1)`,/permission denied/);
 await claim(null);await denied('missing authentication denied',`select public.review_market_checkout('${LIST2}',1)`,/not_authenticated/);
 await claim(BUYER);await denied('missing existing eligibility denied',`select public.review_market_checkout('${LIST2}',1)`,/trade_eligibility_required/);
 await denied('private eligibility table not browser-readable','select * from dv_market_private.trade_user_eligibility',/permission denied/);
 await denied('private helper not browser-callable',`select dv_market_private.require_market_buyer_type('${BUYER}')`,/permission denied/);
 for(const [dob,country,error] of [["current_date-interval '17 years'",'DE',/trade_must_be_adult/],["current_date-interval '121 years'",'DE',/trade_must_be_adult/],["date '1990-01-01'",'FR',/trade_release1_germany_only/]])await denied('existing age/country confirmation boundary '+dob+country,`select public.confirm_my_market_trade_eligibility((${dob})::date,'${country}',true)`,error);
 await db.query("select public.confirm_my_market_trade_eligibility('1990-01-01','DE',false)");
 await denied('seller-only declaration not inferred as private buyer',`select public.review_market_checkout('${LIST2}',1)`,/buyer_private_consumer_required/);
 await db.query('select public.confirm_my_market_private_buyer()');
 const declared=await value('select public.get_my_market_trade_eligibility() value');assert.equal(declared.buyer_eligible,true);success('existing explicit private-buyer RPC reused');
 for(const [listing,classification] of [[LIST1,'c2c'],[LIST2,'b2c']]){const r=await value(`select public.review_market_checkout('${listing}',1) value`);assert.equal(r.buyer_type,'consumer');assert.equal(r.contract_classification,classification);success('actual authenticated review '+classification)}
 for(const [change,error] of [["date_of_birth=(current_date-interval '17 years')::date",/trade_eligibility_required/],["private_buyer_confirmed=false",/buyer_private_consumer_required/]]){
  await owner();await db.exec(`update dv_market_private.trade_user_eligibility set ${change} where user_id='${BUYER}'`);await claim(BUYER);
  await denied('actual buyer rechecked: '+change,`select public.review_market_checkout('${LIST2}',1)`,error);
  await owner();await db.exec(`update dv_market_private.trade_user_eligibility set date_of_birth='1990-01-01',private_buyer_confirmed=true where user_id='${BUYER}'`);
 }
 for(const change of ["account_status='suspended'","safety_restricted=true","account_closure_requested_at=now()","data_processing_restricted_at=now()"]){
  await owner();await db.exec(`update public.profiles set ${change} where id='${BUYER}'`);await claim(BUYER);
  await denied('account restriction '+change,`select public.review_market_checkout('${LIST2}',1)`,/trade_account_restricted/);
  await owner();await db.exec(`update public.profiles set account_status='active',safety_restricted=false,account_closure_requested_at=null,data_processing_restricted_at=null where id='${BUYER}'`);
 }
 await owner();await db.exec(`update public.profiles set account_status='beta' where id='${BUYER}'`);await claim(BUYER);assert.equal((await review()).buyer_type,'consumer');success('existing beta account remains eligible');
 await owner();await db.exec(`update public.market_listings set pricing_mode='negotiable' where id='${LIST2}'`);await claim(BUYER);
 const offer=await value(`select public.create_market_offer_v2('${LIST2}',1,8,null) value`);
 assert.deepEqual(await value('select public.get_my_market_trade_eligibility() value'),declared);success('review/offer do not change existing declaration timestamps or status');
 await owner();assert.equal(await value('select buyer_type_snapshot value from public.market_offers where id=$1',[offer]),'consumer');success('new offer freezes consumer only');
 for(const buyerType of [null,'business','unknown'])for(const sellerType of ['private','trader']){assert.equal(await value('select dv_market_private.market_contract_classification($1,$2) value',[sellerType,buyerType]),null);success('unsupported classification rejected '+sellerType+'/'+buyerType)}
 await denied('business offer snapshot constraint',`insert into public.market_offers(buyer_type_snapshot) values('business')`,/market_offers_buyer_type_snapshot_check/);
 await denied('historical evidence cannot be rewritten',`update dv_market_private.market_contract_snapshots set contract_classification='b2c' where deal_id='${OLDDEAL}'`,/market_contract_snapshot_is_immutable/);
 // Service caller has no buyer claim: the trigger must validate the actual buyer.
 await claim(null,'service_role');
 const insertDeal=(listing,sellerId,offerId)=>value(`insert into public.market_deals(listing_id,offer_id,order_id,seller_id,buyer_id,amount) values($1,$2,'${ORDER}',$3,'${BUYER}',8) returning id value`,[listing,offerId,sellerId]);
 // INSERT RETURNING requires SELECT(id) in this intentionally small fixture role.
 await owner();await db.exec('grant select(id) on public.market_deals to service_role');await claim(null,'service_role');
 const newDeal=await insertDeal(LIST2,TRADER,offer);
 await owner();const snap=await value('select to_jsonb(s) value from dv_market_private.market_contract_snapshots s where deal_id=$1',[newDeal]);
 assert.equal(snap.buyer_type,'consumer');assert.equal(snap.contract_classification,'b2c');success('new snapshot validates actual buyer under service caller');
 await claim(null,'service_role');await denied('legacy NULL offer not silently reclassified',`insert into public.market_deals(listing_id,offer_id,order_id,seller_id,buyer_id,amount) values('${LIST1}','${OLDOFFER}','${ORDER}','${PRIVATE}','${BUYER}',10)`,/buyer_snapshot_invalid/);
 await owner();await db.exec(`update public.profiles set safety_restricted=true where id='${BUYER}'`);await claim(null,'service_role');
 await denied('service caller cannot bypass restricted actual buyer',`insert into public.market_deals(listing_id,order_id,seller_id,buyer_id,amount) values('${LIST1}','${ORDER}','${PRIVATE}','${BUYER}',10)`,/trade_account_restricted/);
 await owner();const outbox=await value('select count(*)::int value from dv_market_private.marketplace_message_outbox');
 await db.exec(`update public.market_deals set order_id=order_id where id='${OLDDEAL}'`);
 assert.deepEqual(await value(`select to_jsonb(s)-'buyer_type'-'withdrawal_eligible' value from dv_market_private.market_contract_snapshots s where deal_id='${OLDDEAL}'`),legacyBefore);
 assert.equal(await value('select count(*)::int value from dv_market_private.marketplace_message_outbox'),outbox);success('existing snapshot replay unchanged even after account restriction');
}finally{
 await db.close();
 const out=new URL('../test-results/trade-legal-step2/',import.meta.url);await mkdir(out,{recursive:true});
 await writeFile(new URL('buyer-database-results.json',out),JSON.stringify({scope:'isolated PGlite actual Step-2 functions and role fixtures; not full migration, native concurrency, Staging or legal acceptance',results},null,2)+'\n');
}
console.log(`PASS: ${results.length} isolated private-buyer SQL/role scenarios; migration NOT applied to Staging`);
