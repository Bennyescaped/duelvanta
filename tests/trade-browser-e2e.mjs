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
try{
 browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const pageErrors=[];page.on('pageerror',error=>pageErrors.push(error.message));
 // Confirm the user's receipt action in the fixture, just as in the real UI.
 page.on('dialog',dialog=>dialog.accept());
 await page.goto('http://127.0.0.1:4173/trade.html?selftest=1');
 await page.waitForFunction(()=>{const text=document.getElementById('uiTestResults')?.textContent||'';return text.includes('ALL UI TESTS PASSED')||text.includes('\nFAIL')},null,{timeout:30000});
 const text=await page.locator('#uiTestResults').innerText();
 await mkdir(new URL('../test-results/',import.meta.url),{recursive:true});
 await writeFile(new URL('../test-results/trade-browser.txt',import.meta.url),text);
 if(!text.includes('ALL UI TESTS PASSED'))console.log(await page.evaluate(()=>({calls:TRADE_UI_FIXTURE.calls.slice(-12),body:document.body.innerText.slice(-6000)})));
 assert.ok(text.includes('ALL UI TESTS PASSED'),text);
 assert.deepEqual(pageErrors,[],'Mobile TRADE page raised a browser error');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1),true,'Mobile Marketplace must not overflow horizontally');
 await page.screenshot({path:fileURLToPath(new URL('../test-results/trade-mobile.png',import.meta.url)),fullPage:true});
 console.log(text);
}finally{await browser?.close();server.kill()}
