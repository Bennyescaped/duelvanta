import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

const pgliteUrl=process.argv[2]?pathToFileURL(process.argv[2]).href:import.meta.resolve('@electric-sql/pglite');
const {PGlite}=await import(pgliteUrl);const{pgcrypto}=await import(new URL('./contrib/pgcrypto.js',pgliteUrl).href);
const db=new PGlite({extensions:{pgcrypto}}),USER='91000000-0000-4000-8000-000000000001',OTHER='91000000-0000-4000-8000-000000000002';
const migrations=await Promise.all(['database/market-seller-compliance-v1.sql','database/market-notice-action-v1.sql','database/market-checkout-compliance-v1.sql','database/market-tax-transparency-v1.sql','database/account-data-rights-v1.sql'].map(name=>readFile(new URL('../'+name,import.meta.url),'utf8')));
const claim=async(uid,role='authenticated')=>db.exec(`reset role;select set_config('request.jwt.claim.sub','${uid||''}',false);set role ${role};`);
const value=async sql=>{const result=(await db.query(sql)).rows[0].value;return typeof result==='string'?JSON.parse(result):result};

try{
  await db.exec(`
    create role anon;create role authenticated;create role service_role;create schema auth;
    create table auth.users(id uuid primary key,email text);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth,public to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;
    create table public.profiles(id uuid primary key references auth.users(id) on delete cascade,email text not null,display_name text,username text,role text,account_status text,safety_restricted boolean default false,avatar_path text,collection_visibility text default 'private',created_at timestamptz default now(),updated_at timestamptz default now());
    create table public.collection_folders(id uuid primary key default gen_random_uuid(),user_id uuid not null,name text,created_at timestamptz default now());
    create table public.collection_items(id uuid primary key default gen_random_uuid(),user_id uuid not null,folder_id uuid,image_path text,card_name text,purchase_price numeric,notes text,created_at timestamptz default now());
    create table public.market_listings(id uuid primary key default gen_random_uuid(),seller_id uuid not null references auth.users(id) on delete cascade,collection_item_id uuid,status text not null,listing_type text,pricing_mode text,asking_price numeric,quantity_available int,minimum_purchase_quantity int,quantity_pricing jsonb default '[]',active_until timestamptz,shipping_method text,shipping_cost numeric,tcg text,card_name text,set_name text,card_number text,language text,variant text,condition text,grading_company text,grade text,product_kind text,sealed_category text,sealed_condition text,package_contents text,units_per_container int,seller_note text,image_path text,seller_display_name text,created_at timestamptz default now(),updated_at timestamptz default now());
    create table public.market_listing_images(id uuid primary key default gen_random_uuid(),listing_id uuid,seller_id uuid,storage_path text,created_at timestamptz default now());
    create table public.market_offers(id uuid primary key default gen_random_uuid(),seller_id uuid,buyer_id uuid,listing_id uuid,status text,created_at timestamptz default now());
    create table public.market_orders(id uuid primary key default gen_random_uuid(),order_number text,seller_id uuid,buyer_id uuid,status text default 'completed',payment_provider text default 'manual_beta',created_at timestamptz default now());
    create table public.market_deals(id uuid primary key default gen_random_uuid(),listing_id uuid not null references public.market_listings(id),offer_id uuid references public.market_offers(id),order_id uuid references public.market_orders(id),seller_id uuid not null,buyer_id uuid not null,amount numeric,currency text,status text,accepted_at timestamptz,shipping_method text,shipping_cost numeric,product_kind text,sealed_category text,item_quantity int);
    create table public.market_order_cases(id uuid primary key default gen_random_uuid(),order_id uuid,status text);
    create table public.market_default_shipping_addresses(user_id uuid primary key,recipient_name text,street_line1 text,postal_code text,city text,country_code text);
    create table public.market_shipping_profiles(id uuid primary key default gen_random_uuid(),seller_id uuid,name text,created_at timestamptz default now());
    create table public.market_shipping_profile_rules(id uuid primary key default gen_random_uuid(),profile_id uuid references public.market_shipping_profiles(id) on delete cascade);
    create table public.market_notifications(id uuid primary key default gen_random_uuid(),recipient_id uuid);
    grant select,insert,update,delete on public.collection_items,public.collection_folders,public.market_listings,public.market_offers to authenticated;
    create function public.buy_market_listing_v2(uuid,integer,uuid,timestamptz) returns jsonb language sql as $$select '{}'::jsonb$$;
    insert into auth.users values('${USER}','user@example.test'),('${OTHER}','other@example.test');
    insert into public.profiles(id,email,display_name,role,account_status) values('${USER}','user@example.test','User','player','active'),('${OTHER}','other@example.test','Other','player','active');
  `);
  for(const migration of migrations)await db.exec(migration);
  await db.exec(`
    insert into public.collection_folders(user_id,name) values('${USER}','Privater Ordner');
    insert into public.collection_items(user_id,image_path,card_name,purchase_price,notes) values('${USER}','${USER}/card.webp','Testkarte',12.50,'eigene Notiz');
    insert into public.market_seller_accounts(seller_id,seller_type,onboarding_status,terms_version,verified_at,psttg_subject_type) values('${USER}','private','active','seller-v1',now(),'natural_person');
    insert into dv_market_private.seller_legal_profiles(seller_id,legal_first_name,legal_last_name,date_of_birth,street_line1,postal_code,city,country_code,tax_residence_country_code) values('${USER}','Data','User','1990-01-01','Testweg 1','12345','Testort','DE','DE');
    insert into dv_market_private.seller_tax_identifiers(seller_id,identifier_kind,issuing_country_code,identifier_ciphertext,identifier_hash) values('${USER}','tin','DE',decode('010203','hex'),digest('secret-tax-value','sha256'));
  `);
  await claim(USER);
  const exported=await value(`select public.export_my_duelvanta_data() value`);
  assert.equal(exported.account.email,'user@example.test');assert.equal(exported.collection.items[0].notes,'eigene Notiz');
  assert.equal(exported.marketplace.tax_identifier_references[0].identifier_kind,'tin');
  assert.ok(!JSON.stringify(exported).includes('secret-tax-value')&&!JSON.stringify(exported).includes(OTHER));
  await assert.rejects(()=>db.query('select * from dv_market_private.user_data_export_events'),/permission denied/);

  await db.exec('reset role;');
  const listing=(await db.query(`insert into public.market_listings(seller_id,status,listing_type,pricing_mode,asking_price,quantity_available,minimum_purchase_quantity,shipping_method,shipping_cost,tcg,card_name,language,condition,product_kind) values('${USER}','active','sale','fixed',10,1,1,'letter',1,'pokemon','Blocker','Deutsch','mint','single') returning id`)).rows[0].id;
  await claim(USER);let deletion=await value(`select public.request_my_account_deletion('KONTO LÖSCHEN','92000000-0000-4000-8000-000000000001') value`);
  assert.equal(deletion.accepted,false);assert.ok(deletion.blockers.includes('active_market_listings'));
  await db.exec(`reset role;update public.market_listings set status='ended' where id='${listing}'`);
  await claim(USER);deletion=await value(`select public.request_my_account_deletion('KONTO LÖSCHEN','92000000-0000-4000-8000-000000000001') value`);
  assert.equal(deletion.accepted,true);
  await assert.rejects(()=>db.query(`insert into public.collection_items(user_id,card_name) values('${USER}','Gesperrt')`),/account_data_processing_restricted/);
  await assert.rejects(()=>db.query(`select public.claim_account_deletion_requests(5,'93000000-0000-4000-8000-000000000001')`),/service_role_required|permission denied/);
  await claim(null,'service_role');
  const claimed=(await db.query(`select * from public.claim_account_deletion_requests(5,'93000000-0000-4000-8000-000000000001')`)).rows[0];
  const plan=await value(`select public.prepare_account_deletion_data('${claimed.request_id}','${claimed.delivery_lock_token}') value`);
  assert.equal(plan.auth_action,'delete');
  await db.query(`select public.finish_account_deletion_request('${claimed.request_id}','${claimed.delivery_lock_token}',true,null)`);
  await db.exec('reset role;');
  const profile=(await db.query(`select display_name,username,avatar_path,collection_visibility from public.profiles where id='${USER}'`)).rows[0];
  assert.deepEqual(profile,{display_name:'Gelöschtes Mitglied',username:null,avatar_path:null,collection_visibility:'private'});
  assert.equal(Number((await db.query(`select count(*) count from public.collection_items where user_id='${USER}'`)).rows[0].count),0);
  assert.equal((await db.query(`select status from dv_market_private.account_deletion_requests where id='${claimed.request_id}'`)).rows[0].status,'completed');
  await assert.rejects(()=>db.query(`delete from dv_market_private.account_data_rights_audit`),/account_data_rights_audit_is_immutable/);

  await db.exec(`
    insert into public.market_seller_accounts(seller_id,seller_type,onboarding_status,terms_version,verified_at,psttg_subject_type) values('${OTHER}','private','active','seller-v1',now(),'natural_person');
    insert into dv_market_private.seller_legal_profiles(seller_id,legal_first_name,legal_last_name,date_of_birth,street_line1,postal_code,city,country_code,tax_residence_country_code) values('${OTHER}','Retained','User','1985-01-01','Belegweg 2','54321','Archivort','DE','DE');
    with l as (insert into public.market_listings(seller_id,status,listing_type,pricing_mode,asking_price,quantity_available,minimum_purchase_quantity,quantity_pricing,shipping_method,shipping_cost,tcg,card_name,language,condition,product_kind) values('${OTHER}','ended','sale','fixed',20,0,1,'[]','letter',2,'pokemon','Vertragskarte','Deutsch','mint','single') returning id),
    o as (insert into public.market_orders(order_number,seller_id,buyer_id,status) values('DV-RETAIN','${OTHER}','${USER}','completed') returning id)
    insert into public.market_deals(listing_id,order_id,seller_id,buyer_id,amount,currency,status,accepted_at,shipping_method,shipping_cost,product_kind,item_quantity)
    select l.id,o.id,'${OTHER}','${USER}',20,'EUR','completed','2026-09-13T12:00:00Z','letter',2,'single',1 from l,o;
  `);
  await claim(OTHER);const retainedRequest=await value(`select public.request_my_account_deletion('KONTO LÖSCHEN','92000000-0000-4000-8000-000000000002') value`);assert.equal(retainedRequest.accepted,true);
  await claim(null,'service_role');const retainedClaim=(await db.query(`select * from public.claim_account_deletion_requests(5,'93000000-0000-4000-8000-000000000002')`)).rows[0];const retainedPlan=await value(`select public.prepare_account_deletion_data('${retainedClaim.request_id}','${retainedClaim.delivery_lock_token}') value`);assert.equal(retainedPlan.auth_action,'disable_and_retain');
  await db.query(`select public.finish_account_deletion_request('${retainedClaim.request_id}','${retainedClaim.delivery_lock_token}',true,null)`);await db.exec('reset role;');
  assert.equal((await db.query(`select status from dv_market_private.account_deletion_requests where id='${retainedClaim.request_id}'`)).rows[0].status,'retained');
  const holds=(await db.query(`select category,manual_review_required,retain_until from dv_market_private.account_deletion_holds where request_id='${retainedClaim.request_id}' order by category`)).rows;assert.ok(holds.some(hold=>hold.category==='contract_evidence'&&hold.manual_review_required));assert.ok(holds.some(hold=>hold.category==='psttg_record'&&hold.retain_until));
  console.log('PASS: own-data export is minimized, deletion blockers are enforced, and erasure is staged with immutable audit');
}finally{await db.close()}
