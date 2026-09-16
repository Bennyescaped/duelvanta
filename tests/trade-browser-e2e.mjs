// Browser heartbeat isolation for TRADE with local fixtures only; no live transactions.
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
const root=fileURLToPath(new URL('..',import.meta.url));
const server=spawn(process.execPath,['tests/trade-ui-server.mjs'],{cwd:root,stdio:['ignore','pipe','pipe']});
const timeout=(promise,ms,label)=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error(`${label} timed out after ${ms}ms`)),ms);promise.then(v=>{clearTimeout(timer);resolve(v)},e=>{clearTimeout(timer);reject(e)})});
const files={tradeV2:'trade-v2.js',marketplaceUx:'trade-marketplace-ux.js',noticeAction:'trade-notice-action.js',sellerModeration:'trade-seller-moderation.js',sellerCompliance:'trade-seller-compliance.js'};
let browser,exitCode=0;
async function heartbeat(name,{blocked=[],fakeDealsTab=false}={}){
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const page=await context.newPage();
 for(const key of blocked)await page.route(`**/${files[key]}*`,route=>route.abort());
 if(fakeDealsTab)await page.addInitScript(()=>document.addEventListener('DOMContentLoaded',()=>{if(!document.getElementById('dvDealsTab')){const tabs=document.querySelector('.tabs'),sell=document.getElementById('sell'),button=document.createElement('button');button.id='dvDealsTab';button.className='btn';button.textContent='DEALS';sell?tabs?.insertBefore(button,sell):tabs?.appendChild(button)}}));
 page.on('dialog',dialog=>dialog.dismiss());
 try{
  await timeout(page.goto('http://127.0.0.1:4173/trade.html?selftest=1',{waitUntil:'domcontentloaded',timeout:10000}),10000,`${name} navigation`);
  await new Promise(resolve=>setTimeout(resolve,250));
  const state=await timeout(page.evaluate(()=>({readyState:document.readyState,body:document.body?.children.length||0,ux:!!window.DV_TRADE_MARKETPLACE_UX,deals:!!document.getElementById('dvDealsTab')})),2000,`${name} renderer heartbeat`);
  console.log(`HEARTBEAT ${name}: RESPONSIVE ${JSON.stringify(state)}`);return true;
 }catch(error){console.log(`HEARTBEAT ${name}: BLOCKED ${error.message}`);return false}
 finally{await timeout(context.close(),1500,`${name} close`).catch(()=>{})}
}
try{
 await timeout(new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',code=>reject(Error('Test server exited '+code)))}),10000,'server startup');
 browser=await timeout(chromium.launch({headless:true}),15000,'Chromium launch');
 const full=await heartbeat('full-stack');
 const noUx=await heartbeat('without-marketplaceUx',{blocked:['marketplaceUx']});
 const noTradeV2=await heartbeat('without-tradeV2',{blocked:['tradeV2']});
 const noTradeV2FakeTab=await heartbeat('without-tradeV2-with-fake-deals-tab',{blocked:['tradeV2'],fakeDealsTab:true});
 const noNotice=await heartbeat('without-noticeAction',{blocked:['noticeAction']});
 const noModeration=await heartbeat('without-sellerModeration',{blocked:['sellerModeration']});
 const noCompliance=await heartbeat('without-sellerCompliance',{blocked:['sellerCompliance']});
 console.log('DEPENDENCY MATRIX',JSON.stringify({full,noUx,noTradeV2,noTradeV2FakeTab,noNotice,noModeration,noCompliance}));
 if(full)throw Error('full stack unexpectedly responsive');
 if(noUx)throw Error('culprit=trade-marketplace-ux activation chain');
 if(noTradeV2&&noTradeV2FakeTab)throw Error('culprit=trade-v2 itself');
 if(noTradeV2&&!noTradeV2FakeTab)throw Error('culprit=module activated by presence of dvDealsTab');
 if(noNotice)throw Error('culprit=trade-notice-action');
 if(noModeration)throw Error('culprit=trade-seller-moderation');
 if(noCompliance)throw Error('culprit=trade-seller-compliance');
 throw Error('culprit remains in trade-v2 interaction chain');
}catch(error){exitCode=1;console.error(error?.stack||error)}finally{
 if(browser)await timeout(browser.close(),5000,'Chromium close').catch(()=>{});
 if(server.exitCode===null){server.kill('SIGTERM');await timeout(new Promise(r=>server.once('exit',r)),3000,'server stop').catch(()=>server.kill('SIGKILL'))}
}
process.exit(exitCode);
