import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{createHandler}=require('../benchmark/scanner-pilot/recognize-server.cjs');
const env={VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'scanner-v16',XIMILAR_API_TOKEN:'TEST_ONLY_NEVER_REAL'},config={enabled:true};
const user='00000000-0000-4000-8000-000000000001',requestId='00000000-0000-4000-8000-000000000002';
const body={imageBase64:Buffer.from([255,216,255,1,2,3]).toString('base64'),requestId,tcg:'one_piece'};
const req=(method='POST',b=body)=>({method,headers:{authorization:'Bearer verified-test-token','content-type':'application/json'},body:b});
async function invoke(handler,request=req()){const res={headers:{},setHeader(k,v){this.headers[k]=v},status(n){this.statusCode=n;return this},json(data){this.body=data;return this}};await handler(request,res);return res}
let paid=0,remaining=2,authOk=true,rpcAvailable=true,providerFails=false;
const reservations=new Set(),events=[];
const fetchImpl=async(url,options)=>{
  assert.equal(options.headers.apikey.startsWith('sb_publishable_'),true);assert.equal(options.headers.Authorization,'Bearer verified-test-token');
  assert.equal(options.redirect,'error');
  if(url.endsWith('/auth/v1/user'))return{ok:authOk,status:authOk?200:401,json:async()=>({id:user})};
  if(!rpcAvailable)throw new Error('private connection details must not escape');
  if(url.endsWith('/dv_v16_scan_budget'))return{ok:true,json:async()=>({enabled:true,remaining})};
  assert.ok(url.endsWith('/dv_v16_reserve_scan'));
  const b=JSON.parse(options.body);assert.deepEqual(Object.keys(b).sort(),['p_image_sha256','p_kind','p_request_id','p_tcg']);assert.equal(b.p_tcg,'one_piece');assert.ok(['raw','slab'].includes(b.p_kind));assert.match(b.p_image_sha256,/^[a-f0-9]{64}$/);
  // Models the database's committed, shared atomic reservation, including different function instances.
  let result;if(reservations.has(b.p_image_sha256)||reservations.has(b.p_request_id))result={allowed:false,reason:'duplicate'};
  else if(!remaining)result={allowed:false,reason:'limit'};
  else{reservations.add(b.p_image_sha256);reservations.add(b.p_request_id);remaining--;events.push('reserved');result={allowed:true,remaining}}
  return{ok:true,json:async()=>result};
};
const callProvider=async({image,tcg})=>{assert.equal(events.at(-1),'reserved');assert.equal(tcg,'one_piece');assert.equal(image[0],255);paid++;events.push('paid');if(providerFails)throw Object.assign(new Error('secret vendor details'),{status:504,code:'provider_timeout_or_network'});return{model:'ximilar-collectibles-v2-tcg-id',observed:{tcg,printed_code:'OP17-043'},raw:{private:'removed'}}};
const make=(extra={})=>createHandler({env,config,fetchImpl,callProvider,...extra});
assert.equal((await invoke(make({config:{enabled:false}}),req('GET'))).body.active,false);
assert.equal((await invoke(make({config:{enabled:false}}))).statusCode,403);
assert.equal((await invoke(make({env:{...env,VERCEL_ENV:'production'}}))).statusCode,404);
assert.equal((await invoke(make(),{...req(),headers:{}})).statusCode,401);
authOk=false;assert.equal((await invoke(make())).statusCode,401);authOk=true;
assert.equal((await invoke(make(),req('POST',{...body,tcg:'yugioh'}))).statusCode,400);
assert.equal((await invoke(make(),req('POST',{...body,imageBase64:'not an image'}))).statusCode,400);
assert.equal((await invoke(make(),req('POST',{...body,remaining:100}))).statusCode,400);
rpcAvailable=false;assert.equal((await invoke(make())).statusCode,503);rpcAvailable=true;assert.equal(paid,0);
const concurrent=await Promise.all([invoke(make()),invoke(make())]);assert.deepEqual(concurrent.map(r=>r.statusCode).sort(),[200,409]);assert.equal(paid,1);assert.equal(remaining,1);
const result=concurrent.find(r=>r.statusCode===200).body;assert.equal(result.raw,undefined);assert.equal(result.selectedTcg,'one_piece');assert.match(result.sha256,/^[a-f0-9]{64}$/);
assert.equal((await invoke(make(),req('POST',{...body,requestId:'00000000-0000-4000-8000-000000000003'}))).statusCode,409,'same image must not charge again after a cold start');
const other={...body,requestId:'00000000-0000-4000-8000-000000000004',imageBase64:Buffer.from([255,216,255,2,3,4]).toString('base64')};
providerFails=true;const failed=await invoke(make(),req('POST',other));assert.equal(failed.statusCode,504);assert.equal(failed.body.retryAutomatically,false);assert.equal(JSON.stringify(failed.body).includes('secret'),false);assert.equal(remaining,0);assert.equal(paid,2);
assert.equal((await invoke(make(),req('POST',other))).statusCode,409);assert.equal(paid,2);
const exhausted=await invoke(make(),req('POST',{...other,requestId:'00000000-0000-4000-8000-000000000005',imageBase64:Buffer.from([255,216,255,3,4,5]).toString('base64')}));assert.equal(exhausted.statusCode,429);assert.equal(paid,2);
assert.equal((await invoke(make(),req('GET'))).body.remaining,0);
console.log('PASS: verified existing Auth, closed preview gate, validation, committed quota before provider, concurrent/cold-start duplicate prevention, exhausted/missing ledger and provider failure; zero real API calls');

// Route slab requests only to the dedicated, reserved 15-credit endpoint.
let slabCalls=0;remaining=1;providerFails=false;
const slabHandler=make({callSlabProvider:async()=>{slabCalls++;return{model:'ximilar-collectibles-v2-slab-id',slab:{company:'PSA'}}}});
const slabResult=await invoke(slabHandler,req('POST',{...body,kind:'slab',requestId:'00000000-0000-4000-8000-000000000006',imageBase64:Buffer.from([255,216,255,6,7,8]).toString('base64')}));
assert.equal(slabResult.statusCode,200);assert.equal(slabResult.body.kind,'slab');assert.equal(slabCalls,1);assert.equal(paid,2);
assert.equal((await invoke(slabHandler,req('POST',{...body,kind:'grade'}))).statusCode,400);assert.equal(slabCalls,1);
