// Browser isolation test for TRADE UI with local fixtures only; no live transactions.
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
const root=fileURLToPath(new URL('..',import.meta.url));
const server=spawn(process.execPath,['tests/trade-ui-server.mjs'],{cwd:root,stdio:['ignore','pipe','pipe']});
const timeout=(promise,ms,label)=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error(`${label} timed out after ${ms}ms`)),ms);promise.then(v=>{clearTimeout(timer);resolve(v)},e=>{clearTimeout(timer);reject(e)})});
const suspects={
 eligibility:'trade-b07-eligibility.js',
 c2c:'trade-c2c-swap.js',
 lifecycle:'trade-b07-order-lifecycle.js',
 reviews:'trade-b07-reviews.js',
 share:'trade-b07-share.js',
 sellerCompliance:'trade-seller-compliance.js'
};
const all=Object.keys(suspects);
let browser,exitCode=0;
async function scenario(name,enabled){
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const page=await context.newPage();
 const blocked=all.filter(key=>!enabled.includes(key));
 for(const key of blocked)await page.route(`**/${suspects[key]}*`,route=>route.abort());
 page.on('dialog',dialog=>dialog.accept());
 try{
  await timeout(page.goto('http://127.0.0.1:4173/trade.html?selftest=1',{waitUntil:'domcontentloaded',timeout:15000}),15000,`${name} navigation`);
  await timeout(page.waitForFunction(()=>{const t=document.getElementById('uiTestResults')?.textContent||'';return t.includes('ALL UI TESTS PASSED')||t.includes('\nFAIL')},null,{timeout:7000}),8000,`${name} selftest`);
  const text=await timeout(page.locator('#uiTestResults').innerText(),3000,`${name} result`);
  const ok=text.includes('ALL UI TESTS PASSED');
  console.log(`ISOLATION ${name}: ${ok?'PASS':'FAIL'} enabled=${enabled.join(',')||'none'} ${ok?'':text.slice(-500)}`);
  return ok;
 }catch(error){
  console.log(`ISOLATION ${name}: TIMEOUT enabled=${enabled.join(',')||'none'} error=${error.message}`);
  return false;
 }finally{
  await timeout(context.close(),3000,`${name} close`).catch(()=>{});
 }
}
try{
 await timeout(new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',code=>reject(Error('Test server exited '+code)))}),10000,'server startup');
 browser=await timeout(chromium.launch({headless:true}),15000,'Chromium launch');
 const results={};
 results.baseline=await scenario('baseline',[]);
 for(const key of all)results[key]=await scenario(key,[key]);
 results.early=await scenario('early',['eligibility','c2c','lifecycle']);
 results.late=await scenario('late',['reviews','share','sellerCompliance']);
 results.full=await scenario('full',all);
 console.log('ISOLATION MATRIX',JSON.stringify(results));
 if(!results.baseline)throw Error('baseline failed: non-B07 browser harness is not healthy');
 const failedSingles=all.filter(key=>!results[key]);
 if(failedSingles.length)throw Error(`isolated blocking module(s): ${failedSingles.join(',')}`);
 if(!results.full)throw Error(`interaction-only browser block; early=${results.early} late=${results.late}`);
 console.log('PASS: TRADE browser isolation matrix');
}catch(error){exitCode=1;console.error(error?.stack||error)}finally{
 if(browser)await timeout(browser.close(),5000,'Chromium close').catch(()=>{});
 if(server.exitCode===null){server.kill('SIGTERM');await timeout(new Promise(r=>server.once('exit',r)),3000,'server stop').catch(()=>server.kill('SIGKILL'))}
}
process.exit(exitCode);
