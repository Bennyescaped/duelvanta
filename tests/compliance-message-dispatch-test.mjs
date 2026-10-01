import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const handler=require('../api/compliance-message-dispatch.js');

const response=()=>({statusCode:0,body:null,headers:{},status(code){this.statusCode=code;return this},json(body){this.body=body;return this},send(body){this.body=body;return this},setHeader(name,value){this.headers[name]=value}});
const originalFetch=global.fetch;
const originalEnv={...process.env};
try{
  Object.assign(process.env,{VERCEL_ENV:'development',SUPABASE_URL:'https://xhmjxrcskfhbovhitdej.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test_only',SUPABASE_SERVICE_ROLE_KEY:'test-service-role'});
  let publicCalls=0;
  global.fetch=async(url,options)=>{
    publicCalls++;
    if(String(url).includes('/rpc/get_public_market_listing_v1'))return new Response(JSON.stringify({listing_id:'11111111-1111-4111-8111-111111111111',listing_type:'sale',pricing_mode:'fixed',asking_price:42.5,currency:'EUR',tcg:'pokemon',card_name:'Pikachu <script>bad</script>',set_name:'Base Set',card_number:'58/102',language:'Deutsch',condition:'NM',quantity_available:1}),{status:200});
    if(String(url).includes('/rest/v1/market_listings?'))return new Response(JSON.stringify([{image_path:'cards/example.png'}]),{status:200});
    if(String(url).includes('/storage/v1/object/sign/collection-cards/'))return new Response(JSON.stringify({signedURL:'/storage/v1/object/sign/collection-cards/cards/example.png?token=test'}),{status:200});
    throw Error('unexpected public listing network call');
  };
  const invalid=response();await handler({method:'GET',query:{public_listing:'not-a-uuid'},headers:{host:'preview.example.test'}},invalid);assert.equal(invalid.statusCode,400);assert.equal(publicCalls,0);
  const share=response();await handler({method:'GET',query:{public_listing:'11111111-1111-4111-8111-111111111111'},headers:{host:'preview.example.test'}},share);
  assert.equal(share.statusCode,200);assert.match(share.headers['Content-Type'],/text\/html/);assert.match(share.headers['Content-Security-Policy'],/default-src 'none'/);
  assert.match(share.body,/Pikachu &lt;script&gt;bad&lt;\/script&gt;/);assert.ok(!share.body.includes('<script>bad</script>'));assert.match(share.body,/og:image/);assert.match(share.body,/token=test/);assert.match(share.body,/\/listing\/11111111-1111-4111-8111-111111111111/);assert.ok(!/seller|street|email|phone/i.test(share.body));
  assert.equal(publicCalls,3);

  delete process.env.MARKET_TRACKING_ENABLED;
  let calls=0;global.fetch=async()=>{calls++;throw Error('network forbidden')};
  const trackingDisabled=response();await handler({method:'POST',query:{tracking_register:'1'},headers:{},body:{order_id:'22222222-2222-4222-8222-222222222222'}},trackingDisabled);
  assert.deepEqual(trackingDisabled.body,{status:'disabled'});assert.equal(calls,0);

  Object.assign(process.env,{
    VERCEL_ENV:'preview',
    MARKET_TRACKING_ENABLED:'true',
    SUPABASE_URL:'https://xhmjxrcskfhbovhitdej.supabase.co',
    SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test_only',
    SUPABASE_SERVICE_ROLE_KEY:'test-service-role',
    AFTERSHIP_API_KEY:'test-aftership-key',
    AFTERSHIP_WEBHOOK_SECRET:'test-webhook-secret',
    AFTERSHIP_WEBHOOK_HEADER_SECRET:'test-header-secret'
  });
  const order={id:'22222222-2222-4222-8222-222222222222',order_number:'DV-TRACK-1',seller_id:'33333333-3333-4333-8333-333333333333',fulfillment_group:'shipping',status:'shipped',carrier:'DHL',tracking_code:'00340434161094000000',shipped_at:'2026-09-16T06:00:00.000Z',delivery_evidence_at:null,closure_eligible_at:null};
  const registrationCalls=[];
  global.fetch=async(url,options={})=>{
    registrationCalls.push({url:String(url),options});
    if(String(url).endsWith('/auth/v1/user'))return new Response(JSON.stringify({id:order.seller_id}),{status:200});
    if(String(url).includes('/rest/v1/market_orders?'))return new Response(JSON.stringify([order]),{status:200});
    if(String(url)==='https://api.aftership.com/tracking/2026-07/trackings')return new Response(JSON.stringify({data:{tracking:{id:`duelvanta-${order.id}`}}}),{status:201,headers:{'content-type':'application/json'}});
    throw Error('unexpected tracking registration network call '+url);
  };
  const registered=response();await handler({method:'POST',query:{tracking_register:'1'},headers:{authorization:'Bearer seller-token'},body:{order_id:order.id}},registered);
  assert.equal(registered.statusCode,200);assert.equal(registered.body.status,'registered');assert.equal(registered.body.provider_tracking_id,`duelvanta-${order.id}`);
  const aftershipCreate=registrationCalls.find(x=>x.url==='https://api.aftership.com/tracking/2026-07/trackings');assert.ok(aftershipCreate);
  assert.equal(aftershipCreate.options.headers['as-api-key'],'test-aftership-key');
  const trackingBody=JSON.parse(aftershipCreate.options.body).tracking;
  assert.equal(trackingBody.order_id,order.id);assert.equal(trackingBody.tracking_number,order.tracking_code);assert.equal(trackingBody.language,'de');
  assert.ok(!JSON.stringify(trackingBody).match(/recipient|street|email|phone|buyer/i),'AfterShip payload must not contain personal customer data');

  let webhookFetches=0;global.fetch=async(url,options={})=>{webhookFetches++;throw Error('network should not run')};
  const badWebhook=response();await handler({method:'POST',query:{aftership_webhook:'1'},headers:{'x-duelvanta-tracking-secret':'wrong','as-webhook-version':'2026-07'},body:{}},badWebhook);
  assert.equal(badWebhook.statusCode,401);assert.equal(webhookFetches,0);

  const event={event:'tracking_update',event_id:'44444444-4444-4444-8444-444444444444',msg:{id:`duelvanta-${order.id}`,order_id:order.id,tracking_number:order.tracking_code,slug:'dhl-germany',tag:'Delivered',checkpoints:[{tag:'InTransit',source:'carrier',checkpoint_time:'2026-09-16T07:00:00.000Z',hash:'cp-1'},{tag:'Delivered',source:'carrier',checkpoint_time:'2026-09-16T08:15:00.000Z',hash:'cp-delivered'}]}};
  const raw=JSON.stringify(event),signature=createHmac('sha256','test-webhook-secret').update(raw,'utf8').digest('base64');
  const webhookCalls=[];global.fetch=async(url,options={})=>{
    webhookCalls.push({url:String(url),options});
    if(String(url).includes('/rest/v1/market_orders?'))return new Response(JSON.stringify([order]),{status:200});
    if(String(url).includes('/rest/v1/rpc/record_market_order_delivery_evidence_b07'))return new Response('',{status:200});
    throw Error('unexpected webhook network call '+url);
  };
  const delivered=response();await handler({method:'POST',query:{aftership_webhook:'1'},headers:{'x-duelvanta-tracking-secret':'test-header-secret','as-webhook-version':'2026-07','aftership-hmac-sha256':signature},body:raw},delivered);
  assert.equal(delivered.statusCode,200);assert.equal(delivered.body.status,'delivery_recorded');assert.equal(delivered.body.hmac_verified,true);
  const evidence=webhookCalls.find(x=>x.url.includes('/rpc/record_market_order_delivery_evidence_b07'));assert.ok(evidence);
  const evidenceBody=JSON.parse(evidence.options.body);assert.equal(evidenceBody.p_order_id,order.id);assert.equal(evidenceBody.p_delivered_at,'2026-09-16T08:15:00.000Z');assert.equal(evidenceBody.p_source,'aftership:dhl-germany');assert.match(evidenceBody.p_reference,/44444444-4444-4444-8444-444444444444:cp-delivered/);

  const userCompleted={...event,event_id:'55555555-5555-4555-8555-555555555555',msg:{...event.msg,checkpoints:[{tag:'Delivered',source:'user',checkpoint_time:'2026-09-16T08:20:00.000Z',hash:'manual'}]}};
  const manualRaw=JSON.stringify(userCompleted),manualSig=createHmac('sha256','test-webhook-secret').update(manualRaw,'utf8').digest('base64');
  let manualCalls=0;global.fetch=async()=>{manualCalls++;throw Error('manual completion must not touch database')};
  const manual=response();await handler({method:'POST',query:{aftership_webhook:'1'},headers:{'x-duelvanta-tracking-secret':'test-header-secret','as-webhook-version':'2026-07','aftership-hmac-sha256':manualSig},body:manualRaw},manual);
  assert.deepEqual(manual.body,{status:'ignored',reason:'no_carrier_delivery_checkpoint'});assert.equal(manualCalls,0);

  Object.assign(process.env,{VERCEL_ENV:'development',SUPABASE_URL:'https://xhmjxrcskfhbovhitdej.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test_only',SUPABASE_SERVICE_ROLE_KEY:'test-service-role'});
  delete process.env.MARKET_TRACKING_ENABLED;
  delete process.env.AFTERSHIP_API_KEY;
  delete process.env.AFTERSHIP_WEBHOOK_SECRET;
  delete process.env.AFTERSHIP_WEBHOOK_HEADER_SECRET;
  delete process.env.COMPLIANCE_EMAIL_DELIVERY_ENABLED;
  calls=0;global.fetch=async()=>{calls++;throw Error('network forbidden')};
  const disabled=response();await handler({method:'POST',headers:{}},disabled);
  assert.deepEqual(disabled.body,{status:'disabled',claimed:0,sent:0,failed:0});assert.equal(calls,0);
  const withdrawalReceipt=handler.renderMessage({message_kind:'withdrawal_receipt',payload:{submitted_at:'2026-09-22T18:00:00Z',order_id:'order-1',contract_snapshot_id:'contract-1',product_title:'Testkarte',evidence_sha256:'abc123',declaration_text:'Widerrufserklärung'}});
  const withdrawalNotice=handler.renderMessage({message_kind:'withdrawal_notice',payload:{submitted_at:'2026-09-22T18:00:00Z',order_id:'order-1',contract_snapshot_id:'contract-1',product_title:'Testkarte',evidence_sha256:'abc123',declaration_text:'Widerrufserklärung'}});
  assert.match(withdrawalReceipt.text,/Nachweis-SHA256: abc123/);assert.match(withdrawalNotice.text,/Nachweis-SHA256: abc123/);
  assert.match(withdrawalNotice.text,/Storno, Rücksendung und Erstattung werden technisch getrennt bearbeitet/);


  Object.assign(process.env,{COMPLIANCE_EMAIL_DELIVERY_ENABLED:'true',COMPLIANCE_DISPATCH_SECRET:'test-dispatch-secret',SUPABASE_URL:'https://xhmjxrcskfhbovhitdej.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'test-service-role',RESEND_API_KEY:'test-resend-key',COMPLIANCE_EMAIL_FROM:'DUELVANTA <no-reply@example.test>'});
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
  console.log('PASS: public listing, preview-only AfterShip tracking and compliance dispatcher dry-runs pass');
}finally{
  global.fetch=originalFetch;
  for(const key of Object.keys(process.env))if(!(key in originalEnv))delete process.env[key];
  Object.assign(process.env,originalEnv);
}
