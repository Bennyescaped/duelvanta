// Browser heartbeat isolation for TRADE with local fixtures only; no live transactions.
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
const root=fileURLToPath(new URL('..',import.meta.url));
const server=spawn(process.execPath,['tests/trade-ui-server.mjs'],{cwd:root,stdio:['ignore','pipe','pipe']});
const timeout=(promise,ms,label)=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error(`${label} timed out after ${ms}ms`)),ms);promise.then(v=>{clearTimeout(timer);resolve(v)},e=>{clearTimeout(timer);reject(e)})});
const suspects={
 offersFix:'offers-fix.js',
 sellerTrust:'seller-trust.js',
 eligibility:'trade-b07-eligibility.js',
 c2c:'trade-c2c-swap.js',
 tradeV2:'trade-v2.js',
 paymentFlow:'trade-payment-flow.js',
 shippingAddress:'trade-shipping-address.js',
 shippingOptions:'trade-shipping-options.js',
 sealed:'trade-sealed.js',
 orders:'trade-orders.js',
 lifecycle:'trade-b07-order-lifecycle.js',
 offerDetails:'trade-offer-details.js',
 checkout:'trade-checkout.js',
 automation:'trade-automation.js',
 shippingProfiles:'trade-shipping-profiles.js',
 orderResolution:'trade-order-resolution.js',
 reviews:'trade-b07-reviews.js',
 share:'trade-b07-share.js',
 marketplaceUx:'trade-marketplace-ux.js',
 noticeAction:'trade-notice-action.js',
 sellerModeration:'trade-seller-moderation.js',
 sellerCompliance:'trade-seller-compliance.js'
};
let browser,exitCode=0;
async function heartbeat(name,blockedKey=null){
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const page=await context.newPage();
 if(blockedKey)await page.route(`**/${suspects[blockedKey]}*`,route=>route.abort());
 page.on('dialog',dialog=>dialog.dismiss());
 try{
  await timeout(page.goto('http://127.0.0.1:4173/trade.html?selftest=1',{waitUntil:'domcontentloaded',timeout:10000}),10000,`${name} navigation`);
  await new Promise(resolve=>setTimeout(resolve,250));
  const state=await timeout(page.evaluate(()=>({readyState:document.readyState,body:document.body?.children.length||0})),2000,`${name} renderer heartbeat`);
  console.log(`HEARTBEAT ${name}: RESPONSIVE ${JSON.stringify(state)}`);
  return true;
 }catch(error){
  console.log(`HEARTBEAT ${name}: BLOCKED ${error.message}`);
  return false;
 }finally{
  await timeout(context.close(),1500,`${name} close`).catch(()=>{});
 }
}
try{
 await timeout(new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',code=>reject(Error('Test server exited '+code)))}),10000,'server startup');
 browser=await timeout(chromium.launch({headless:true}),15000,'Chromium launch');
 const fullResponsive=await heartbeat('full-stack');
 if(fullResponsive)throw Error('full stack is responsive; prior timeout is selftest-specific rather than renderer starvation');
 let culprit=null;
 for(const key of Object.keys(suspects)){
   if(await heartbeat(`without-${key}`,key)){culprit=key;break}
 }
 if(!culprit)throw Error('no single TRADE script removal restores renderer responsiveness');
 throw Error(`browser-blocking TRADE module identified: ${culprit} (${suspects[culprit]})`);
}catch(error){exitCode=1;console.error(error?.stack||error)}finally{
 if(browser)await timeout(browser.close(),5000,'Chromium close').catch(()=>{});
 if(server.exitCode===null){server.kill('SIGTERM');await timeout(new Promise(r=>server.once('exit',r)),3000,'server stop').catch(()=>server.kill('SIGKILL'))}
}
process.exit(exitCode);
