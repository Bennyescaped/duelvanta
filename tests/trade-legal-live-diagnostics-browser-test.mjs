// Preview-only live diagnostics in real Chromium; synthetic authenticated session and REST denials only.
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';

const diagnostics=await readFile(new URL('../trade-legal-live-diagnostics.js',import.meta.url),'utf8');
const out=new URL('../test-results/trade-legal-live-diagnostics/',import.meta.url);
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const results=[];

async function basePage({session=true,restStatus=406,restCode='PGRST106'}={}){
  const context=await browser.newContext({viewport:{width:390,height:844}});
  const page=await context.newPage();
  const probes=[];
  await context.route('http://diag.test/**',route=>route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><html><head><meta charset="utf-8"></head><body><section class="hero"></section><main id="app"></main></body></html>'}));
  await context.route('https://staging.example.test/rest/v1/**',async route=>{
    const request=route.request();
    probes.push({
      url:request.url(),
      method:request.method(),
      acceptProfile:request.headers()['accept-profile']||null
    });
    if(restStatus>=200&&restStatus<300)return route.fulfill({status:restStatus,contentType:'application/json',body:'[{"id":"private-row-must-not-be-rendered"}]'});
    return route.fulfill({status:restStatus,contentType:'application/json',body:JSON.stringify({code:restCode,message:'denied fixture'})});
  });
  await page.goto('http://diag.test/trade.html?dv_legal_diag=1');
  await page.evaluate(({session})=>{
    window.DV_SUPABASE={environment:'preview',url:'https://staging.example.test',key:'anon-public-fixture'};
    window.__dvAppDb={auth:{getSession:async()=>({data:{session:session?{access_token:'fixture-token-never-rendered',user:{id:'fixture-user'}}:null}})}};
    window.__DV_TRADE_LEGAL_TRACE=[
      {seq:1,source:'guard',phase:'installed',guard_version:'1.2',schema_revision:'trade-legal-contract-model-v1.2'},
      {seq:2,source:'guard',phase:'state',state:'checking',available:false},
      {seq:3,source:'loader',phase:'release-start',environment:'preview'},
      {seq:4,source:'loader',phase:'release-state',state:'internal-preview',environment:'preview'},
      {seq:5,source:'guard',phase:'probe-start',rpc:'get_market_legal_schema_readiness_v1',method:'GET'},
      {seq:6,source:'guard',phase:'probe-result',compatible:true,revision:'trade-legal-contract-model-v1.2'},
      {seq:7,source:'guard',phase:'state',state:'schema-compatible',available:true},
      {seq:8,source:'loader',phase:'guard-settled',guard_state:'schema-compatible',available:true},
      {seq:9,source:'loader',phase:'loader-start',guard_state:'schema-compatible'},
      {seq:10,source:'loader',phase:'loader-loaded',script_count:23},
      {seq:11,source:'loader',phase:'runtime-ready',release_state:'internal-preview'}
    ];
  },{session});
  await page.addScriptTag({content:diagnostics});
  return{context,page,probes};
}

try{
  {
    const {context,page,probes}=await basePage({});
    await page.waitForFunction(()=>document.getElementById('dvLegalDiagOverall')?.textContent.includes('PASS'));
    const text=await page.locator('#dvLegalLiveDiagnostics').innerText();
    assert.match(text,/GESAMT: PASS/);
    assert.match(text,/Browser-Session: PASS/);
    assert.match(text,/Guard\/RPC\/Loader: PASS/);
    assert.match(text,/GET get_market_legal_schema_readiness_v1 · compatible=true · revision=trade-legal-contract-model-v1\.2/);
    for(const table of ['market_contract_snapshots','market_withdrawal_drafts','market_withdrawals','marketplace_message_outbox'])assert.match(text,new RegExp(table+'.*PASS.*HTTP_406/PGRST106'));
    assert.equal(probes.length,4);
    assert.ok(probes.every(call=>call.method==='GET'&&call.acceptProfile==='dv_market_private'));
    assert.doesNotMatch(text,/fixture-token-never-rendered|private-row-must-not-be-rendered|fixture-user|anon-public-fixture/);
    results.push({mode:'preview-authenticated-denied',status:'PASS',probes:probes.length});
    await context.close();
  }
  {
    const {context,page,probes}=await basePage({session:false});
    await page.waitForFunction(()=>document.getElementById('dvLegalDiagOverall')?.textContent.includes('BLOCKIERT'));
    assert.equal(probes.length,0);
    results.push({mode:'preview-no-session',status:'PASS'});
    await context.close();
  }
  {
    const {context,page}=await basePage({restStatus:200,restCode:''});
    await page.waitForFunction(()=>document.getElementById('dvLegalDiagOverall')?.textContent.includes('FAIL'));
    const text=await page.locator('#dvLegalLiveDiagnostics').innerText();
    assert.match(text,/ACCESS_ALLOWED/);
    assert.doesNotMatch(text,/private-row-must-not-be-rendered/);
    results.push({mode:'unexpected-private-access-fails-closed',status:'PASS'});
    await context.close();
  }
  {
    const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();
    await context.route('http://diag.test/**',route=>route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><html><body><section class="hero"></section><main id="app"></main></body></html>'}));
    await page.goto('http://diag.test/trade.html?dv_legal_diag=1');
    await page.evaluate(()=>{window.DV_SUPABASE={environment:'production'}});
    await page.addScriptTag({content:diagnostics});
    await page.waitForTimeout(100);
    assert.equal(await page.locator('#dvLegalLiveDiagnostics').count(),0);
    results.push({mode:'production-disabled',status:'PASS'});
    await context.close();
  }
  await writeFile(new URL('browser-results.json',out),JSON.stringify({scope:'preview-only direct authenticated REST GET denial + guard/loader ordering; no live data',results},null,2)+'\n');
  console.log('PASS: diagnostics v1.1 proves direct private REST denial and guard settlement before loader without exposing tokens or private data');
}finally{await browser.close()}
