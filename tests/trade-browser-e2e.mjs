// Browser test of existing TRADE UI with isolated fixtures; no live transactions.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
const root=fileURLToPath(new URL('..',import.meta.url));
const server=spawn(process.execPath,['tests/trade-ui-server.mjs'],{cwd:root,stdio:['ignore','pipe','pipe']});
await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',code=>reject(Error('Test server exited '+code)))});
let browser;
async function verifyViewport(name,contextOptions,screenshot){
 const page=await browser.newPage(contextOptions);
 const pageErrors=[];page.on('pageerror',error=>pageErrors.push(error.message));
 page.on('dialog',dialog=>dialog.accept());
 await page.goto('http://127.0.0.1:4173/trade.html?selftest=1');
 await page.waitForFunction(()=>{const text=document.getElementById('uiTestResults')?.textContent||'';return text.includes('ALL UI TESTS PASSED')||text.includes('\nFAIL')},null,{timeout:30000});
 const text=await page.locator('#uiTestResults').innerText();
 if(!text.includes('ALL UI TESTS PASSED'))console.log(await page.evaluate(()=>({calls:TRADE_UI_FIXTURE.calls.slice(-12),body:document.body.innerText.slice(-6000)})));
 assert.ok(text.includes('ALL UI TESTS PASSED'),`${name}: ${text}`);
 assert.deepEqual(pageErrors,[],`${name} TRADE page raised a browser error`);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1),true,`${name} Marketplace must not overflow horizontally`);
 await page.screenshot({path:fileURLToPath(new URL(`../test-results/${screenshot}`,import.meta.url)),fullPage:true});
 await page.close();
 return text;
}
try{
 browser=await chromium.launch({headless:true});
 await mkdir(new URL('../test-results/',import.meta.url),{recursive:true});
 const mobile=await verifyViewport('Mobile',{viewport:{width:390,height:844},isMobile:true,hasTouch:true},'trade-mobile.png');
 const desktop=await verifyViewport('Desktop',{viewport:{width:1440,height:1000}},'trade-desktop.png');
 await writeFile(new URL('../test-results/trade-browser.txt',import.meta.url),`MOBILE\n${mobile}\n\nDESKTOP\n${desktop}`);
 console.log('PASS: TRADE browser acceptance on mobile and desktop viewports');
}finally{await browser?.close();server.kill()}
