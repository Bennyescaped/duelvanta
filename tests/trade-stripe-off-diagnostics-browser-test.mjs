// Real Chromium contract for preview-only Stripe sandbox OFF proof.
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';

const source=await readFile(new URL('../trade-stripe-off-diagnostics.js',import.meta.url),'utf8');
const out=new URL('../test-results/trade-stripe-off-diagnostics/',import.meta.url);
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const results=[];

async function runCase({environment='preview',status=409,error='stripe_sandbox_disabled'}={}){
  const context=await browser.newContext({viewport:{width:390,height:844}});
  const page=await context.newPage();
  const requests=[];
  await context.route('http://diag.test/**',async route=>{
    if(route.request().url().includes('/api/market-stripe-checkout')){
      const req=route.request();
      requests.push({method:req.method(),headers:req.headers(),body:req.postData()});
      return route.fulfill({status,contentType:'application/json',body:JSON.stringify({error})});
    }
    return route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><html><body><section class="hero"></section><main id="app"></main></body></html>'});
  });
  await page.goto('http://diag.test/trade.html?dv_stripe_off_diag=1');
  await page.evaluate(({environment})=>{
    window.DV_SUPABASE={environment,url:'https://xhmjxrcskfhbovhitdej.supabase.co',key:'public-fixture'};
  },{environment});
  await page.addScriptTag({content:source});
  return{context,page,requests};
}

try{
  {
    const {context,page,requests}=await runCase({});
    await page.waitForFunction(()=>document.getElementById('dvStripeOffOverall')?.textContent.includes('PASS'));
    const text=await page.locator('#dvStripeOffDiagnostics').innerText();
    assert.match(text,/GESAMT: PASS/);
    assert.match(text,/HTTP: 409/);
    assert.match(text,/stripe_sandbox_disabled/);
    assert.match(text,/Supabase Project: xhmjxrcskfhbovhitdej/);
    assert.equal(requests.length,1);
    assert.equal(requests[0].method,'POST');
    assert.equal(requests[0].body,'{}');
    assert.equal(requests[0].headers.authorization,undefined);
    results.push({mode:'preview-off',status:'PASS'});
    await context.close();
  }
  {
    const {context,page,requests}=await runCase({status:401,error:'authentication_required'});
    await page.waitForFunction(()=>document.getElementById('dvStripeOffOverall')?.textContent.includes('FAIL'));
    const text=await page.locator('#dvStripeOffDiagnostics').innerText();
    assert.match(text,/GESAMT: FAIL/);
    assert.match(text,/authentication_required/);
    assert.equal(requests.length,1);
    assert.equal(requests[0].headers.authorization,undefined);
    results.push({mode:'sandbox-not-proven-off',status:'PASS'});
    await context.close();
  }
  {
    const context=await browser.newContext({viewport:{width:390,height:844}});
    const page=await context.newPage();
    await page.setContent('<!doctype html><html><body><section class="hero"></section><main id="app"></main></body></html>');
    await page.evaluate(()=>{window.DV_SUPABASE={environment:'production',url:'https://production.example.supabase.co'}});
    await page.addScriptTag({content:source});
    await page.waitForTimeout(100);
    assert.equal(await page.locator('#dvStripeOffDiagnostics').count(),0);
    results.push({mode:'production-disabled',status:'PASS'});
    await context.close();
  }
  await writeFile(new URL('browser-results.json',out),JSON.stringify({scope:'preview-only anonymous same-origin application OFF probe',results},null,2)+'\n');
  console.log('PASS: Stripe sandbox OFF diagnostics proves app-boundary 409 without auth token or provider call and stays disabled in production');
}finally{await browser.close()}
