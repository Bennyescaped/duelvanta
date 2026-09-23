// Preview-only live diagnostics contract in real Chromium; fixtures only, no external requests.
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';

const diagnostics=await readFile(new URL('../trade-legal-live-diagnostics.js',import.meta.url),'utf8');
const out=new URL('../test-results/trade-legal-live-diagnostics/',import.meta.url);
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const results=[];

async function openPage({environment='preview',session=true,denyCode='42501'}={}){
  const context=await browser.newContext({viewport:{width:390,height:844}});
  const page=await context.newPage();
  const calls=[];
  await context.route('http://diag.test/**',async route=>{
    await route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><html><head><meta charset="utf-8"></head><body><section class="hero"></section><main id="app"></main></body></html>'});
  });
  await page.goto('http://diag.test/trade.html?dv_legal_diag=1');
  await page.evaluate(({environment,session,denyCode})=>{
    window.DV_SUPABASE={environment,url:'https://staging.example.test',key:'anon-public-fixture'};
    window.__privateCalls=[];
    const client={
      auth:{getSession:async()=>({data:{session:session?{user:{id:'fixture-user'}}:null}})},
      schema(schema){
        return{from(table){
          return{select(columns,options){
            window.__privateCalls.push({schema,table,columns,options});
            return{limit:async()=>({data:null,error:{code:denyCode}})}
          }}
        }}
      }
    };
    window.__dvAppDb=client;
    window.__DV_TRADE_LEGAL_TRACE=[
      {seq:1,source:'guard',phase:'installed',guard_version:'1.2',schema_revision:'trade-legal-contract-model-v1.2'},
      {seq:2,source:'guard',phase:'state',state:'checking',available:false},
      {seq:3,source:'loader',phase:'release-start',environment:'preview'},
      {seq:4,source:'loader',phase:'release-state',state:'internal-preview',environment:'preview'},
      {seq:5,source:'loader',phase:'loader-start',guard_state:'checking'},
      {seq:6,source:'guard',phase:'probe-start',rpc:'get_market_legal_schema_readiness_v1',method:'GET'},
      {seq:7,source:'loader',phase:'loader-loaded',script_count:23},
      {seq:8,source:'loader',phase:'runtime-ready',release_state:'internal-preview'},
      {seq:9,source:'guard',phase:'probe-result',compatible:true,revision:'trade-legal-contract-model-v1.2'},
      {seq:10,source:'guard',phase:'state',state:'schema-compatible',available:true}
    ];
  },{environment,session,denyCode});
  await page.addScriptTag({content:diagnostics});
  return{context,page,calls};
}

try{
  {
    const {context,page}=await openPage({});
    await page.waitForFunction(()=>document.getElementById('dvLegalDiagOverall')?.textContent.includes('PASS'));
    const text=await page.locator('#dvLegalLiveDiagnostics').innerText();
    assert.match(text,/GESAMT: PASS/);
    assert.match(text,/Browser-Session: PASS/);
    assert.match(text,/Guard\/RPC\/Loader: PASS/);
    for(const table of ['market_contract_snapshots','market_withdrawal_drafts','market_withdrawals','marketplace_message_outbox'])assert.match(text,new RegExp(table+'.*PASS'));
    const calls=await page.evaluate(()=>window.__privateCalls);
    assert.equal(calls.length,4);
    assert.ok(calls.every(call=>call.schema==='dv_market_private'&&call.columns==='id'&&call.options?.head===true));
    assert.doesNotMatch(text,/anon-public-fixture|fixture-user/);
    results.push({mode:'preview-authenticated-denied',status:'PASS'});
    await context.close();
  }
  {
    const {context,page}=await openPage({session:false});
    await page.waitForFunction(()=>document.getElementById('dvLegalDiagOverall')?.textContent.includes('BLOCKIERT'));
    assert.equal((await page.evaluate(()=>window.__privateCalls)).length,0);
    results.push({mode:'preview-no-session',status:'PASS'});
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
  await writeFile(new URL('browser-results.json',out),JSON.stringify({scope:'preview-only read-only diagnostics; synthetic session and permission errors',results},null,2)+'\n');
  console.log('PASS: preview-only legal diagnostics exposes guard/loader proof and four denied private HEAD/SELECT probes without secrets or mutations');
}finally{await browser.close()}
