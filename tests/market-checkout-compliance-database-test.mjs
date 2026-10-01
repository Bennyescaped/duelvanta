import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

const pgliteUrl=process.argv[2]?pathToFileURL(process.argv[2]).href:import.meta.resolve('@electric-sql/pglite');
const {PGlite}=await import(pgliteUrl);
const {pgcrypto}=await import(new URL('./contrib/pgcrypto.js',pgliteUrl).href);
const db=new PGlite({extensions:{pgcrypto}});
const BUYER='40000000-0000-4000-8000-000000000001',OUTSIDER='40000000-0000-4000-8000-000000000002';
const PRIVATE='40000000-0000-4000-8000-000000000003',TRADER='40000000-0000-4000-8000-000000000004';
const ORDER1='50000000-0000-4000-8000-000000000001',ORDER2='50000000-0000-4000-8000-000000000002';
const LIST1='60000000-0000-4000-8000-000000000001',LIST2='60000000-0000-4000-8000-000000000002';
const migration=await readFile(new URL('../database/market-checkout-compliance-v1.sql',import.meta.url),'utf8');
const sellerMigration=await readFile(new URL('../database/market-seller-compliance-v1.sql',import.meta.url),'utf8');
const noticeMigration=await readFile(new URL('../database/market-notice-action-v1.sql',import.meta.url),'utf8');
const claim=async(uid,role='authenticated')=>db.exec(`reset role;select set_config('request.jwt.claim.sub','${uid||''}',false);set role ${role};`);
const json=value=>typeof value==='string'?JSON.parse(value):value;

