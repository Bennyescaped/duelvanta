import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const pgliteUrl=process.argv[2]?pathToFileURL(process.argv[2]).href:import.meta.resolve('@electric-sql/pglite');
const {PGlite}=await import(pgliteUrl);const {pgcrypto}=await import(new URL('./contrib/pgcrypto.js',pgliteUrl).href);
const db=new PGlite({extensions:{pgcrypto}}),migration=await readFile(new URL('../database/market-stripe-connect-sandbox-v1.sql',import.meta.url),'utf8');
const BUYER='91000000-0000-4000-8000-000000000001',SELLER='91000000-0000-4000-8000-000000000002';
const ORDER='92000000-0000-4000-8000-000000000001',DEAL1='93000000-0000-4000-8000-000000000001',DEAL2='93000000-0000-4000-8000-000000000002';
const SNAP1='94000000-0000-4000-8000-000000000001',SNAP2='94000000-0000-4000-8000-000000000002',KEY='95000000-0000-4000-8000-000000000001';
const json=value=>typeof value==='string'?JSON.parse(value):value;
try{
  await db.exec(`
    create role anon;create role authenticated;create role service_role;create schema auth;create schema dv_market_private;
    create table auth.users(id uuid primary key,email text);grant usage on schema auth,public to anon,authenticated,service_role;
    create function auth.uid() returns uuid language sql stable as $$select null::uuid$$;
    create table public.profiles(id uuid primary key,role text);
    create table public.market_seller_accounts(seller_id uuid primary key,seller_type text,onboarding_status text,country_code text);
    create table public.market_listings(id uuid primary key,seller_id uuid,status text);
    create table public.market_offers(id uuid primary key,seller_id uuid,buyer_id uuid,status text);
    create table public.market_orders(id uuid primary key,order_number text,seller_id uuid,buyer_id uuid,status text,shipped_at timestamptz,
      shipping_quote_status text,payment_provider text,payment_status text,paid_amount numeric,total_amount numeric,currency text,provider_payment_ref text,
      paid_at timestamptz,platform_fee_amount numeric,seller_net_amount numeric,refund_status text,refund_amount numeric,provider_refund_ref text,updated_at timestamptz);
    create table public.market_deals(id uuid primary key,order_id uuid,seller_id uuid,buyer_id uuid,payment_provider text,payment_status text,
      provider_payment_ref text,paid_at timestamptz,updated_at timestamptz);
    create table public.market_order_cases(id uuid primary key,order_id uuid,status text);
    create table dv_market_private.listing_notice_appeals(id uuid primary key,appellant_user_id uuid,status text);
    create table dv_market_private.market_contract_snapshots(id uuid primary key,deal_id uuid,order_id uuid,goods_total numeric,currency text default 'EUR');
    create table dv_market_private.market_tax_events(id uuid primary key default gen_random_uuid(),event_key text unique,event_type text);
    create table dv_market_private.tax_test_corrections(id uuid primary key default gen_random_uuid(),original_id uuid,event_key text unique);
    create function public.record_market_tax_remuneration(uuid,text,timestamptz,numeric,numeric,numeric,numeric,text,text,jsonb) returns jsonb
      language plpgsql security definer as $$declare v uuid;begin insert into dv_market_private.market_tax_events(event_key,event_type) values($2,'remuneration_paid_or_credited') returning id into v;return jsonb_build_object('event_id',v);end$$;
    create function public.correct_market_tax_remuneration(uuid,text,timestamptz,numeric,numeric,numeric,numeric,boolean,text,jsonb) returns jsonb
      language plpgsql security definer as $$declare v uuid;begin insert into dv_market_private.tax_test_corrections(original_id,event_key) values($1,$2) returning id into v;return jsonb_build_object('event_id',v);end$$;
    insert into auth.users values('${BUYER}','buyer@example.test'),('${SELLER}','seller@example.test');
    insert into public.market_seller_accounts values('${SELLER}','trader','active','AT');
    insert into public.market_orders values('${ORDER}','DV-TEST','${SELLER}','${BUYER}','open',null,'confirmed','manual_beta','not_required',0,105,'EUR',null,null,0,0,'not_required',0,null,now());
    insert into public.market_deals values('${DEAL1}','${ORDER}','${SELLER}','${BUYER}','manual_beta','not_required',null,null,now()),
      ('${DEAL2}','${ORDER}','${SELLER}','${BUYER}','manual_beta','not_required',null,null,now());
    insert into dv_market_private.market_contract_snapshots(id,deal_id,order_id,goods_total) values('${SNAP1}','${DEAL1}','${ORDER}',40),('${SNAP2}','${DEAL2}','${ORDER}',60);
  `);
  await db.exec(migration);
  assert.equal(json((await db.query('select public.get_market_payment_sandbox_status() value')).rows[0].value).sandbox_enabled,false);
  await db.exec(`update dv_market_private.market_payment_configuration set sandbox_enabled=true,platform_fee_bps=200,platform_fee_fixed_cents=40;set role service_role;`);
  const onboarding=json((await db.query(`select public.prepare_market_stripe_onboarding('${SELLER}','98000000-0000-4000-8000-000000000001') value`)).rows[0].value);
  assert.equal(onboarding.country_code,'AT');
  const onboardingReplay=json((await db.query(`select public.prepare_market_stripe_onboarding('${SELLER}','98000000-0000-4000-8000-000000000001') value`)).rows[0].value);
  assert.equal(onboardingReplay.country_code,'AT');assert.equal(onboardingReplay.replayed,true);
  const resumed=json((await db.query(`select public.prepare_market_stripe_onboarding('${SELLER}','98000000-0000-4000-8000-000000000002') value`)).rows[0].value);
  assert.equal(resumed.onboarding_request_id,onboarding.onboarding_request_id);assert.equal(resumed.replayed,true);
  await db.query(`select public.register_market_stripe_test_account('${onboarding.onboarding_request_id}','${SELLER}','acct_TestSeller')`);
  const accountEvent=json((await db.query(`select public.apply_market_stripe_event('evt_TestAccount','account.updated','acct_TestSeller',false,'acct_TestSeller',repeat('c',64),now(),'{"charges_enabled":true,"payouts_enabled":true,"details_submitted":true,"requirements_due_count":0,"past_due_count":0}'::jsonb) value`)).rows[0].value);
  assert.equal(accountEvent.status,'applied');
  await db.exec('reset role;');
  const account=(await db.query(`select onboarding_status,charges_enabled,payouts_enabled from dv_market_private.market_stripe_accounts where seller_id='${SELLER}'`)).rows[0];
  assert.deepEqual(account,{onboarding_status:'ready',charges_enabled:true,payouts_enabled:true});
  assert.equal((await db.query(`select state from dv_market_private.market_stripe_onboarding_requests where seller_id='${SELLER}'`)).rows[0].state,'completed');
  await db.exec('set role service_role;');
  const prepared=json((await db.query(`select public.prepare_market_stripe_payment('${ORDER}','${BUYER}','${KEY}') value`)).rows[0].value);
  assert.equal(prepared.amount_due_cents,10500);assert.equal(prepared.platform_fee_cents,250);assert.equal(prepared.live_mode,false);
  const replay=json((await db.query(`select public.prepare_market_stripe_payment('${ORDER}','${BUYER}','${KEY}') value`)).rows[0].value);assert.equal(replay.replayed,true);
  await db.exec('reset role;');
  const allocations=(await db.query(`select gross_cents,platform_fee_cents from dv_market_private.market_payment_allocations order by contract_snapshot_id`)).rows;
  assert.deepEqual(allocations.map(r=>Number(r.gross_cents)),[4000,6500]);assert.equal(allocations.reduce((n,r)=>n+Number(r.platform_fee_cents),0),250);
  await db.exec('set role service_role;');
  await db.query(`select public.bind_market_stripe_checkout_session('${prepared.attempt_id}','cs_test_TestSession')`);
  const paid=json((await db.query(`select public.apply_market_stripe_event('evt_TestPaid','payment_intent.succeeded','acct_TestSeller',false,'pi_TestIntent',repeat('a',64),now(),'${JSON.stringify({attempt_id:prepared.attempt_id,amount_cents:10500,currency:'eur',charge_id:'ch_TestCharge'})}'::jsonb) value`)).rows[0].value);
  assert.equal(paid.status,'applied');
  await db.exec('reset role;');
  const order=(await db.query(`select payment_provider,payment_status,paid_amount,platform_fee_amount,seller_net_amount from public.market_orders where id='${ORDER}'`)).rows[0];
  assert.deepEqual({...order,paid_amount:Number(order.paid_amount),platform_fee_amount:Number(order.platform_fee_amount),seller_net_amount:Number(order.seller_net_amount)},
    {payment_provider:'stripe_connect',payment_status:'paid',paid_amount:105,platform_fee_amount:2.5,seller_net_amount:102.5});
  assert.equal(Number((await db.query('select count(*) count from dv_market_private.market_tax_events')).rows[0].count),2);
  await db.exec('set role service_role;');
  const eventReplay=json((await db.query(`select public.apply_market_stripe_event('evt_TestPaid','payment_intent.succeeded','acct_TestSeller',false,'pi_TestIntent',repeat('a',64),now(),'{}') value`)).rows[0].value);assert.equal(eventReplay.replayed,true);
  await db.exec('reset role;');
  await assert.rejects(()=>db.query(`update dv_market_private.market_stripe_events set processing_note='changed' where stripe_event_id='evt_TestPaid'`),/market_payment_evidence_is_immutable/);
  await db.exec(`reset role;update public.market_orders set refund_status='provider_required' where id='${ORDER}';set role service_role;`);
  const refund=json((await db.query(`select public.prepare_market_stripe_full_refund('${ORDER}','96000000-0000-4000-8000-000000000001','Akzeptierte Stornierung') value`)).rows[0].value);assert.equal(refund.amount_cents,10500);
  const refunded=json((await db.query(`select public.apply_market_stripe_event('evt_TestRefund','charge.refunded','acct_TestSeller',false,'ch_TestCharge',repeat('b',64),now(),'${JSON.stringify({attempt_id:prepared.attempt_id,amount_cents:10500,currency:'eur',refund_id:'re_TestRefund'})}'::jsonb) value`)).rows[0].value);assert.equal(refunded.status,'applied');
  await db.exec('reset role;');
  assert.equal(Number((await db.query('select count(*) count from dv_market_private.tax_test_corrections')).rows[0].count),2);
  await db.exec('set role service_role;');
  await assert.rejects(()=>db.query(`select public.issue_market_financial_document('${prepared.attempt_id}','seller_goods_invoice','{}',100,19,119)`),/seller_invoice_authorization_required/);
  await db.query(`select public.apply_market_stripe_event('evt_TestRestricted','account.updated','acct_TestSeller',false,'acct_TestSeller',repeat('d',64),now(),'{"charges_enabled":false,"payouts_enabled":false,"details_submitted":true,"requirements_due_count":1,"past_due_count":1,"disabled_reason":"requirements.past_due"}'::jsonb)`);
  await db.exec('reset role;');
  assert.deepEqual((await db.query(`select a.onboarding_status,r.state from dv_market_private.market_stripe_accounts a join dv_market_private.market_stripe_onboarding_requests r using(seller_id) where a.seller_id='${SELLER}'`)).rows[0],
    {onboarding_status:'restricted',state:'account_created'});
  await db.exec('set role authenticated;');
  await assert.rejects(()=>db.query(`select public.prepare_market_stripe_payment('${ORDER}','${BUYER}','97000000-0000-4000-8000-000000000001')`),/permission denied/);
  await assert.rejects(()=>db.query('select * from dv_market_private.market_payment_attempts'),/permission denied/);
  console.log('PASS: sandbox payment, allocations, ledger, replay and full refund transitions are database-enforced');
}finally{await db.close()}
