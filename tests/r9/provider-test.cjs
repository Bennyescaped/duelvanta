'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const path=require('node:path'),root=path.resolve(__dirname,'../..');
const API=require(path.join(root,'api/tcg-magic-scryfall.js'));
globalThis.fetch=()=>{throw Error('REAL_NETWORK_FORBIDDEN');};
const user='84000000-0000-4000-8000-000000000003',other='84000000-0000-4000-8000-000000000004';
const contract='magic-on-demand-collect-beta/1',url='/api/tcg-magic-scryfall?set_code=m21&collector_number=1&language=EN';
const report={passed:false,cases:[],provider_live_requests:0};
const res=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},status(v){this.code=v;return this;},json(v){this.body=v;return this;}});
(async()=>{try{
for(const scenario of ['missing','invalid','forged','user_metadata','anonymous','unverified','auth_error','db_error','non_tester','beta_off','restricted','security_drift','revoked','expired','wrong_subject','stale_receipt','replayed_receipt','valid_no_live_approval','fake_live_header','service_key']){
 let transports=0,authCalls=0,dbCalls=0;const observed=[];
 const mockFetch=async(u,o)=>{observed.push({path:new URL(u).pathname,bearer:o.headers.Authorization});
  if(u.endsWith('/auth/v1/user')){authCalls++;if(['invalid','forged','auth_error'].includes(scenario))return {status:401,json:async()=>({})};return {status:200,json:async()=>({id:user,email_confirmed_at:scenario==='unverified'?null:'2026-01-01T00:00:00Z',is_anonymous:scenario==='anonymous',user_metadata:{tester:true}})};}
  dbCalls++;if(scenario==='db_error')throw Error('DB_UNAVAILABLE');
  return {status:200,json:async()=>({contract,user_id:scenario==='wrong_subject'?other:user,checked_at:new Date(Date.now()-(scenario==='stale_receipt'?120000:0)).toISOString(),magic_on_demand_collection_beta:!['user_metadata','non_tester','beta_off','restricted','security_drift','revoked','expired','replayed_receipt'].includes(scenario)})};
 };
 const authorize=API.createAuthorizer({url:'https://auth.fixture.invalid',publishableKey:scenario==='service_key'?'sb_secret_FORBIDDEN':'sb_publishable_SYNTHETIC',fetch:mockFetch});
 const h=API.createHandler({authorize,transport:async()=>{transports++;throw Error('NO_PROVIDER_APPROVAL');}}),r=res();
 const headers=scenario==='missing'?{}:{authorization:'Bearer '+(scenario==='invalid'?'invalid':'synthetic-token'),'x-magic-tester':'true','x-provider-live':'true','x-user-id':other};
 await h({method:'GET',url,headers},r);assert.equal(transports,0);assert.ok([401,403,503].includes(r.code));assert.doesNotMatch(JSON.stringify(r.body),/84000000|revoked|restricted|tester|admission|security_drift|DB_UNAVAILABLE/);
 if(dbCalls)assert.ok(observed.every(x=>x.bearer===headers.authorization));
 report.cases.push({scenario,status:'PASS',http_status:r.code,authCalls,dbCalls,transport_calls:transports,caller_token_bound:dbCalls>0});
}
// Only the explicit mock factory admits an injected mock transport.
let transports=0;const h=API.createMockHandler({authorize:async token=>token==='synthetic-token'?{userId:user}:null,transport:async()=>{transports++;throw new API.LookupError('no_match',404);}}),r=res();
await h({method:'GET',url,headers:{authorization:'Bearer synthetic-token'}},r);assert.equal(r.code,404);assert.equal(transports,1);report.cases.push({scenario:'explicit_mock_positive',status:'PASS',mock_transport_calls:1,provider_live_requests:0});
report.passed=true;
}catch(e){report.error={message:e.message,stack:e.stack};process.exitCode=1;}finally{fs.writeFileSync(path.join(root,'test-results/tcg-i3-m6-r9/provider-mocks.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));}})();
