// Actual profile DOM, profile script and unchanged guard; only services/assets are fixtures.
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(process.argv[2]?pathToFileURL(process.argv[2]).href:'playwright');
const read=name=>readFile(new URL('../'+name,import.meta.url),'utf8');
const [profile,guard,originalHtml]=await Promise.all(['profile.js','trade-legal-readiness.js','profile.html'].map(read));
const html=originalHtml.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,'').replace(/<link\b[^>]*>/g,'').replace('src="v-logo.svg"','');
const results=[],browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{}),args:['--no-sandbox']});
const out=new URL('../test-results/trade-legal-step2/',import.meta.url);await mkdir(out,{recursive:true});
try{
 for(const width of [390,1363])for(const mode of ['missing','compatible']){
  const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage(),errors=[],unexpected=[];
  try{
   page.on('pageerror',e=>errors.push(e.message));await context.route('**/*',route=>{unexpected.push(route.request().url());return route.abort()});
   await page.setContent(html);
   await page.evaluate(mode=>{
    window.observed={rpc:[],tables:[]};
    const fixture={auth:{getSession:async()=>({data:{session:{user:{id:'fixture-user'}}}})},from:table=>{
     observed.tables.push(table);
     if(table==='profiles')return {select:()=>({eq:()=>({single:async()=>({data:{display_name:'Fixture seller',username:'fixture',email:'fixture@example.test',collection_visibility:'private'},error:null})})})};
     if(table==='collection_folders')return {select:()=>({order:async()=>({data:[],error:null})})};
     throw Error('unexpected table '+table);
    },rpc:async(name,args,options)=>{
     observed.rpc.push({name,args,options});
     if(name==='get_market_legal_schema_readiness_v1')return mode==='missing'?{data:null,error:{code:'PGRST202',message:'missing fixture function'}}:{data:{compatible:true,revision:'trade-legal-contract-model-v1.2'},error:null};
     if(name==='get_my_default_shipping_address')return {data:{recipient_name:'Fixture recipient',country_code:'DE'},error:null};
     throw Error('unexpected RPC '+name);
    }};
    window.DV_SUPABASE={environment:'preview',url:'https://fixture.supabase.co',key:'sb_publishable_fixture_key'};
    window.supabase={createClient:()=>fixture};
   },mode);
   await page.addScriptTag({content:guard});await page.addScriptTag({content:profile});
   await page.waitForFunction(()=>!document.getElementById('profileApp').classList.contains('hidden')&&DV_TRADE_LEGAL_SCHEMA.state!=='checking');
   assert.equal(await page.locator('#displayName').inputValue(),'Fixture seller');
   assert.equal(await page.locator('#defaultRecipient').inputValue(),'Fixture recipient');
   assert.equal(await page.locator('#buyerPurchaseType,#saveBuyerPurchaseType').count(),0);
   assert.equal(await page.locator('#saveIdentity').isEnabled(),true);
   assert.equal(await page.locator('#dvTradeLegalSchemaNotice').count(),mode==='missing'?1:0);
   const calls=await page.evaluate(()=>observed.rpc);
   assert.deepEqual(calls.map(x=>x.name).sort(),['get_my_default_shipping_address','get_market_legal_schema_readiness_v1']);
   assert.deepEqual(calls.find(x=>x.name==='get_market_legal_schema_readiness_v1').options,{get:true});
   assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);
   results.push({width,mode,status:'PASS',profileMutationCalls:0,secondBuyerControls:0});
  }finally{await context.close()}
 }
}finally{
 const version=browser.version();await browser.close();
 await writeFile(new URL('buyer-browser-results.json',out),JSON.stringify({scope:'actual profile DOM/script and guard; services/assets mocked; no Staging acceptance',browser:version,results},null,2)+'\n');
}
console.log(`PASS: ${results.length} real Chromium profile/guard scenarios; duplicate buyer UI removed, no external requests or profile mutations`);
