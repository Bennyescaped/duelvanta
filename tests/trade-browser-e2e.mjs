// Browser test of existing TRADE UI with isolated fixtures; no live transactions.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
const root=fileURLToPath(new URL('..',import.meta.url));
const server=spawn(process.execPath,['tests/trade-ui-server.mjs'],{cwd:root,stdio:['ignore','pipe','pipe']});
const timeout=(promise,ms,label)=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error(`${label} timed out after ${ms}ms`)),ms);promise.then(value=>{clearTimeout(timer);resolve(value)},error=>{clearTimeout(timer);reject(error)})});
const watchdog=setTimeout(()=>{console.error('FAIL: TRADE browser acceptance exceeded 60000ms');server.kill('SIGKILL');process.exit(1)},60000);
let browser,exitCode=0;
async function verifyViewport(name,contextOptions){
 console.log(`TRADE ${name}: creating context`);
 const context=await timeout(browser.newContext(contextOptions),10000,`${name} browser context`);
 console.log(`TRADE ${name}: creating page`);
 const page=await timeout(context.newPage(),10000,`${name} browser page`);
 const pageErrors=[];page.on('pageerror',error=>pageErrors.push(error.message));
 page.on('console',message=>{if(message.type()==='error')console.error(`PAGE ${name}:`,message.text())});
 page.on('dialog',dialog=>dialog.accept());
 page.setDefaultTimeout(30000);page.setDefaultNavigationTimeout(30000);
 try{
  console.log(`TRADE ${name}: navigating`);
  await timeout(page.goto('http://127.0.0.1:4173/trade.html?selftest=1',{waitUntil:'domcontentloaded',timeout:30000}),20000,`${name} navigation`);
  console.log(`TRADE ${name}: waiting for UI selftest`);
  try{
    await timeout(page.waitForFunction(()=>{const text=document.getElementById('uiTestResults')?.textContent||'';return text.includes('ALL UI TESTS PASSED')||text.includes('\nFAIL')},null,{timeout:30000}),20000,`${name} UI selftest`);
  }catch(error){
    const diagnostics=await timeout(page.evaluate(()=>({
      readyState:document.readyState,
      uiText:document.getElementById('uiTestResults')?.textContent||null,
      calls:window.TRADE_UI_FIXTURE?.calls?.slice(-20)||[],
      tradeView:document.getElementById('app')?.dataset?.tradeView||null,
      appHidden:document.getElementById('app')?.classList.contains('hidden')??null,
      globals:{checkout:!!window.DV_TRADE_CHECKOUT,automation:!!window.DV_TRADE_AUTOMATION,marketplaceUx:!!window.DV_TRADE_MARKETPLACE_UX,c2c:!!window.DV_C2C_SWAP,reviews:!!window.DV_B07_REVIEWS,share:!!window.DV_B07_SHARE,lifecycle:!!window.DV_B07_ORDER_LIFECYCLE}
    })),5000,`${name} selftest timeout diagnostics`).catch(diagError=>({diagnostic_error:diagError.message}));
    console.error(`TRADE ${name} selftest diagnostics:`,JSON.stringify(diagnostics));
    throw error;
  }
  console.log(`TRADE ${name}: reading UI result`);
  const text=await timeout(page.locator('#uiTestResults').innerText(),10000,`${name} UI result read`);
  if(!text.includes('ALL UI TESTS PASSED'))console.log(await timeout(page.evaluate(()=>({calls:TRADE_UI_FIXTURE.calls.slice(-12),body:document.body.innerText.slice(-6000)})),5000,`${name} failure diagnostics`));
  assert.ok(text.includes('ALL UI TESTS PASSED'),`${name}: ${text}`);
  assert.deepEqual(pageErrors,[],`${name} TRADE page raised a browser error`);
  const noOverflow=await timeout(page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1),5000,`${name} overflow check`);
  assert.equal(noOverflow,true,`${name} Marketplace must not overflow horizontally`);
  console.log(`TRADE ${name}: browser assertions complete`);
  return text;
 }finally{
  await timeout(context.close(),5000,`${name} context close`).catch(error=>console.warn(error.message));
 }
}
try{
 await timeout(new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',code=>reject(Error('Test server exited '+code)))}),10000,'TRADE test server startup');
 console.log('TRADE browser: test server ready');
 browser=await timeout(chromium.launch({headless:true}),15000,'Chromium launch');
 console.log('TRADE browser: Chromium launched');
 await mkdir(new URL('../test-results/',import.meta.url),{recursive:true});
 const mobile=await verifyViewport('Mobile',{viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const desktop=await verifyViewport('Desktop',{viewport:{width:1440,height:1000}});
 await writeFile(new URL('../test-results/trade-browser.txt',import.meta.url),`MOBILE\n${mobile}\n\nDESKTOP\n${desktop}`);
 console.log('PASS: TRADE browser acceptance on mobile and desktop viewports');
}catch(error){
 exitCode=1;console.error(error?.stack||error);
}finally{
 if(browser)await timeout(browser.close(),5000,'Chromium close').catch(error=>console.warn(error.message));
 if(server.exitCode===null){server.kill('SIGTERM');await timeout(new Promise(resolve=>server.once('exit',resolve)),3000,'TRADE test server stop').catch(()=>server.kill('SIGKILL'))}
 clearTimeout(watchdog);
}
process.exit(exitCode);
