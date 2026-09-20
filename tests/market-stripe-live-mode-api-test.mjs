import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const checkout=require('../api/market-stripe-checkout.js');
const onboarding=require('../api/market-stripe-onboarding.js');
const refund=require('../api/market-stripe-refund.js');
const webhook=require('../api/market-stripe-webhook.js');
const response=()=>({statusCode:0,body:null,status(code){this.statusCode=code;return this},json(body){this.body=body;return this}});
const originalFetch=global.fetch,originalEnv={...process.env};
const UUID='90000000-0000-4000-8000-000000000001',USER='90000000-0000-4000-8000-000000000002';
const baseEnv={SUPABASE_URL:'https://xhmjxrcskfhbovhitdej.supabase.co',SUPABASE_ANON_KEY:'anon-test',SUPABASE_SERVICE_ROLE_KEY:'service-test',
  STRIPE_SECRET_KEY:'sk_live_mock_only',STRIPE_WEBHOOK_SECRET:'whsec_live_mock_only',STRIPE_REFUND_WORKER_SECRET:'refund-worker-test',
  STRIPE_ACCOUNTS_V2_VERSION:'2026-08-26.dahlia',DUELVANTA_PUBLIC_ORIGIN:'https://review.example.test'};
try{
  Object.assign(process.env,baseEnv);
  for(const name of ['STRIPE_CONNECT_SANDBOX_ENABLED','STRIPE_CONNECT_LIVE_ENABLED','STRIPE_CONNECT_LIVE_PAYMENTS_ENABLED','STRIPE_CONNECT_LIVE_WEBHOOKS_ENABLED','STRIPE_CONNECT_LIVE_ONBOARDING_ENABLED','STRIPE_CONNECT_LIVE_REFUNDS_ENABLED'])delete process.env[name];
  let calls=0;global.fetch=async()=>{calls++;throw new Error('must_not_call')};

  const keyOnly=response();await checkout({method:'POST',headers:{},body:{}},keyOnly);
  assert.equal(keyOnly.statusCode,409);assert.equal(keyOnly.body.error,'stripe_sandbox_disabled');assert.equal(calls,0,'live key alone must not call any service');

  process.env.STRIPE_CONNECT_LIVE_ENABLED='true';
  const masterOnly=response();await checkout({method:'POST',headers:{},body:{}},masterOnly);
  assert.equal(masterOnly.statusCode,503);assert.equal(masterOnly.body.error,'stripe_live_payments_disabled');assert.equal(calls,0);

  const onboardingOff=response();await onboarding({method:'POST',headers:{},body:{}},onboardingOff);
  assert.equal(onboardingOff.statusCode,503);assert.equal(onboardingOff.body.error,'stripe_live_onboarding_disabled');assert.equal(calls,0);
  const refundOff=response();await refund({method:'POST',headers:{authorization:'Bearer refund-worker-test'},body:{}},refundOff);
  assert.equal(refundOff.statusCode,503);assert.equal(refundOff.body.error,'stripe_live_refunds_disabled');assert.equal(calls,0);

  process.env.STRIPE_CONNECT_LIVE_PAYMENTS_ENABLED='true';
  process.env.STRIPE_SECRET_KEY='sk_test_wrong_mode';
  const wrongKey=response();await checkout({method:'POST',headers:{},body:{}},wrongKey);
  assert.equal(wrongKey.statusCode,503);assert.equal(wrongKey.body.error,'stripe_live_key_required');assert.equal(calls,0);
  process.env.STRIPE_SECRET_KEY='sk_live_mock_only';

  let providerCalls=0;
  global.fetch=async(url,options={})=>{
    calls++;const target=String(url);
    if(target.endsWith('/auth/v1/user'))return new Response(JSON.stringify({id:USER}),{status:200});
    if(target.includes('prepare_market_stripe_payment'))return new Response(JSON.stringify({attempt_id:UUID,stripe_account_id:'acct_LiveSeller',amount_due_cents:10500,platform_fee_cents:250,live_mode:true}),{status:200});
    if(target.includes('api.stripe.com/v1/checkout/sessions')){providerCalls++;return new Response(JSON.stringify({id:'cs_live_TestSession',url:'https://checkout.stripe.com/c/pay/live'}),{status:200})}
    if(target.includes('bind_market_stripe_checkout_session'))return new Response('',{status:200});
    throw new Error('unexpected_fetch_'+target);
  };
  const liveCheckout=response();await checkout({method:'POST',headers:{authorization:'Bearer buyer-token'},body:{order_id:UUID,request_key:UUID}},liveCheckout);
  assert.equal(liveCheckout.statusCode,200);assert.equal(liveCheckout.body.live_mode,true);assert.equal(liveCheckout.body.status,'live_checkout_created');assert.equal(providerCalls,1);

  providerCalls=0;
  global.fetch=async(url)=>{
    const target=String(url);
    if(target.endsWith('/auth/v1/user'))return new Response(JSON.stringify({id:USER}),{status:200});
    if(target.includes('prepare_market_stripe_payment'))return new Response(JSON.stringify({attempt_id:UUID,stripe_account_id:'acct_LiveSeller',amount_due_cents:10500,platform_fee_cents:250,live_mode:false}),{status:200});
    if(target.includes('api.stripe.com'))providerCalls++;
    return new Response('',{status:200});
  };
  const dbMismatch=response();await checkout({method:'POST',headers:{authorization:'Bearer buyer-token'},body:{order_id:UUID,request_key:UUID}},dbMismatch);
  assert.equal(dbMismatch.statusCode,409);assert.equal(dbMismatch.body.error,'stripe_database_mode_mismatch');assert.equal(providerCalls,0,'database mode mismatch must stop before Stripe');

  delete process.env.STRIPE_CONNECT_LIVE_PAYMENTS_ENABLED;
  process.env.STRIPE_CONNECT_LIVE_WEBHOOKS_ENABLED='true';
  const event={id:'evt_LiveEvent',type:'payment_intent.payment_failed',livemode:true,account:'acct_LiveSeller',created:1789308000,
    data:{object:{id:'pi_LiveIntent',amount:10500,currency:'eur',metadata:{duelvanta_attempt_id:UUID}}}};
  const raw=Buffer.from(JSON.stringify(event)),timestamp=Math.floor(Date.now()/1000);
  const sig=crypto.createHmac('sha256',process.env.STRIPE_WEBHOOK_SECRET).update(`${timestamp}.`).update(raw).digest('hex');
  let appliedBody=null;global.fetch=async(url,options={})=>{
    const target=String(url);
    if(target.includes('apply_market_stripe_event')){appliedBody=JSON.parse(options.body);return new Response(JSON.stringify({event_id:event.id,status:'applied'}),{status:200})}
    throw new Error('unexpected_fetch_'+target);
  };
  const liveWebhook=response();await webhook({method:'POST',headers:{'stripe-signature':`t=${timestamp},v1=${sig}`},rawBody:raw},liveWebhook);
  assert.equal(liveWebhook.statusCode,200);assert.equal(liveWebhook.body.live_mode,true);assert.equal(appliedBody.p_live_mode,true);

  process.env.STRIPE_CONNECT_SANDBOX_ENABLED='true';
  const conflict=response();await webhook({method:'POST',headers:{},rawBody:raw},conflict);
  assert.equal(conflict.statusCode,503);assert.equal(conflict.body.error,'stripe_mode_conflict');

  console.log('PASS: Stripe live mode is default-off, action-gated, mode-bound and webhook-independent from new payments');
}finally{
  global.fetch=originalFetch;
  for(const key of Object.keys(process.env))if(!(key in originalEnv))delete process.env[key];
  Object.assign(process.env,originalEnv);
}
