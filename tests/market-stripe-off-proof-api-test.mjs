import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);

const response=()=>({
  statusCode:200,body:null,
  status(code){this.statusCode=code;return this},
  json(body){this.body=body;return body}
});

const previous={...process.env};
const originalFetch=global.fetch;
let fetchCalls=0;

try{
  global.fetch=async()=>{fetchCalls++;throw new Error('unexpected_fetch')};

  process.env.VERCEL_ENV='preview';
  delete process.env.STRIPE_CONNECT_SANDBOX_ENABLED;
  delete process.env.STRIPE_CONNECT_LIVE_ENABLED;
  process.env.STRIPE_SECRET_KEY='sk_test_fixture_only';

  const proof=require('../api/market-stripe-off-proof.js');

  {
    const res=response();
    await proof({method:'GET',headers:{}},res);
    assert.equal(res.statusCode,200);
    assert.equal(res.body.status,'pass');
    assert.equal(res.body.checkout_status,409);
    assert.equal(res.body.checkout_error,'stripe_sandbox_disabled');
    assert.equal(res.body.provider_call_possible,false);
    assert.equal(fetchCalls,0,'OFF proof must not perform any provider/auth fetch');
  }

  {
    process.env.STRIPE_CONNECT_SANDBOX_ENABLED='true';
    const res=response();
    await proof({method:'GET',headers:{}},res);
    assert.equal(res.statusCode,409);
    assert.equal(res.body.status,'fail');
    assert.equal(res.body.checkout_status,401);
    assert.equal(res.body.checkout_error,'authentication_required');
    assert.equal(fetchCalls,0,'anonymous sandbox-on proof must stop before any provider/auth fetch');
  }

  {
    process.env.VERCEL_ENV='production';
    delete process.env.STRIPE_CONNECT_SANDBOX_ENABLED;
    const res=response();
    await proof({method:'GET',headers:{}},res);
    assert.equal(res.statusCode,404);
    assert.equal(res.body.error,'not_found');
    assert.equal(fetchCalls,0);
  }

  console.log('PASS: preview-only Stripe OFF proof executes the real checkout handler, proves stripe_sandbox_disabled, and cannot reach auth/provider without credentials');
}finally{
  global.fetch=originalFetch;
  for(const key of Object.keys(process.env))if(!(key in previous))delete process.env[key];
  for(const [key,value] of Object.entries(previous))process.env[key]=value;
}
