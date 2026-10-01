// Exact order-reader functions + actual compatibility guard in Chromium.
// The page shell and all data are fixtures; this is not a full-app/CI/Staging acceptance.
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const args=process.argv.slice(2);
const manifestIndex=args.indexOf('--manifest');
let orderSource;
if(manifestIndex>=0){
 const manifest=JSON.parse(await readFile(args[manifestIndex+1],'utf8'));
 orderSource=manifest.changes.find(c=>c.path==='trade-orders.js').replacements.find(r=>r.find.startsWith('async function load()')).replace;
}else{
 const source=await readFile(new URL('../trade-orders.js',import.meta.url),'utf8');
 const start=source.indexOf('async function loadWithdrawalContracts(){'),end=source.indexOf('function progress(',start);
 assert(start>=0&&end>start);orderSource=source.slice(start,end);
}
const runtimeIndex=args.indexOf('--playwright');
const {chromium}=await import(runtimeIndex>=0?pathToFileURL(args[runtimeIndex+1]).href:'playwright');
const guard=await readFile(new URL('../trade-legal-readiness.js',import.meta.url),'utf8');
const out=new URL('../test-results/trade-legal-order-boundary/',import.meta.url);
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{}),args:['--no-sandbox']});
const results=[];
async function scenario(width,mode){
 const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage();
 const errors=[],requests=[];
 page.on('pageerror',error=>errors.push(error.message));
 await context.route('**/*',route=>{requests.push(route.request().url());return route.abort()});
 try{
  await page.setContent('<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DUELVANTA – isolierter Bestelltest</title><style>body{font:16px system-ui;margin:20px}button{font:inherit;min-height:44px;margin:5px;padding:8px}.msg,pre{border:1px solid;padding:12px;white-space:pre-wrap;overflow-wrap:anywhere}</style></head><body><main id="app"><section class="hero"><h1>Bestelleinsicht</h1><p>Synthetische Testoberfläche – keine echten Nutzerdaten</p></section><button id="orders">Bestellungen laden</button><button id="proof">Bestellbestätigung lesen</button><button id="sendOffer">Neues Preisangebot</button><pre id="orderResult"></pre><pre id="proofResult"></pre></main></body></html>');
  await page.evaluate(mode=>{
   window.mode=mode;window.observed={calls:[],writes:[],results:[]};
   window.db={rpc(name,args,options){
    observed.calls.push({name,args,options});
    if(name==='get_market_legal_schema_readiness_v1'){
     if(mode==='missing-schema')return Promise.resolve({data:null,error:{code:'PGRST202'}});
     if(mode==='partial-schema')return Promise.resolve({data:{configured:false},error:null});
     return Promise.resolve({data:{compatible:true,revision:'trade-legal-contract-model-v1.2'},error:null});
    }
    if(name==='get_my_market_orders')return Promise.resolve({data:[{order_id:'existing-order',order_number:'DV-FIXTURE',total_amount:12.5}],error:null});
    if(name==='get_market_payment_sandbox_status')return Promise.resolve({data:{sandbox_enabled:false,live_mode:false},error:null});
    if(name==='get_market_order_items')return Promise.resolve({data:[{item_title:'Unveränderte Testkarte'}],error:null});
    if(name==='get_my_market_order_contract_documents')return Promise.resolve({data:[{snapshot_version:'checkout-contract-v1',confirmation_text:'Unveränderter alter Bestellnachweis'}],error:null});
    if(name==='get_my_market_withdrawable_contracts'){
     if(mode==='throw')throw Error('optional legal lookup failed');
     if(mode==='timeout')return new Promise(resolve=>window.resolveLateWithdrawal=resolve);
     return Promise.resolve({data:[{order_id:'existing-order',contract_snapshot_id:'existing-contract',already_submitted:false}],error:null});
    }
    throw Error('unexpected fixture RPC');
   }};
   window.__dvAppDb=window.db;
  },mode);
  await page.addScriptTag({content:guard});
  await page.addScriptTag({content:'let stripeSandbox;\n'+orderSource+`
    document.getElementById('orders').onclick=async()=>{
      const result=await load();
      observed.results.push({orders:result.orders,items:[...result.items],withdrawals:[...result.withdrawals]});
      document.getElementById('orderResult').textContent=result.orders[0].order_number+' · '+result.items.get('existing-order')[0].item_title;
    };
    document.getElementById('proof').onclick=async()=>{
      const result=await db.rpc('get_my_market_order_contract_documents',{p_order_id:'existing-order'});
      document.getElementById('proofResult').textContent=result.data[0].confirmation_text;
    };
    document.getElementById('sendOffer').onclick=()=>observed.writes.push('offer');
  `});
  await page.waitForFunction(()=>DV_TRADE_LEGAL_SCHEMA.state!=='checking');
  const started=Date.now();
  await page.locator('#orders').click();
  await page.waitForFunction(()=>observed.results.length===1,null,{timeout:7000});
  const elapsedMs=Date.now()-started;
  assert.match(await page.locator('#orderResult').innerText(),/DV-FIXTURE.*Unveränderte Testkarte/);
  await page.locator('#proof').click();
  await page.waitForFunction(()=>document.getElementById('proofResult').textContent.includes('Unveränderter alter Bestellnachweis'));
  const missing=['missing-schema','partial-schema'].includes(mode);
  const calls=await page.evaluate(()=>observed.calls);
  const optional=calls.filter(c=>c.name==='get_my_market_withdrawable_contracts');
  assert.equal(optional.length,missing?0:1,'absent/partial schema must not invoke new RPC');
  if(missing){
   assert.equal(await page.locator('#sendOffer').isDisabled(),true);
   await page.locator('#sendOffer').dispatchEvent('click');
   assert.deepEqual(await page.evaluate(()=>observed.writes),[]);
  }else assert.deepEqual(optional[0].options,{get:true});
  if(mode==='timeout'){
   assert(elapsedMs>=4900&&elapsedMs<7000,'real optional-read timeout must be bounded');
   await page.evaluate(()=>resolveLateWithdrawal({data:[{order_id:'existing-order'}],error:null}));
   await page.waitForTimeout(100);
  }
  const result=await page.evaluate(()=>observed.results[0]);
  assert.equal(result.withdrawals.length,mode==='compatible'?1:0,'failed/late response must not invent eligibility');
  assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
  if(width===390&&mode==='missing-schema')await page.screenshot({path:new URL('existing-orders-readable-390.png',out).pathname,fullPage:true});
  results.push({width,mode,status:'PASS',elapsedMs,optionalRpcCalls:optional.length,externalRequests:requests.length});
 }finally{await context.close()}
}
try{
 for(const width of [390,1363])for(const mode of ['missing-schema','partial-schema','throw','compatible'])await scenario(width,mode);
 await scenario(390,'timeout');
}finally{
 await browser.close();
 await writeFile(new URL('browser-results.json',out),JSON.stringify({scope:'exact order-reader functions, actual guard, fixture shell/data; not full application',results},null,2)+'\n');
}
console.log(`PASS: ${results.length} Chromium order-reader scenarios; old evidence stays readable, no external calls`);
