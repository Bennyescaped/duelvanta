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
  const rows=[
    {message_id:'message-1',message_kind:'order_confirmation',recipient_email:'buyer@example.test',payload:{order_number:'DV-TEST'},confirmation_text:'DUELVANTA BESTELLBESTÄTIGUNG',idempotency_key:'order_confirmation:snapshot-1',delivery_lock_token:'lock-1',attempt:1},
    {message_id:'message-2',message_kind:'notice_received',recipient_email:'reporter@example.test',payload:{case_reference:'DVN-RECEIVED'},idempotency_key:'notice_received:case-1',delivery_lock_token:'lock-2',attempt:1},
    {message_id:'message-3',message_kind:'notice_decided',recipient_email:'reporter@example.test',payload:{case_reference:'DVN-DECIDED',action:'Inserat pausiert',reason:'Synthetische Begründung',redress:'Interner Einspruch'},idempotency_key:'notice_decided:case-1',delivery_lock_token:'lock-3',attempt:1},
    {message_id:'message-4',message_kind:'seller_statement_of_reasons',recipient_email:'seller@example.test',payload:{case_reference:'DVN-SELLER',action:'Inserat pausiert',facts:'Synthetischer Sachverhalt',basis_kind:'Vertragsgrundlage',reference:'Regel 1',scope:'Ein Inserat',duration:'Bis zur Prüfung',automated_means_used:false,redress:'Interner Einspruch'},idempotency_key:'seller_statement:case-1',delivery_lock_token:'lock-4',attempt:1},
    {message_id:'message-5',message_kind:'appeal_received',recipient_email:'reporter@example.test',payload:{case_reference:'DVN-APPEAL'},idempotency_key:'appeal_received:case-1',delivery_lock_token:'lock-5',attempt:1},
    {message_id:'message-6',message_kind:'appeal_decided',recipient_email:'reporter@example.test',payload:{case_reference:'DVN-APPEAL',outcome:'Bestätigt',reason:'Synthetische Einspruchsentscheidung'},idempotency_key:'appeal_decided:case-1',delivery_lock_token:'lock-6',attempt:1}
  ];
  const requests=[];global.fetch=async(url,options)=>{requests.push({url,options});if(String(url).includes('claim_marketplace_message_delivery'))return new Response(JSON.stringify(rows),{status:200});if(String(url).includes('api.resend.com'))return new Response(JSON.stringify({id:`provider-${requests.filter(item=>String(item.url).includes('api.resend.com')).length}`}),{status:200});return new Response('',{status:200});};
  const sent=response();await handler({method:'POST',headers:{authorization:'Bearer test-dispatch-secret'}},sent);
  assert.deepEqual(sent.body,{status:'processed',claimed:6,sent:6,failed:0});
  const providerRequests=requests.filter(item=>String(item.url).includes('api.resend.com'));
  const finishRequests=requests.filter(item=>String(item.url).includes('finish_marketplace_message_delivery'));
  assert.equal(requests.length,13);assert.equal(providerRequests.length,6);assert.equal(finishRequests.length,6);
  assert.deepEqual(providerRequests.map(item=>item.options.headers['idempotency-key']),rows.map(row=>row.idempotency_key));
  assert.ok(finishRequests.every(item=>JSON.parse(item.options.body).p_success===true));
  assert.ok(finishRequests.every(item=>String(JSON.parse(item.options.body).p_provider_message_id).startsWith('provider-')));

  const rendered=rows.map(row=>handler.renderMessage(row));
  assert.match(rendered[0].subject,/DV-TEST/);assert.equal(rendered[0].text,'DUELVANTA BESTELLBESTÄTIGUNG');
  assert.match(rendered[1].subject,/DVN-RECEIVED/);assert.match(rendered[1].text,/Zugangscode/);
  assert.match(rendered[2].text,/Synthetische Begründung/);assert.match(rendered[2].text,/Interner Einspruch/);
  assert.match(rendered[3].text,/Synthetischer Sachverhalt/);assert.match(rendered[3].text,/Automatisierte Mittel: Nein/);
  assert.match(rendered[4].text,/menschlich geprüft/);assert.match(rendered[5].text,/Synthetische Einspruchsentscheidung/);
  assert.throws(()=>handler.renderMessage({message_kind:'unknown',payload:{}}),/unsupported_message_kind/);

  const failedRequests=[];global.fetch=async(url,options)=>{failedRequests.push({url,options});if(String(url).includes('claim_marketplace_message_delivery'))return new Response(JSON.stringify([rows[1]]),{status:200});if(String(url).includes('api.resend.com'))return new Response(JSON.stringify({name:'synthetic_provider_failure'}),{status:503});return new Response('',{status:200});};
  const failed=response();await handler({method:'POST',headers:{authorization:'Bearer test-dispatch-secret'}},failed);
  assert.deepEqual(failed.body,{status:'processed',claimed:1,sent:0,failed:1});
  const failedFinish=failedRequests.find(item=>String(item.url).includes('finish_marketplace_message_delivery'));
  assert.ok(failedFinish);const failedBody=JSON.parse(failedFinish.options.body);
  assert.equal(failedBody.p_success,false);assert.equal(failedBody.p_provider_message_id,null);assert.match(failedBody.p_error,/provider_503_synthetic_provider_failure/);
  console.log('PASS: dispatcher stays disabled by default and all compliance messages pass success/failure dry-runs with mocked network');
}finally{
  global.fetch=originalFetch;
  for(const key of Object.keys(process.env))if(!(key in originalEnv))delete process.env[key];
  Object.assign(process.env,originalEnv);
}