try{
  await db.exec(`
    create role anon;create role authenticated;create role service_role;create schema auth;
    create table auth.users(id uuid primary key,email text);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth,public to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;
    create table public.profiles(id uuid primary key references auth.users(id),role text,account_status text,safety_restricted boolean default false);
    create table public.market_listings(
      id uuid primary key,seller_id uuid not null references auth.users(id),status text not null,listing_type text,pricing_mode text,
      asking_price numeric,quantity_available int,minimum_purchase_quantity int,quantity_pricing jsonb default '[]',active_until timestamptz,
      shipping_method text,shipping_cost numeric,tcg text,card_name text,set_name text,card_number text,language text,variant text,condition text,
      grading_company text,grade text,product_kind text,sealed_category text,sealed_condition text,package_contents text,units_per_container int,
      seller_note text,updated_at timestamptz not null default now()
    );
    create table public.market_offers(id uuid primary key,seller_id uuid,buyer_id uuid,listing_id uuid,status text);
    create table public.market_orders(id uuid primary key,order_number text,seller_id uuid,buyer_id uuid,payment_provider text default 'manual_beta');
    create table public.market_deals(
      id uuid primary key default gen_random_uuid(),listing_id uuid not null references public.market_listings(id),offer_id uuid references public.market_offers(id),
      order_id uuid references public.market_orders(id),seller_id uuid not null,buyer_id uuid not null,amount numeric,currency text,status text,
      accepted_at timestamptz,shipping_method text,shipping_cost numeric,product_kind text,sealed_category text,item_quantity int
    );
    create function public.buy_market_listing_v2(uuid,integer,uuid,timestamptz) returns jsonb language sql as $$select '{}'::jsonb$$;
    insert into auth.users(id,email) values('${BUYER}','buyer@example.test'),('${OUTSIDER}','outsider@example.test'),('${PRIVATE}','private@example.test'),('${TRADER}','trader@example.test');
    insert into public.profiles(id,role,account_status) values('${BUYER}','player','active'),('${OUTSIDER}','player','active'),('${PRIVATE}','player','active'),('${TRADER}','player','active');
  `);
  await db.exec(sellerMigration);await db.exec(noticeMigration);await db.exec(migration);
  await db.exec(`
    insert into public.market_seller_accounts(seller_id,seller_type,onboarding_status,terms_version,verified_at,trader_display_name)
    values('${PRIVATE}','private','active','seller-v1',now(),null),('${TRADER}','trader','active','seller-v1',now(),'Card Shop');
    insert into dv_market_private.seller_legal_profiles(seller_id,legal_first_name,legal_last_name,date_of_birth,business_name,legal_form,street_line1,postal_code,city,country_code,public_email)
    values('${PRIVATE}','Private','Seller','1990-01-01',null,null,'Privatweg 1','75100','Teststadt','DE',null),
          ('${TRADER}','Trade','Seller','1980-01-01','Card Shop','Einzelunternehmen','Shopweg 2','75200','Handelsstadt','DE','shop@example.test');
    insert into public.market_listings(id,seller_id,status,listing_type,pricing_mode,asking_price,quantity_available,minimum_purchase_quantity,quantity_pricing,shipping_method,shipping_cost,tcg,card_name,set_name,language,condition,product_kind,updated_at)
    values('${LIST1}','${PRIVATE}','active','sale','fixed',100,1,1,'[]','tracked_letter',3.50,'pokemon','Private Karte','Set A','Deutsch','mint','single',now()),
          ('${LIST2}','${TRADER}','active','sale','fixed',240,10,1,'[{"min_quantity":3,"unit_price":220}]','parcel',6.99,'one_piece','Shop Display','OP-Test','Englisch','sealed','sealed',now());
    insert into public.market_orders(id,order_number,seller_id,buyer_id) values('${ORDER1}','DV-C2C','${PRIVATE}','${BUYER}'),('${ORDER2}','DV-B2C','${TRADER}','${BUYER}');
  `);

  await claim(BUYER);
  const preview=json((await db.query(`select public.review_market_checkout('${LIST2}',3) value`)).rows[0].value);
  assert.equal(preview.contract_classification,'b2c');assert.equal(Number(preview.goods_total),660);assert.equal(Number(preview.total_price),666.99);assert.equal(preview.seller_party.business_name,'Card Shop');assert.match(preview.checkout_hash,/^[a-f0-9]{64}$/);

  await db.exec(`reset role;
    insert into public.market_deals(listing_id,order_id,seller_id,buyer_id,amount,currency,status,accepted_at,shipping_method,shipping_cost,product_kind,item_quantity)
    values('${LIST1}','${ORDER1}','${PRIVATE}','${BUYER}',100,'EUR','accepted',now(),'tracked_letter',3.50,'single',1),
          ('${LIST2}','${ORDER2}','${TRADER}','${BUYER}',660,'EUR','accepted',now(),'parcel',6.99,'sealed',3);
  `);
  await claim(BUYER);
  const c2c=json((await db.query(`select public.get_my_market_order_contract_documents('${ORDER1}') value`)).rows[0].value)[0];
  const b2c=json((await db.query(`select public.get_my_market_order_contract_documents('${ORDER2}') value`)).rows[0].value)[0];
  assert.equal(c2c.contract_classification,'c2c');assert.equal(c2c.seller_party.role_label,'Privater Verkäufer');assert.equal(Number(c2c.total_price),103.5);
  assert.match(c2c.confirmation_text,/Versand \(Brief mit Tracking\): 3\.50 EUR/);
  assert.equal(b2c.contract_classification,'b2c');assert.equal(b2c.product.title,'Shop Display');assert.equal(Number(b2c.quantity),3);assert.equal(Number(b2c.goods_total),660);assert.match(b2c.content_sha256,/^[a-f0-9]{64}$/);
  assert.match(b2c.confirmation_text,/Versand \(Paket mit Tracking\): 6\.99 EUR/);
  await db.exec(`reset role;update public.market_listings set card_name='Später geändert',asking_price=999 where id='${LIST2}'`);
  await claim(BUYER);const unchanged=json((await db.query(`select public.get_my_market_order_contract_documents('${ORDER2}') value`)).rows[0].value)[0];assert.equal(unchanged.product.title,'Shop Display');assert.equal(Number(unchanged.goods_total),660);
  await claim(OUTSIDER);await assert.rejects(()=>db.query(`select public.get_my_market_order_contract_documents('${ORDER2}')`),/contract_document_access_denied/);
  await db.exec('reset role;');await assert.rejects(()=>db.query(`update dv_market_private.market_contract_snapshots set quantity=4`),/market_contract_snapshot_is_immutable/);

  await claim(null,'service_role');const deliveries=(await db.query(`select * from public.claim_marketplace_message_delivery(10,'70000000-0000-4000-8000-000000000001')`)).rows;
  assert.equal(deliveries.length,2);assert.ok(deliveries.every(row=>row.recipient_email==='buyer@example.test'));assert.ok(deliveries.every(row=>row.confirmation_text.includes('DUELVANTA BESTELLBESTÄTIGUNG')));
  await db.query(`select public.finish_marketplace_message_delivery('${deliveries[0].message_id}','${deliveries[0].delivery_lock_token}',true,'provider-test',null)`);
  await db.exec('reset role;');const sent=(await db.query(`select delivery_status,provider_message_id from dv_market_private.marketplace_message_outbox where id='${deliveries[0].message_id}'`)).rows[0];assert.deepEqual(sent,{delivery_status:'sent',provider_message_id:'provider-test'});
  assert.equal(Number((await db.query(`select count(*) count from dv_market_private.marketplace_message_delivery_events where message_id='${deliveries[0].message_id}'`)).rows[0].count),2);
  console.log('PASS: C2C/B2C snapshots remain immutable, documents are access-bound and delivery claims are audited');
}finally{await db.close()}
