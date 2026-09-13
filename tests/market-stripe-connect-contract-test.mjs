import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=name=>readFile(new URL('../'+name,import.meta.url),'utf8');
const [sql,lib,checkout,webhook,refund,workflow]=await Promise.all([
  'database/market-stripe-connect-sandbox-v1.sql','api/market-stripe-lib.js','api/market-stripe-checkout.js',
  'api/market-stripe-webhook.js','api/market-stripe-refund.js','.github/workflows/scanner-v16-check.yml'
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
assert.ok(!/grant execute on function public\.(prepare_market_stripe_payment|apply_market_stripe_event|prepare_market_stripe_full_refund)[^;]+authenticated/.test(sql),'browser role received payment backend authority');
for(const source of [lib,checkout,webhook,refund])assert.ok(!source.includes('sk_test_123')&&!source.includes('whsec_123'),'secret-looking test value committed');
must(checkout,"STRIPE_CONNECT_SANDBOX_ENABLED!=='true'",'checkout is not default-off');
must(checkout,"startsWith('sk_test_')",'checkout does not reject live secret keys');
must(lib,"headers['stripe-account']=account",'direct charge connected-account header missing');
must(webhook,'verifyStripeSignature','webhook signature is not verified');
must(webhook,"event.livemode!==false",'live webhook is not rejected');
must(refund,'confirmed:false','refund response could claim provider confirmation prematurely');
must(lib,'timingSafeEqual','webhook signature comparison is not timing safe');
must(workflow,'market-stripe-connect-contract-test.mjs','Step 9 contract test missing from CI');
console.log('PASS: Stripe Connect stays test-only, backend-bound and financially truthful');
