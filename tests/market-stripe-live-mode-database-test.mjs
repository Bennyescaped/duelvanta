import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const pgliteUrl=process.argv[2]?pathToFileURL(process.argv[2]).href:import.meta.resolve('@electric-sql/pglite');
const {PGlite}=await import(pgliteUrl);const {pgcrypto}=await import(new URL('./contrib/pgcrypto.js',pgliteUrl).href);
const db=new PGlite({extensions:{pgcrypto}});
const [base,ordering,live]=await Promise.all([
  '../database/market-stripe-connect-sandbox-v1.sql','../database/market-stripe-event-ordering-hardening-v1.sql','../database/market-stripe-live-mode-v1.sql'
].map(path=>readFile(new URL(path,import.meta.url),'utf8')));
const BUYER='81000000-0000-4000-8000-000000000001',SELLER='81000000-0000-4000-8000-000000000002';
const ORDER='82000000-0000-4000-8000-000000000001',DEAL='83000000-0000-4000-8000-000000000001';
const SNAP='84000000-0000-4000-8000-000000000001',KEY='85000000-0000-4000-8000-000000000001';
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
      shipping_quote_status text,payment_provider text,payment_status text,paid_amount numeric,total_amount numeric,currency text,
      refund_status text,refund_amount numeric,provider_refund_ref text,updated_at timestamptz);
    create table public.market_deals(id uuid primary key,order_id uuid,seller_id uuid,buyer_id uuid,payment_provider text,payment_status text,
      provider_payment_ref text,paid_at timestamptz,updated_at timestamptz);
    create table public.market_order_cases(id uuid primary key,order_id uuid,status text);
    create table dv_market_private.listing_notice_appeals(id uuid primary key,appellant_user_id uuid,status text);
    create table dv_market_private.market_contract_snapshots(id uuid primary key,deal_id uuid,order_id uuid,goods_total numeric,currency text default 'EUR');
    create table dv_market_private.market_tax_events(id uuid primary key default gen_random_uuid(),event_key text unique,event_type text,source_reference text);
    create table dv_market_private.tax_test_corrections(id uuid primary key default gen_random_uuid(),original_id uuid,event_key text unique);
    create function public.record_market_tax_remuneration(uuid,text,timestamptz,numeric,numeric,numeric,numeric,text,text,jsonb) returns jsonb
      language plpgsql security definer as $$declare v uuid;begin insert into dv_market_private.market_tax_events(event_key,event_type,source_reference) values($2,'remuneration_paid_or_credited',$9) returning id into v;return jsonb_build_object('event_id',v);end$$;
    create function public.correct_market_tax_remuneration(uuid,text,timestamptz,numeric,numeric,numeric,numeric,boolean,text,jsonb) returns jsonb
      language plpgsql security definer as $$declare v uuid;begin insert into dv_market_private.tax_test_corrections(original_id,event_key) values($1,$2) returning id into v;return jsonb_build_object('event_id',v);end$$;
    insert into auth.users values('${BUYER}','buyer@example.test'),('${SELLER}','seller@example.test');
    insert into public.market_seller_accounts values('${SELLER}','trader','active','DE');
    insert into public.market_orders(id,order_number,seller_id,buyer_id,status,shipped_at,shipping_quote_status,payment_provider,payment_status,paid_amount,total_amount,currency,refund_status,refund_amount,provider_refund_ref,updated_at)
      values('${ORDER}','DV-LIVE','${SELLER}','${BUYER}','open',null,'confirmed','manual_beta','not_required',0,105,'EUR','not_required',0,null,now());
    insert into public.market_deals values('${DEAL}','${ORDER}','${SELLER}','${BUYER}','manual_beta','not_required',null,null,now());
    insert into dv_market_private.market_contract_snapshots(id,deal_id,order_id,goods_total) values('${SNAP}','${DEAL}','${ORDER}',105);
  `);
  await db.exec(base);await db.exec(ordering);await db.exec(live);

  const initial=(await db.query(`select sandbox_enabled,live_mode from dv_market_private.market_payment_configuration where singleton`)).rows[0];
  assert.deepEqual(initial,{sandbox_enabled:false,live_mode:false});
  await assert.rejects(()=>db.query(`update dv_market_private.market_payment_configuration set sandbox_enabled=true,live_mode=true`),/market_payment_configuration_mode_check/);
  await db.exec(`update dv_market_private.market_payment_configuration set sandbox_enabled=false,live_mode=true,platform_fee_bps=200,platform_fee_fixed_cents=40;set role service_role;`);

  const onboarding=json((await db.query(`select public.prepare_market_stripe_onboarding('${SELLER}','86000000-0000-4000-8000-000000000001') value`)).rows[0].value);
  assert.equal(onboarding.live_mode,true);
  await db.query(`select public.register_market_stripe_account('${onboarding.onboarding_request_id}','${SELLER}','acct_LiveSeller',true)`);
  const accountEvent=json((await db.query(`select public.apply_market_stripe_event('evt_LiveAccount','account.updated','acct_LiveSeller',true,'acct_LiveSeller',repeat('a',64),now(),'{"charges_enabled":true,"payouts_enabled":true,"details_submitted":true,"requirements_due_count":0,"past_due_count":0}'::jsonb) value`)).rows[0].value);
  assert.equal(accountEvent.status,'applied');
  const prepared=json((await db.query(`select public.prepare_market_stripe_payment('${ORDER}','${BUYER}','${KEY}') value`)).rows[0].value);
  assert.equal(prepared.live_mode,true);assert.equal(prepared.amount_due_cents,10500);
  await assert.rejects(()=>db.query(`select public.bind_market_stripe_checkout_session('${prepared.attempt_id}','cs_test_WrongMode')`),/stripe_session_mode_invalid/);
  await db.query(`select public.bind_market_stripe_checkout_session('${prepared.attempt_id}','cs_live_LiveSession')`);

  await db.exec(`reset role;update dv_market_private.market_payment_configuration set live_mode=false,sandbox_enabled=false;set role service_role;`);
  const late=json((await db.query(`select public.apply_market_stripe_event('evt_LiveLateCheckout','checkout.session.completed','acct_LiveSeller',true,'cs_live_LiveSession',repeat('b',64),now(),'${JSON.stringify({attempt_id:prepared.attempt_id,payment_intent_id:'pi_LiveIntent'})}'::jsonb) value`)).rows[0].value);
  assert.equal(late.status,'applied','existing live provider event must still apply after new-payment mode is disabled');
  await assert.rejects(()=>db.query(`select public.prepare_market_stripe_payment('${ORDER}','${BUYER}','87000000-0000-4000-8000-000000000001')`),/stripe_provider_disabled/);

  const wrongMode=json((await db.query(`select public.apply_market_stripe_event('evt_TestAgainstLive','payment_intent.payment_failed','acct_LiveSeller',false,'pi_LiveIntent',repeat('c',64),now(),'${JSON.stringify({attempt_id:prepared.attempt_id})}'::jsonb) value`)).rows[0].value);
  assert.equal(wrongMode.status,'ignored');
  await db.exec('reset role');
  const wrongModeNote=(await db.query(`select processing_note from dv_market_private.market_stripe_events where stripe_event_id='evt_TestAgainstLive'`)).rows[0].processing_note;
  assert.equal(wrongModeNote,'attempt_not_found','wrong-mode provider event must be durably recorded as unmatched');
  const attemptAfterWrong=(await db.query(`select state,live_mode from dv_market_private.market_payment_attempts where id='${prepared.attempt_id}'`)).rows[0];
  assert.deepEqual(attemptAfterWrong,{state:'processing',live_mode:true});

  await db.exec(`reset role;update dv_market_private.market_payment_attempts set state='paid',paid_cents=amount_due_cents,stripe_payment_intent_id='pi_LiveIntent' where id='${prepared.attempt_id}';update public.market_orders set refund_status='provider_required' where id='${ORDER}';set role service_role;`);
  const refund=json((await db.query(`select public.prepare_market_stripe_full_refund('${ORDER}','88000000-0000-4000-8000-000000000001','Akzeptierte Stornierung') value`)).rows[0].value);
  assert.equal(refund.live_mode,true);assert.equal(refund.payment_intent_id,'pi_LiveIntent');

  await db.exec('reset role');
  const accountModes=(await db.query(`select live_mode,stripe_account_id from dv_market_private.market_stripe_accounts where seller_id='${SELLER}' order by live_mode`)).rows;
  assert.deepEqual(accountModes,[{live_mode:true,stripe_account_id:'acct_LiveSeller'}]);
  console.log('PASS: Stripe live database mode is explicit, isolated, default-off and preserves in-flight webhook processing');
}finally{await db.close()}
