import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const handler=require('../api/compliance-message-dispatch.js');

const response=()=>({statusCode:0,body:null,status(code){this.statusCode=code;return this},json(body){this.body=body;return this}});
const originalFetch=global.fetch;
const originalEnv={...process.env};
try{
  delete process.env.COMPLIANCE_EMAIL_DELIVERY_ENABLED;
  let calls=0;global.fetch=async()=>{calls++;throw Error('network forbidden')};
  const disabled=response();await handler({method:'POST',headers:{}},disabled);
  assert.deepEqual(disabled.body,{status:'disabled',claimed:0,sent:0,failed:0});assert.equal(calls,0);

  Object.assign(process.env,{COMPLIANCE_EMAIL_DELIVERY_ENABLED:'true',COMPLIANCE_DISPATCH_SECRET:'test-dispatch-secret',SUPABASE_URL:'https://example.supabase.test',SUPABASE_SERVICE_ROLE_KEY:'test-service-role',RESEND_API_KEY:'test-resend-key',COMPLIANCE_EMAIL_FROM:'DUELVANTA <no-reply@example.test>'});
  const unauthorized=response();await handler({method:'POST',headers:{authorization:'Bearer wrong'}},unauthorized);assert.equal(unauthorized.statusCode,401);assert.equal(calls,0);
  const requests=[];global.fetch=async(url,options)=>{requests.push({url,options});if(String(url).includes('claim_marketplace_message_delivery'))return new Response(JSON.stringify([{message_id:'message-1',message_kind:'order_confirmation',recipient_email:'buyer@example.test',payload:{order_number:'DV-TEST'},confirmation_text:'DUELVANTA BESTELLBESTÄTIGUNG',idempotency_key:'order_confirmation:snapshot-1',delivery_lock_token:'lock-1',attempt:1}]),{status:200});if(String(url).includes('api.resend.com'))return new Response(JSON.stringify({id:'provider-1'}),{status:200});return new Response('',{status:200});};
  const sent=response();await handler({method:'POST',headers:{authorization:'Bearer test-dispatch-secret'}},sent);
  assert.deepEqual(sent.body,{status:'processed',claimed:1,sent:1,failed:0});
  assert.equal(requests.length,3);assert.equal(requests[1].options.headers['idempotency-key'],'order_confirmation:snapshot-1');
  const finish=JSON.parse(requests[2].options.body);assert.equal(finish.p_success,true);assert.equal(finish.p_provider_message_id,'provider-1');
  assert.equal(handler.renderMessage({message_kind:'notice_received',payload:{case_reference:'DVN-TEST'}}).subject.includes('DVN-TEST'),true);
  console.log('PASS: dispatcher stays disabled by default, requires auth and records an idempotent mocked delivery');
}finally{
  global.fetch=originalFetch;
  for(const key of Object.keys(process.env))if(!(key in originalEnv))delete process.env[key];
  Object.assign(process.env,originalEnv);
}
