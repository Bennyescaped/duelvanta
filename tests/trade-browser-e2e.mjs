// Browser test of existing TRADE UI with isolated fixtures; no live transactions.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
const root=fileURLToPath(new URL('..',import.meta.url));
const server=spawn(process.execPath,['tests/trade-ui-server.mjs'],{cwd:root,stdio:['ignore','pipe','pipe']});
const timeout=(promise,ms,label)=>Promise.race([promise,new Promise((_,reject)=>setTimeout(()=>reject(Error(`${label} timed out after ${ms}ms`)),ms))]);
await timeout(new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',code=>reject(Error('Test server exited '+code))) }),10000,'TRADE test server startup');
let browser;
async function verifyViewport(name,contextOptions,screenshot){
 const page=await browser.newPage(contextOptions);
 const pageErrors=[];page.on('pageerror',error=>pageErrors.push(error.message));
 page.on('dialog',dialog=>dialog.accept());
 page.setDefaultTimeout(30000);page.setDefaultNavigationTimeout(30000);
 try{
  await page.goto('http://127.0.0.1:4173/trade.html?selftest=1',{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>{const text=document.getElementById('uiTestResults')?.textContent||'';return text.includes('ALL UI TESTS PASSED')||text.includes('\nFAIL')},null,{timeout:30000});
  const text=await page.locator('#uiTestResults').innerText();
  if(!text.includes('ALL UI TESTS PASSED'))console.log(await page.evaluate(()=>({calls:TRADE_UI_FIXTURE.calls.slice(-12),body:document.body.innerText.slice(-6000)})));
  assert.ok(text.includes('ALL UI TESTS PASSED'),`${name}: ${text}`);
  assert.deepEqual(pageErrors,[],`${name} TRADE page raised a browser error`);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1),true,`${name} Marketplace must not overflow horizontally`);
  console.log(`TRADE ${name}: assertions complete; capturing bounded viewport evidence`);
  await page.screenshot({path:fileURLToPath(new URL(`../test-results/${screenshot}`,import.meta.url)),fullPage:false,animations:'disabled',timeout:15000});
  console.log(`TRADE ${name}: screenshot complete`);
  return text;
 }finally{
  await timeout(page.close({runBeforeUnload:false}),5000,`${name} page close`).catch(error=>console.warn(error.message));
 }
}
try{
 browser=await chromium.launch({headless:true});
 await mkdir(new URL('../test-results/',import.meta.url),{recursive:true});
 const mobile=await verifyViewport('Mobile',{viewport:{width:390,height:844},isMobile:true,hasTouch:true},'trade-mobile.png');
 const desktop=await verifyViewport('Desktop',{viewport:{width:1440,height:1000}},'trade-desktop.png');
 await writeFile(new URL('../test-results/trade-browser.txt',import.meta.url),`MOBILE\n${mobile}\n\nDESKTOP\n${desktop}`);
 console.log('PASS: TRADE browser acceptance on mobile and desktop viewports');
}finally{
 if(browser)await timeout(browser.close(),7000,'Chromium close').catch(error=>console.warn(error.message));
 if(server.exitCode===null){server.kill('SIGTERM');await timeout(new Promise(resolve=>server.once('exit',resolve)),3000,'TRADE test server stop').catch(()=>server.kill('SIGKILL'))}
}
