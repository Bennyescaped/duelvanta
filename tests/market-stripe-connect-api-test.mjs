import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const lib=require('../api/market-stripe-lib.js');
const onboarding=require('../api/market-stripe-onboarding.js');
const checkout=require('../api/market-stripe-checkout.js');
const webhook=require('../api/market-stripe-webhook.js');
const refund=require('../api/market-stripe-refund.js');
const response=()=>({statusCode:0,body:null,status(code){this.statusCode=code;return this},json(body){this.body=body;return this}});
const originalFetch=global.fetch,originalEnv={...process.env};
const UUID='90000000-0000-4000-8000-000000000001',USER='90000000-0000-4000-8000-000000000002';
try{
  Object.assign(process.env,{SUPABASE_URL:'https://xhmjxrcskfhbovhitdej.supabase.co',SUPABASE_ANON_KEY:'anon-test',SUPABASE_SERVICE_ROLE_KEY:'service-test',
    STRIPE_SECRET_KEY:'sk_test_mock_only',STRIPE_WEBHOOK_SECRET:'whsec_mock_only',STRIPE_REFUND_WORKER_SECRET:'refund-worker-test',
    STRIPE_ACCOUNTS_V2_VERSION:'2026-08-26.dahlia',DUELVANTA_PUBLIC_ORIGIN:'https://review.example.test'});
  delete process.env.STRIPE_CONNECT_SANDBOX_ENABLED;
  let calls=0;global.fetch=async()=>{calls++;throw new Error('must_not_call')};
  const off=response();await checkout({method:'POST',headers:{},body:{}},off);assert.equal(off.statusCode,409);assert.equal(calls,0);
  process.env.STRIPE_CONNECT_SANDBOX_ENABLED='true';const requests=[];
  global.fetch=async(url,options={})=>{
    requests.push({url:String(url),options});
    if(String(url).endsWith('/auth/v1/user'))return new Response(JSON.stringify({id:USER,email:'seller@example.test'}),{status:200});
    if(String(url).includes('prepare_market_stripe_onboarding'))return new Response(JSON.stringify({onboarding_request_id:UUID,onboarding_state:'prepared',stripe_account_id:null,seller_type:'trader',country_code:'DE'}),{status:200});
    if(String(url).includes('/v2/core/accounts'))return new Response(JSON.stringify({id:'acct_TestSeller',livemode:false}),{status:200});
    if(String(url).includes('register_market_stripe_test_account'))return new Response('',{status:200});
    if(String(url).includes('/v2/core/account_links'))return new Response(JSON.stringify({object:'v2.core.account_link',livemode:false,url:'https://accounts.stripe.com/onboard'}),{status:200});
    if(String(url).includes('mark_market_stripe_onboarding_link_created'))return new Response('',{status:200});
    throw new Error('unexpected_fetch_'+url);
  };
  const onboarded=response();await onboarding({method:'POST',headers:{authorization:'Bearer seller-token'},body:{request_key:UUID}},onboarded);
  assert.equal(onboarded.statusCode,200);assert.equal(onboarded.body.live_mode,false);
  const v2=requests.find(r=>r.url.includes('/v2/core/accounts'));assert.equal(v2.options.headers['stripe-version'],'2026-08-26.dahlia');
  const accountPayload=JSON.parse(v2.options.body);assert.deepEqual(accountPayload.identity,{country:'DE'});assert.equal(accountPayload.dashboard,'full');assert.equal(accountPayload.defaults.responsibilities.losses_collector,'stripe');
  assert.ok(requests.some(r=>r.url.includes('/v2/core/account_links')));
  const retried=response();await onboarding({method:'POST',headers:{authorization:'Bearer seller-token'},body:{request_key:USER}},retried);
  assert.equal(retried.statusCode,200);
  const accountCalls=requests.filter(r=>r.url.includes('/v2/core/accounts'));
  assert.equal(accountCalls.length,2);
  assert.equal(accountCalls[0].options.headers['idempotency-key'],`duelvanta-account-${UUID}`);
  assert.equal(accountCalls[1].options.headers['idempotency-key'],accountCalls[0].options.headers['idempotency-key']);
  const linkCall=requests.find(r=>r.url.includes('/v2/core/account_links'));
  assert.equal(linkCall.options.headers['stripe-version'],'2026-08-26.dahlia');
  assert.deepEqual(JSON.parse(linkCall.options.body).use_case,{type:'account_onboarding',account_onboarding:{configurations:['merchant'],refresh_url:'https://review.example.test/seller-onboarding.html?stripe=refresh',return_url:'https://review.example.test/seller-onboarding.html?stripe=return'}});
  const healthyFetch=global.fetch;
  for(const failures of [1,2]){
    let attempts=0,providerCalls=0;const bodies=[];
    global.fetch=async(url,options)=>{
      if(String(url).includes('prepare_market_stripe_onboarding')){attempts++;bodies.push(options.body);if(attempts<=failures)return new Response('',{status:504})}
      if(String(url).includes('api.stripe.com'))providerCalls++;
      return healthyFetch(url,options);
    };
    const retriedTimeout=response();await onboarding({method:'POST',headers:{authorization:'Bearer seller-token'},body:{request_key:UUID}},retriedTimeout);
    assert.equal(attempts,2);assert.equal(bodies[0],bodies[1]);assert.equal(retriedTimeout.statusCode,failures===1?200:409);
    if(failures===2)assert.equal(providerCalls,0);
  }
  global.fetch=async()=>{throw new Error('configuration_checks_must_not_call_network')};
  const configNames=['SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY','DUELVANTA_PUBLIC_ORIGIN'];
  const savedConfig=Object.fromEntries(configNames.map(name=>[name,process.env[name]]));
  for(const name of configNames)delete process.env[name];
  const configResponse=response();await onboarding({method:'POST',headers:{},body:{}},configResponse);
  assert.equal(configResponse.statusCode,503);assert.deepEqual(configResponse.body.missing,configNames);
  Object.assign(process.env,savedConfig);
  for(const badLink of [
    {object:'v2.core.account_link',livemode:true,url:'https://accounts.stripe.com/onboard'},
    {object:'v2.core.account_link',livemode:false,url:'https://accounts.stripe.com.evil.test/onboard'},
    {object:'account_link',livemode:false,url:'https://accounts.stripe.com/onboard'}
  ]){
    global.fetch=async(url,options)=>String(url).includes('/v2/core/account_links')?new Response(JSON.stringify(badLink),{status:200}):healthyFetch(url,options);
    const bad=response();await onboarding({method:'POST',headers:{authorization:'Bearer seller-token'},body:{request_key:UUID}},bad);
    assert.equal(bad.statusCode,409);assert.equal(bad.body.error,'stripe_account_link_invalid');
  }


  for(const country_code of [undefined,'','Germany','de']){
    let providerCalls=0;
    global.fetch=async url=>{
      if(String(url).endsWith('/auth/v1/user'))return new Response(JSON.stringify({id:USER}),{status:200});
      if(String(url).includes('prepare_market_stripe_onboarding'))return new Response(JSON.stringify({onboarding_request_id:UUID,onboarding_state:'prepared',stripe_account_id:null,seller_type:'private',country_code}),{status:200});
      providerCalls++;throw new Error('must_not_reach_provider');
    };
    const invalidCountry=response();
    await onboarding({method:'POST',headers:{authorization:'Bearer seller-token'},body:{request_key:UUID,country_code:'DE'}},invalidCountry);
    assert.equal(invalidCountry.statusCode,409);assert.equal(invalidCountry.body.error,'seller_country_required');assert.equal(providerCalls,0);
  }

  let completedCalls=0;global.fetch=async url=>{
    completedCalls++;
    if(String(url).endsWith('/auth/v1/user'))return new Response(JSON.stringify({id:USER,email:'seller@example.test'}),{status:200});
    if(String(url).includes('prepare_market_stripe_onboarding'))return new Response(JSON.stringify({onboarding_request_id:UUID,onboarding_state:'completed',stripe_account_id:'acct_TestSeller',seller_type:'trader',country_code:'DE'}),{status:200});
    throw new Error('completed_onboarding_must_not_call_stripe');
  };
  const completed=response();await onboarding({method:'POST',headers:{authorization:'Bearer seller-token'},body:{request_key:UUID}},completed);
  assert.equal(completed.statusCode,200);assert.equal(completed.body.status,'stripe_test_onboarding_complete');assert.equal(completedCalls,2);

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
  const accountUpdated={id:'evt_TestAccountUpdated',type:'account.updated',livemode:false,account:'acct_TestSeller',created:1789308001,
    data:{object:{id:'acct_TestSeller',charges_enabled:false,payouts_enabled:false,details_submitted:true,
      requirements:{currently_due:['business_profile.url'],past_due:['external_account'],disabled_reason:'requirements.past_due'}}}};
  const accountRaw=Buffer.from(JSON.stringify(accountUpdated));
  const accountSig=crypto.createHmac('sha256',process.env.STRIPE_WEBHOOK_SECRET).update(`${timestamp}.`).update(accountRaw).digest('hex');
  const accountResponse=response();await webhook({method:'POST',headers:{'stripe-signature':`t=${timestamp},v1=${accountSig}`},rawBody:accountRaw},accountResponse);
  assert.equal(accountResponse.statusCode,200);
  const accountRpcBody=JSON.parse(requests.at(-1).options.body);assert.equal(accountRpcBody.p_object_id,'acct_TestSeller');
  assert.deepEqual(accountRpcBody.p_data,{attempt_id:null,charges_enabled:false,payouts_enabled:false,details_submitted:true,
    requirements_due_count:1,past_due_count:1,disabled_reason:'requirements.past_due'});
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
