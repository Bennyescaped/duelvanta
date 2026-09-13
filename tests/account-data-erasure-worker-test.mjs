import assert from 'node:assert/strict';import{createRequire}from'node:module';const require=createRequire(import.meta.url);const handler=require('../api/account-data-erasure.js');
const response=()=>({statusCode:0,body:null,status(code){this.statusCode=code;return this},json(body){this.body=body;return this}}),originalFetch=global.fetch,originalEnv={...process.env};
try{
  delete process.env.ACCOUNT_DATA_ERASURE_ENABLED;let calls=0;global.fetch=async()=>{calls++;throw Error('network forbidden')};
  const disabled=response();await handler({method:'POST',headers:{}},disabled);assert.deepEqual(disabled.body,{status:'disabled',claimed:0,completed:0,failed:0});assert.equal(calls,0);
  Object.assign(process.env,{ACCOUNT_DATA_ERASURE_ENABLED:'true',ACCOUNT_DATA_ERASURE_SECRET:'worker-secret',SUPABASE_URL:'https://example.supabase.test',SUPABASE_SERVICE_ROLE_KEY:'service-test'});
  const unauthorized=response();await handler({method:'POST',headers:{authorization:'Bearer wrong'}},unauthorized);assert.equal(unauthorized.statusCode,401);assert.equal(calls,0);
  const requests=[];global.fetch=async(url,options)=>{requests.push({url:String(url),options});if(String(url).includes('claim_account_deletion_requests'))return new Response(JSON.stringify([{request_id:'r1',user_id:'u1',storage_manifest:[{bucket:'collection-cards',path:'u1/card.webp'}],delivery_lock_token:'l1'}]),{status:200});if(String(url).includes('prepare_account_deletion_data'))return new Response(JSON.stringify({auth_action:'delete'}),{status:200});return new Response('',{status:200})};
  const processed=response();await handler({method:'POST',headers:{authorization:'Bearer worker-secret'}},processed);assert.deepEqual(processed.body,{status:'processed',claimed:1,completed:1,failed:0});
  assert.ok(requests.some(item=>item.url.includes('/storage/v1/object/collection-cards/u1/card.webp')&&item.options.method==='DELETE'));
  assert.ok(requests.some(item=>item.url.endsWith('/auth/v1/admin/users/u1')&&item.options.method==='DELETE'));
  assert.ok(requests.some(item=>item.url.includes('finish_account_deletion_request')));
  console.log('PASS: erasure worker is disabled by default and performs mocked storage/auth cleanup with audit completion');
}finally{global.fetch=originalFetch;for(const key of Object.keys(process.env))if(!(key in originalEnv))delete process.env[key];Object.assign(process.env,originalEnv)}
