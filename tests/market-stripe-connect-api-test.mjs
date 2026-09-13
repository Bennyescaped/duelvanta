import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const lib=require('../api/market-stripe-lib.js');
const checkout=require('../api/market-stripe-checkout.js');
const webhook=require('../api/market-stripe-webhook.js');
const refund=require('../api/market-stripe-refund.js');
const response=()=>({statusCode:0,body:null,status(code){this.statusCode=code;return this},json(body){this.body=body;return this}});
const originalFetch=global.fetch,originalEnv={...process.env};
const UUID='90000000-0000-4000-8000-000000000001',USER='90000000-0000-4000-8000-000000000002';
try{
  Object.assign(process.env,{SUPABASE_URL:'https://project.example.test',SUPABASE_ANON_KEY:'anon-test',SUPABASE_SERVICE_ROLE_KEY:'service-test',
    STRIPE_SECRET_KEY:'sk_test_mock_only',STRIPE_WEBHOOK_SECRET:'whsec_mock_only',STRIPE_REFUND_WORKER_SECRET:'refund-worker-test',DUELVANTA_PUBLIC_ORIGIN:'https://review.example.test'});
  delete process.env.STRIPE_CONNECT_SANDBOX_ENABLED;
  let calls=0;global.fetch=async()=>{calls++;throw new Error('must_not_call')};
  const off=response();await checkout({method:'POST',headers:{},body:{}},off);assert.equal(off.statusCode,409);assert.equal(calls,0);
  process.env.STRIPE_CONNECT_SANDBOX_ENABLED='true';const requests=[];
  global.fetch=async(url,options={})=>{
    requests.push({url:String(url),options});
    if(String(url).endsWith('/auth/v1/user'))return new Response(JSON.stringify({id:USER}),{status:200});
    if(String(url).includes('prepare_market_stripe_payment'))return new Response(JSON.stringify({attempt_id:UUID,stripe_account_id:'acct_TestSeller',amount_due_cents:10500,platform_fee_cents:250}),{status:200});
    if(String(url).includes('api.stripe.com/v1/checkout/sessions'))return new Response(JSON.stringify({id:'cs_test_TestSession',url:'https://checkout.stripe.test/session'}),{status:200});
    if(String(url).includes('bind_market_stripe_checkout_session'))return new Response('',{status:200});
    throw new Error('unexpected_fetch_'+url);
  };
  const created=response();await checkout({method:'POST',headers:{authorization:'Bearer buyer-token'},body:{order_id:UUID,request_key:UUID}},created);
  assert.equal(created.statusCode,200);assert.equal(created.body.live_mode,false);
  const stripeCall=requests.find(r=>r.url.includes('/checkout/sessions'));assert.equal(stripeCall.options.headers['stripe-account'],'acct_TestSeller');
  assert.match(stripeCall.options.body,/payment_intent_data%5Bapplication_fee_amount%5D=250/);
  const event={id:'evt_TestEvent',type:'payment_intent.succeeded',livemode:false,account:'acct_TestSeller',created:1789308000,
    data:{object:{id:'pi_TestIntent',amount_received:10500,currency:'eur',latest_charge:'ch_TestCharge',metadata:{duelvanta_attempt_id:UUID}}}};
  const raw=Buffer.from(JSON.stringify(event)),timestamp=Math.floor(Date.now()/1000);
  const sig=crypto.createHmac('sha256',process.env.STRIPE_WEBHOOK_SECRET).update(`${timestamp}.`).update(raw).digest('hex');
  global.fetch=async(url,options)=>{requests.push({url:String(url),options});return new Response(JSON.stringify({event_id:event.id,status:'applied'}),{status:200})};
  const rejected=response();await webhook({method:'POST',headers:{'stripe-signature':'t=1,v1=bad'},rawBody:raw},rejected);assert.equal(rejected.statusCode,400);
  const accepted=response();await webhook({method:'POST',headers:{'stripe-signature':`t=${timestamp},v1=${sig}`},rawBody:raw},accepted);
  assert.equal(accepted.statusCode,200);assert.equal(accepted.body.received,true);
  const rpcBody=JSON.parse(requests.at(-1).options.body);assert.equal(rpcBody.p_live_mode,false);assert.equal(rpcBody.p_data.amount_cents,10500);
  assert.equal(lib.verifyStripeSignature(raw,`t=${timestamp},v1=${sig}`,process.env.STRIPE_WEBHOOK_SECRET,timestamp),true);
  global.fetch=async(url)=>{
    if(String(url).includes('prepare_market_stripe_full_refund'))return new Response(JSON.stringify({request_id:UUID,attempt_id:UUID,stripe_account_id:'acct_TestSeller',payment_intent_id:'pi_TestIntent',amount_cents:10500}),{status:200});
    if(String(url).includes('/v1/refunds'))return new Response(JSON.stringify({id:'re_TestRefund',status:'pending'}),{status:200});
    if(String(url).includes('mark_market_stripe_refund_submitted'))return new Response('',{status:200});
    throw new Error('unexpected_fetch_'+url);
  };
  const unauth=response();await refund({method:'POST',headers:{authorization:'Bearer wrong'},body:{}},unauth);assert.equal(unauth.statusCode,401);
  const submitted=response();await refund({method:'POST',headers:{authorization:'Bearer refund-worker-test'},body:{order_id:UUID,request_key:UUID,reason:'Akzeptierte Stornierung'}},submitted);
  assert.equal(submitted.statusCode,202);assert.equal(submitted.body.confirmed,false);
  console.log('PASS: mocked Stripe APIs stay disabled by default, signed and idempotency-bound without provider calls');
}finally{
  global.fetch=originalFetch;
  for(const key of Object.keys(process.env))if(!(key in originalEnv))delete process.env[key];
  Object.assign(process.env,originalEnv);
}
