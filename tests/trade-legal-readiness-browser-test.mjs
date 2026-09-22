// Focused real Chromium integration: actual schema guard + actual release loader;
// contract handlers, data, profile services and remaining TRADE modules are fixtures.
// No Supabase/Stripe/production calls. Not a full application or Staging acceptance.
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(process.argv[2]?pathToFileURL(process.argv[2]).href:'playwright');
const guard=await readFile(new URL('../trade-legal-readiness.js',import.meta.url),'utf8');
const loader=await readFile(new URL('../trade-release-gate.js',import.meta.url),'utf8');
const out=new URL('../test-results/trade-legal-readiness/',import.meta.url);await mkdir(out,{recursive:true});
const selectors=['#dvBuyNow','#sendOffer','[data-accept-offer]','[data-checkout-offer]','[data-o-stripe]','[data-o-withdraw]','#oWithdrawalPrepare','#oWithdrawalConfirm','#saveBuyerPurchaseType'];
const results=[];
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{}),args:['--no-sandbox']});
const fixture=(mode,environment,role,omitGuard)=>`<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font:16px system-ui;margin:20px}button,select{font:inherit;min-height:44px;margin:5px;padding:8px}section{margin:12px 0}.msg{padding:12px;border:1px solid;margin:8px 0;overflow-wrap:anywhere}.trade-release-locked #contractActions{display:none}</style></head><body><main id="app" class="wrap trade-runtime-loading" aria-busy="true"><header><h1>DUELVANTA – isolierter Schutztest</h1><button id="logout">Abmelden</button></header><section class="hero"></section><nav><button id="orders">Bestellungen</button><button id="evidence">Bestellbestätigung</button><button id="normalProfile">Profil speichern</button></nav><section id="orderContent"></section><section id="contractActions"><button id="dvBuyNow"><span>Kaufangebot senden</span></button><div id="dvBuyMsg"></div><form id="offerForm"><button id="sendOffer" type="submit">Preisangebot senden</button><div id="offerMsg"></div></form><button data-accept-offer="test">Annehmen</button><button data-checkout-offer="test">Alter Checkout</button><button data-o-stripe="test">Zahlung</button><button data-o-withdraw="test">Vertrag widerrufen</button><button id="oWithdrawalPrepare">Widerruf vorbereiten</button><button id="oWithdrawalConfirm">Widerruf bestätigen</button><div id="dvODMsg"></div><select id="buyerPurchaseType"><option value="consumer">Privat</option></select><button id="saveBuyerPurchaseType">Käuferstatus speichern</button><div id="buyerPurchaseTypeMsg"></div></section></main><script>
window.testMode=${JSON.stringify(mode)};window.observed={calls:[],writes:[],navigation:[],scripts:[],clients:0};
window.responseForProbe=()=>({data:{configured:false,schema_version:'trade-legal-contract-model-v1'},error:null});
const fixtureDb={auth:{getSession:async()=>({data:{session:{user:{id:'fixture-user'}}}}),signOut:async()=>{}},from:()=>({select:()=>({eq:()=>({single:async()=>({data:{role:${JSON.stringify(role)}},error:null})})})}),rpc:async(name,args,options)=>{
 observed.calls.push({name,args,options});
 if(name!=='get_my_market_buyer_profile')return {data:[],error:null};
 if(testMode==='missing')return {data:null,error:{code:'PGRST202',message:'missing function'}};
 if(testMode==='legacy')return {data:{configured:false},error:null};
 if(testMode==='malformed')return {data:{configured:'true',schema_version:'trade-legal-contract-model-v1'},error:null};
 if(testMode==='throw')throw Error('fixture network failure');
 if(testMode==='delayed'||testMode==='late')return new Promise(resolve=>window.resolveProbe=()=>resolve(responseForProbe()));
 return responseForProbe();
}};
window.__dvAppDb=fixtureDb;
window.DV_SUPABASE={environment:${JSON.stringify(environment)},url:'https://example.supabase.co',key:'fixture-public-key'};
window.supabase={createClient:()=>{observed.clients++;return fixtureDb}};
</script>${omitGuard?'':'<script src="/trade-legal-readiness.js?v=1.1"></script>'}<script src="/trade-release-gate.js?v=1.3"></script></body></html>`;
async function setup(mode,{width=390,environment='preview',role='player',omitGuard=false}={}){
 const context=await browser.newContext({viewport:{width,height:844}});
 const page=await context.newPage(),errors=[],unexpected=[];
 page.on('pageerror',e=>errors.push(e.message));
 // Run entirely in about:blank: no network origin or managed-network exception.
 // Script downloads are fixtures; the real loader's ordering/onload logic runs.
 await context.route('**/*',route=>{unexpected.push(route.request().url());return route.abort()});
 const html=fixture(mode,environment,role,omitGuard).replace(/<script src="[^"]+"><\/script>/g,'');
 await page.setContent(html);
 await page.evaluate(({selectors})=>{
  const original=document.body.appendChild.bind(document.body);
  document.body.appendChild=node=>{
   if(node.tagName!=='SCRIPT'||!node.getAttribute('src'))return original(node);
   const src=node.getAttribute('src'),path=src.split('?')[0];
   observed.scripts.push('/'+src);
   if(node.async!==false)throw Error('loader lost ordered classic scripts');
   queueMicrotask(()=>{
    if(path==='trade.js'){
     for(const selector of selectors){const el=document.querySelector(selector);el.addEventListener('click',()=>observed.writes.push(selector))}
     document.getElementById('offerForm').addEventListener('submit',event=>{event.preventDefault();observed.writes.push('form')});
     document.getElementById('orders').onclick=()=>{observed.navigation.push('orders');fixtureDb.rpc('get_my_market_orders');document.getElementById('orderContent').textContent='Bestehende Testbestellung DV-FIXTURE – unverändert'};
     document.getElementById('evidence').onclick=()=>{observed.navigation.push('evidence');fixtureDb.rpc('get_my_market_order_contract_documents')};
     document.getElementById('normalProfile').onclick=()=>observed.navigation.push('profile');
    }
    if(path==='trade-orders.js')window.DV_TRADE_ORDERS={version:'fixture'};
    if(path==='trade-marketplace-ux.js')window.DV_TRADE_MARKETPLACE_UX={sync(){}};
    if(path==='trade-search-archive.js')window.DV_TRADE_SEARCH_ARCHIVE={refreshActive(){}};
    node.onload?.();
   });
   return node;
  };
 },{selectors});
 if(!omitGuard)await page.addScriptTag({content:guard});
 await page.addScriptTag({content:loader});
 if(!omitGuard&&environment!=='production')await page.waitForSelector('#app.dv-trade-ready');
 return {context,page,errors,unexpected};
}
async function finish(t,name){
 assert.deepEqual(t.errors,[],name+' JS errors');assert.deepEqual(t.unexpected,[],name+' external requests');
 results.push({name,status:'PASS',...await t.page.evaluate(()=>({readCalls:observed.calls.length,writeHandlerCalls:observed.writes.length,guard:window.DV_TRADE_LEGAL_SCHEMA?.state||'missing'}))});
 await t.context.close();
}
try{
 for(const width of [390,1363])for(const mode of ['missing','legacy','malformed','throw']){
  const t=await setup(mode,{width}),p=t.page;
  await p.waitForFunction(()=>DV_TRADE_LEGAL_SCHEMA.state==='schema-unavailable');
  for(const selector of selectors){
   assert.equal(await p.locator(selector).isDisabled(),true,'unavailable actions visibly disabled');
   // Explicit event dispatch also checks the capture barrier beyond native disabled.
   await p.locator(selector).dispatchEvent('click');
  }
  await p.evaluate(()=>document.getElementById('offerForm').requestSubmit());
  await p.evaluate(()=>{const b=document.createElement('button');b.dataset.oStripe='dynamic';b.id='lateAction';b.textContent='Später eingefügt';b.onclick=()=>observed.writes.push('dynamic');document.getElementById('contractActions').append(b)});
  assert.equal(await p.locator('#lateAction').isDisabled(),true);
  await p.locator('#lateAction').dispatchEvent('click');
  for(const id of ['orders','evidence','normalProfile'])await p.locator('#'+id).click();
  assert.deepEqual(await p.evaluate(()=>observed.writes),[]);
  assert.deepEqual(await p.evaluate(()=>observed.navigation),['orders','evidence','profile']);
  assert.equal(await p.locator('#buyerPurchaseType').isDisabled(),true);
  assert.equal(await p.locator('#dvTradeLegalSchemaNotice').count(),1);
  assert.equal(await p.evaluate(()=>observed.calls.filter(x=>x.name==='get_my_market_buyer_profile').length),1);
  assert.deepEqual(await p.evaluate(()=>observed.calls[0].options),{get:true});
  const loaded=await p.evaluate(()=>observed.scripts);
  for(const asset of ['trade-orders.js?v=1.7','trade-offer-details.js?v=2.1','trade-checkout.js?v=2.2'])assert.ok(loaded.includes('/'+asset));
  if(mode==='missing'&&width===390)await p.screenshot({path:new URL('step1-mobile-guard.png',out).pathname,fullPage:true});
  await finish(t,`${width}px ${mode}: actions blocked; reads/navigation retained`);
 }
 const compatible=await setup('compatible');await compatible.page.waitForFunction(()=>DV_TRADE_LEGAL_SCHEMA.available);
 await compatible.page.locator('#dvBuyNow').click();assert.deepEqual(await compatible.page.evaluate(()=>observed.writes),['#dvBuyNow']);
 assert.equal(await compatible.page.evaluate(()=>observed.clients),1,'guard creates no extra client');
 await finish(compatible,'Explicit synthetic compatibility does not replace handler authorization');
 const delayed=await setup('delayed');
 await delayed.page.locator('#dvBuyNow').focus();await delayed.page.keyboard.press('Enter');await delayed.page.keyboard.press('Space');
 await delayed.page.locator('#dvBuyNow').dblclick();
 await delayed.page.locator('#saveBuyerPurchaseType').click();
 assert.deepEqual(await delayed.page.evaluate(()=>observed.writes),[]);
 await delayed.page.evaluate(()=>resolveProbe());await delayed.page.waitForFunction(()=>DV_TRADE_LEGAL_SCHEMA.available);
 assert.equal(await delayed.page.locator('#saveBuyerPurchaseType').isDisabled(),false);
 assert.equal(await delayed.page.locator('#buyerPurchaseType').isDisabled(),false);
 assert.equal(await delayed.page.locator('#buyerPurchaseTypeMsg').textContent(),'');
 await finish(delayed,'Early click remains blocked without permanently disabling compatible profile');
 const late=await setup('late');await late.page.waitForFunction(()=>DV_TRADE_LEGAL_SCHEMA.state==='schema-unavailable',{},{timeout:7000});
 await late.page.evaluate(()=>resolveProbe());await late.page.waitForTimeout(100);
 assert.equal(await late.page.evaluate(()=>DV_TRADE_LEGAL_SCHEMA.available),false);
 await finish(late,'Real five-second timeout; late success cannot unlock');
 const missingAsset=await setup('compatible',{omitGuard:true});
 await missingAsset.page.waitForSelector('.trade-release-lock-screen');
 assert.equal(await missingAsset.page.evaluate(()=>observed.scripts.length),0);
 await finish(missingAsset,'Missing guard asset stops TRADE handler loader');
 const production=await setup('compatible',{environment:'production'});
 await production.page.waitForSelector('#tradeReleaseLockScreen');
 assert.equal(await production.page.evaluate(()=>observed.scripts.length),0);
 assert.equal(await production.page.evaluate(()=>DV_TRADE_RELEASE.state),'locked');
 await finish(production,'Production-lock path with synthetic environment remains unchanged');
}finally{
 await browser.close();
 await writeFile(new URL('browser-results.json',out),JSON.stringify({scope:'real guard and release loader, synthetic remainder; not full-app/staging',results},null,2)+'\n');
}
console.log(`PASS: ${results.length} real Chromium scenarios; no external app or provider requests`);
