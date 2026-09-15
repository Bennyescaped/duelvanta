import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=name=>readFile(new URL('../'+name,import.meta.url),'utf8');
const [sql,ordering,lib,onboarding,checkout,webhook,refund,orders,trade,workflow,notice]=await Promise.all([
  'database/market-stripe-connect-sandbox-v1.sql','database/market-stripe-event-ordering-hardening-v1.sql',
  'api/market-stripe-lib.js','api/market-stripe-onboarding.js',
  'api/market-stripe-checkout.js','api/market-stripe-webhook.js','api/market-stripe-refund.js','trade-orders.js','trade.html','.github/workflows/scanner-v16-check.yml','database/market-notice-action-v1.sql'
].map(read));
const must=(source,text,message)=>assert.ok(source.includes(text),message);
for(const table of ['market_payment_configuration','market_stripe_accounts','market_payment_attempts','market_payment_allocations','market_stripe_events','market_refund_requests','market_invoice_authorizations','market_financial_documents'])must(sql,table,'missing '+table);
must(sql,"charge_model text not null default 'direct_charge'",'direct-charge model is not fixed');
must(sql,'sandbox_enabled boolean not null default false','sandbox must be default-off');
must(sql,'live_mode boolean not null default false check (live_mode=false)','live mode is not database-blocked');
must(sql,'stripe_shipping_review_required','unconfirmed shipping can be charged');
must(sql,'stripe_paid_amount_mismatch','provider amount is not checked');
must(sql,'stripe_partial_refund_requires_review','partial refund is silently automated');
must(sql,'seller_invoice_authorization_required','seller invoice authorization is missing');
must(sql,'platform_fee_tax_review_required','platform fee tax review is bypassed');
must(sql,'record_market_tax_remuneration','provider payment is not linked to PStTG ledger');
must(sql,'correct_market_tax_remuneration','refund is not linked to PStTG correction');
must(sql,'market_payment_evidence_is_immutable','provider evidence is mutable');
must(sql,'get_my_market_payment_records','payment data access/export boundary is missing');
must(sql,"'open_payment_processing'",'account erasure can race payment processing');
must(sql,'market_stripe_onboarding_requests','idempotent connected-account onboarding is missing');
must(sql,'alter table public.market_orders add column if not exists provider_payment_ref text','order provider payment reference column is missing');
must(sql,'alter table public.market_orders add column if not exists paid_at timestamptz','order paid timestamp column is missing');
must(sql,'alter table public.market_orders add column if not exists platform_fee_amount numeric','order platform fee column is missing');
must(sql,'alter table public.market_orders add column if not exists seller_net_amount numeric','order seller net column is missing');

must(sql,"p_event_type='account.updated'",'connected-account status webhook is missing');
assert.ok(!/grant execute on function public\.(prepare_market_stripe_payment|apply_market_stripe_event|prepare_market_stripe_full_refund)[^;]+authenticated/.test(sql),'browser role received payment backend authority');
for(const source of [lib,onboarding,checkout,webhook,refund])assert.ok(!source.includes('sk_test_123')&&!source.includes('whsec_123'),'secret-looking test value committed');
must(onboarding,"dashboard:'full'",'seller-owned full Stripe dashboard is not configured');
must(onboarding,"fees_collector:'stripe'",'Stripe fee responsibility is not explicit');
must(onboarding,"losses_collector:'stripe'",'Stripe loss responsibility is not explicit');
must(onboarding,"type:'account_onboarding'",'Stripe-hosted onboarding link is missing');
must(checkout,"STRIPE_CONNECT_SANDBOX_ENABLED!=='true'",'checkout is not default-off');
must(checkout,"startsWith('sk_test_')",'checkout does not reject live secret keys');
must(lib,"headers['stripe-account']=account",'direct charge connected-account header missing');
must(lib,"/^\\d{4}-\\d{2}-\\d{2}\\.[a-z][a-z0-9_-]*$/",'Accounts v2 named API versions are rejected');
must(webhook,'verifyStripeSignature','webhook signature is not verified');
must(webhook,"event.livemode!==false",'live webhook is not rejected');
must(refund,'confirmed:false','refund response could claim provider confirmation prematurely');
must(lib,'timingSafeEqual','webhook signature comparison is not timing safe');
must(orders,"db.rpc('get_market_payment_sandbox_status')",'order UI does not check the database sandbox switch');
must(orders,"fetch('/api/market-stripe-checkout'",'order UI is not wired to the authenticated Stripe checkout API');
must(orders,'authorization:`Bearer ${session.access_token}`','order UI does not authenticate the test buyer');
must(orders,"target.hostname!=='checkout.stripe.com'",'order UI does not restrict the redirect to Stripe Checkout');
must(orders,"result.live_mode!==false",'order UI does not reject a live-mode checkout response');
must(orders,"sessionStorage.getItem(key)",'order UI does not preserve its checkout idempotency key');
must(orders,"['not_required','failed'].includes(o.payment_status)",'pending payments can incorrectly start again');
must(orders,'STRIPE-TESTZAHLUNG WIRD GEPRÜFT','pending payment status is not explained');
must(trade,'trade-orders.js?v=1.5','Stripe sandbox order UI cache version is not loaded');
must(workflow,'market-stripe-connect-contract-test.mjs','Step 9 contract test missing from CI');
must(workflow,'node --check api/market-stripe-onboarding.js','onboarding syntax is not checked in CI');

const digestPatch=await read('database/pgcrypto-digest-schema-hardening-v1.sql');
for(const signature of ['apply_market_stripe_event','issue_market_financial_document','get_marketplace_notice_status','submit_marketplace_listing_notice','submit_marketplace_notice_appeal'])must(digestPatch,signature,'staging pgcrypto patch misses '+signature);
const functionBlock=(source,name)=>{
  const begin=source.indexOf('create or replace function public.'+name+'(');
  assert.notEqual(begin,-1,'missing function '+name);
  const finish=source.indexOf('\n$$;',begin);
  assert.notEqual(finish,-1,'unterminated function '+name);
  return source.slice(begin,finish+4);
};
must(functionBlock(sql,'apply_market_stripe_event'),'set search_path=pg_catalog,public,dv_market_private,extensions','payment webhook cannot resolve Supabase pgcrypto schema');
const orderingBlock=functionBlock(ordering,'apply_market_stripe_event');
for(const guard of ['checkout_state_preserved','payment_already_confirmed','post_payment_state_preserved','refund_already_confirmed','stripe_checkout_session_mismatch','stripe_payment_intent_mismatch','stripe_charge_mismatch'])
  must(orderingBlock,guard,'event-ordering migration misses '+guard);
must(ordering,'revoke all on function public.apply_market_stripe_event(text,text,text,boolean,text,text,timestamptz,jsonb) from public, anon, authenticated','event-ordering migration exposes webhook RPC');
must(ordering,'grant execute on function public.apply_market_stripe_event(text,text,text,boolean,text,text,timestamptz,jsonb) to service_role','event-ordering migration does not restore backend access');
must(functionBlock(sql,'issue_market_financial_document'),'set search_path=pg_catalog,dv_market_private,extensions','financial document function cannot resolve Supabase pgcrypto schema');
for(const fn of ['get_marketplace_notice_status','submit_marketplace_listing_notice','submit_marketplace_notice_appeal'])must(functionBlock(notice,fn),'set search_path = pg_catalog, public, dv_market_private, extensions','notice function cannot resolve Supabase pgcrypto schema: '+fn);

console.log('PASS: Stripe Connect stays test-only, backend-bound and financially truthful');
