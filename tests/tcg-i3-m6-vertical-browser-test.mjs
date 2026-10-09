// P3: unchanged COLLECT UI, local database adapter, exact P2-R1 response replay.
// The captured RPC is replayed separately by the existing disposable PG harness.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {chromium} from 'playwright';

const root=resolve(import.meta.dirname,'..'),out=resolve(root,'test-results/tcg-i3-m6-p3');
const fixturePath='tests/fixtures/tcg-i3-magic/m6-p2-r1-live-response.json';
const response=await readFile(resolve(root,fixturePath));
const sha=x=>createHash('sha256').update(x).digest('hex');
const fixtureSha='960df122f5c68b0a63284c75dd8e20efce8aa4bd9f208d10ac6ac2d7c734a5aa';
assert.equal(sha(response),fixtureSha,'Original projected P2-R1 response bytes');
const candidate=JSON.parse(response).candidate;
const owner='84000000-0000-4000-8000-000000000003',foreign='84000000-0000-4000-8000-000000000004';
const folder='85000000-0000-4000-8000-000000000930',item='85000000-0000-4000-8000-000000000931';
const keys=['folder_id','card_name','set_name','card_number','language','variant','condition','quantity','grading_company','grade','cert_number','purchase_price','purchase_date','market_price','currency','notes','contract_version'];
await mkdir(out,{recursive:true});
const server=createServer(async(req,res)=>{try{
 const p=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
 if(!p.startsWith(root+'/'))throw Error('Invalid path');
 res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json'})[extname(p)]||'text/plain');
 res.end(await readFile(p));
}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch({headless:true});
const cases=[],forbidden=[],replays=[];
const report={contract:'m6-p3-vertical-browser/1',passed:false,engine:browser.version(),fixture:{path:fixturePath,sha256:fixtureSha,bytes:response.length,origin:'P2-R1 projected live response; replay only'},cases,network:'local fixtures only',database_connection:'mock adapter; captured payload replay is a separate SQL harness',new_provider_live_requests:0,production_mutations:0,staging_mutations:0};
const check=name=>{cases.push({name,status:'PASS'});console.log('PASS',name);};
try{
 for(const width of [390,1363]){
  const context=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block'}),page=await context.newPage();
  page.setDefaultTimeout(12000);
  const errors=[],rpc=[],lookup=[];let rows=[],mode='disabled',readinessCalls=0;
  page.on('pageerror',e=>errors.push(e.message));
  page.on('websocket',s=>forbidden.push('websocket '+s.url()));
  const readiness=()=>mode==='missing'?{data:null,error:null}:{data:{contract:'magic-on-demand-collect-beta/1',user_id:mode==='foreign'?foreign:owner,magic_on_demand_collection_beta:mode!=='disabled',checked_at:new Date(Date.now()-(mode==='expired'?120000:0)).toISOString()},error:null};
  await page.route('**/*',async route=>{
   const request=route.request(),u=new URL(request.url());
   if(u.origin===base&&u.pathname==='/api/compliance-message-dispatch')return route.fulfill({contentType:'text/javascript',body:'window.DV_SUPABASE={url:"https://xhmjxrcskfhbovhitdej.supabase.co",key:"fixture-only",environment:"preview"}'});
   if(u.href.startsWith('https://cdn.jsdelivr.net/npm/@supabase/supabase-js'))return route.fulfill({contentType:'text/javascript',body:`window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:{user:{id:'${owner}'}}}}),onAuthStateChange:()=>({})},rpc:(name,args)=>fetch('/fixture-rpc',{method:'POST',body:JSON.stringify({name,args})}).then(r=>r.json()),from:table=>{const filters={};let columns=null,single=false;const q={select:value=>{columns=value;return q},eq:(k,v)=>{filters[k]=v;return q},order:()=>q,single:()=>{single=true;return q},then:(a,b)=>fetch('/fixture-table',{method:'POST',body:JSON.stringify({table,columns,single,filters})}).then(r=>r.json()).then(a,b)};return q},storage:{from:()=>({createSignedUrl:async()=>{throw Error('Unexpected image access')}})}})}`});
   if(u.origin===base&&u.pathname==='/fixture-rpc'){
    const body=request.postDataJSON();
    if(body.name==='get_magic_on_demand_collection_beta_v1'){readinessCalls++;return route.fulfill({json:readiness()});}
    rpc.push(body);
    if(body.name==='save_my_tcg_collection_item_v1'){
     const args=body.args;assert.deepEqual(Object.keys(args).sort(),['p_game_key','p_item','p_item_id']);
     assert.equal(args.p_game_key,'magic');assert.deepEqual(Object.keys(args.p_item).sort(),keys.slice().sort());
     assert.equal(args.p_item.contract_version,'1');assert.equal(args.p_item.folder_id,folder);
     assert.equal(args.p_item.market_price,null);assert.equal(args.p_item.purchase_price,null);
     const {contract_version,...copy}=args.p_item;
     if(args.p_item_id===null){assert.equal(mode,'enabled');assert.equal(rows.length,0);rows.push({...copy,id:item,user_id:owner,tcg:'magic',binder_page:null,binder_slot:null});}
     else{assert.equal(args.p_item_id,item);Object.assign(rows[0],copy);}
     return route.fulfill({json:{data:item,error:null}});
    }
    assert.equal(body.name,'dv_collect_move_card','Unknown RPC fails closed');
    assert.deepEqual(body.args,{p_item_id:item,p_folder_id:folder,p_page:1,p_slot:3});
    Object.assign(rows[0],{binder_page:1,binder_slot:3});return route.fulfill({json:{data:{moved:true},error:null}});
   }
   if(u.origin===base&&u.pathname==='/fixture-table'){
    const body=request.postDataJSON();
    if(body.table==='profiles'){
     assert.equal(body.columns,'role','Only the profile role column is permitted');
     assert.equal(body.single,true,'Profile role read requires single-row response');
     assert.deepEqual(body.filters,{id:owner},'Only the exact fixture owner profile is permitted');
     return route.fulfill({json:{data:{role:'player'},error:null}});
    }
    assert.ok(['collection_items','collection_folders'].includes(body.table),'Only collection fixture reads');
    const data=body.table==='collection_items'?rows:[{id:folder,user_id:owner,name:'M6 P3 Magic Binder',binder_pages:2}];
    assert.equal(body.filters.user_id,owner);
    return route.fulfill({json:{data,count:data.length,error:null}});
   }
   if(u.origin===base&&u.pathname==='/api/tcg-magic-scryfall'){
    assert.equal(request.method(),'GET');assert.equal(u.search,'?set_code=m21&collector_number=1&language=EN');
    lookup.push({method:request.method(),path:u.pathname+u.search,response_sha256:fixtureSha});
    return route.fulfill({contentType:'application/json',headers:{'Cache-Control':'no-store'},body:response});
   }
   // The scanner runtime is not needed for manual COLLECT; the existing binder runs.
   if(u.origin===base&&u.pathname==='/scanner-v16-entry.js')return route.fulfill({contentType:'text/javascript',body:''});
   if(u.href.includes('/tesseract.'))return route.fulfill({contentType:'text/javascript',body:''});
   if(u.hostname==='fonts.googleapis.com'||u.hostname==='fonts.gstatic.com')return route.fulfill({contentType:'text/css',body:''});
   if(u.origin!==base||u.pathname.startsWith('/api/')){forbidden.push(request.method()+' '+u.origin+u.pathname);return route.abort();}
   return route.continue();
  });
  const ready=async()=>{
   await page.waitForFunction(()=>!!window.DV_COLLECT_READY);
   await page.evaluate(()=>window.DV_COLLECT_READY);
   await page.waitForFunction(folder=>collectionState()==='ready'&&window.DV_SCAN_V16_BINDER?.interactive===true&&activeFolder===folder,folder);
   await page.locator(`[data-folder="${folder}"]`).click();
  };
  for(const invalid of ['disabled','missing','expired','foreign']){
   mode=invalid;await page.goto(base+'/collect.html?binder='+folder);await ready();
   await page.click('#addCard');await page.locator('#cardDialog[open]').waitFor();
   await page.waitForFunction(()=>!DV_TCG_V1_CONSUMERS.games('collection').some(g=>g.game_key==='magic'));
   assert.equal(await page.locator('#tcg option[value="magic"]').count(),0);
   assert.equal(lookup.length,0);assert.equal(rpc.length,0);
   await page.click('#cancelDialog');check(`${width}: ${invalid} readiness closes new Magic`);
  }
  mode='enabled';await page.click('#addCard');await page.locator('#tcg option[value="magic"]').waitFor({state:'attached'});
  await page.selectOption('#tcg','magic');
  assert.equal(await page.locator('#language').inputValue(),'');assert.equal(await page.locator('#magicLanguage').inputValue(),'');
  await page.fill('#magicSetCode','m21');await page.fill('#magicCollector','1');await page.selectOption('#magicLanguage','EN');
  await page.click('#magicSearch');await page.waitForFunction(()=>document.getElementById('cardName').value==='Ugin, the Spirit Dragon');
  for(const [id,value] of Object.entries({cardName:candidate.name,setName:candidate.set,cardNumber:candidate.number,language:candidate.language,variant:candidate.variant,marketPrice:'',purchasePrice:''}))assert.equal(await page.locator('#'+id).inputValue(),value);
  assert.equal(await page.locator('#magicRarity').innerText(),'Rarity: mythic');assert.equal(await page.locator('#magicLookup img').count(),0);
  assert.equal(lookup.length,1);check(`${width}: explicit printing lookup replays exact live response into form`);
  await page.locator('#cardDialog').screenshot({path:resolve(out,`form-${width}.png`)});
  await page.click('#saveCard');await page.locator('#cardDialog').waitFor({state:'hidden'});
  await page.locator(`#slots [data-edit="${item}"]`).waitFor();assert.match(await page.locator('#rows').innerText(),/Ugin, the Spirit Dragon.*Core Set 2021/s);
  assert.match(await page.locator('#rows').innerText(),/Magic: The Gathering/);assert.equal(rpc.length,1);check(`${width}: manual Legacy RPC save displayed in COLLECT and own binder`);
  await page.reload();await ready();await page.locator(`#slots [data-edit="${item}"]`).waitFor();
  await page.locator(`#slots [data-edit="${item}"] .slotMeta strong`).click();
  assert.equal(await page.locator('#language').inputValue(),'EN');assert.equal(await page.locator('#cardNumber').inputValue(),'1');
  await page.fill('#quantity','2');await page.fill('#notes','M6 P3 fixture maintenance');await page.click('#saveCard');await page.locator('#cardDialog').waitFor({state:'hidden'});
  assert.equal(rows[0].quantity,2);assert.equal(rpc.length,2);check(`${width}: reloaded item edited through same Legacy RPC`);
  await page.locator(`[data-move="${item}"]`).click();await page.locator('#slots [data-page="1"][data-slot="3"]').click();
  await page.waitForFunction(()=>document.getElementById('binderMoveStatus').textContent==='Binderplatz gespeichert.');
  assert.equal(rpc.length,3);await page.reload();await ready();
  const placed=page.locator(`#slots [data-edit="${item}"][data-page="1"][data-slot="3"]`);await placed.waitFor();
  assert.equal(await placed.locator('.slotMeta strong').innerText(),candidate.name);
  await page.locator('#binderPage').screenshot({path:resolve(out,`binder-${width}.png`)});check(`${width}: actual binder move RPC survives reload at page 1 slot 3`);
  // Existing owned items remain visible while new Magic admission closes.
  mode='disabled';await page.reload();await ready();await placed.waitFor();
  await placed.locator('.slotMeta strong').click();await page.fill('#notes','M6 P3 beta OFF maintenance');await page.click('#saveCard');await page.locator('#cardDialog').waitFor({state:'hidden'});
  assert.equal(rpc.length,4);assert.equal(rows[0].notes,'M6 P3 beta OFF maintenance');assert.equal(rows[0].binder_page,1);assert.equal(rows[0].binder_slot,3);check(`${width}: existing own Magic item maintained through Legacy RPC with beta OFF`);
  await page.click('#addCard');
  assert.equal(await page.locator('#tcg option[value="magic"]').count(),0);await page.click('#cancelDialog');
  const boundary=await page.evaluate(()=>{
   const C=DV_TCG_V1_CONSUMERS,R=DV_TCG_V1_REGISTRY.get('magic');
   const closed={};for(const scope of ['scanner','marketplace','pricing','sealed','grading','battle']){try{C.requireGame('magic',scope);closed[scope]=false;}catch{closed[scope]=true;}}
   return {closed,scannerChoices:[...document.querySelectorAll('#tcgDialog .tcgPick [data-tcgscan]')].map(button=>button.dataset.tcgscan),magicScannerCount:document.querySelectorAll('#tcgDialog .tcgPick [data-tcgscan="magic"]').length,manual:C.games('collection').map(g=>g.game_key),capabilities:R.capabilities};
  });
  assert.ok(Object.values(boundary.closed).every(Boolean));assert.deepEqual(boundary.scannerChoices,['pokemon','one_piece']);assert.equal(boundary.magicScannerCount,0);
  assert.deepEqual(boundary.manual,['pokemon','one_piece']);
  for(const scope of ['pricing','sealed','grading','battle'])assert.equal(boundary.capabilities[scope].status,'unsupported');
  const lookupsBefore=lookup.length;await page.click('#refreshPrices');await page.waitForFunction(()=>!document.getElementById('refreshPrices').disabled);
  assert.equal(lookup.length,lookupsBefore);assert.equal(rows[0].market_price,null);check(`${width}: beta OFF, scanner marketplace pricing sealed grading battle closed`);
  assert.deepEqual(errors,[]);assert.ok(readinessCalls>=10);assert.deepEqual(forbidden,[]);
  assert.deepEqual(rpc.map(call=>call.name),['save_my_tcg_collection_item_v1','save_my_tcg_collection_item_v1','dv_collect_move_card','save_my_tcg_collection_item_v1']);
  replays.push({owner,folder_id:folder,browser_item_id:item,fixture_sha256:fixtureSha,lookup,rpc,insert_save_payload:rpc[0].args,edit_save_payload:rpc[1].args,binder_move:rpc[2].args,beta_off_edit_payload:rpc[3].args,readback:structuredClone(rows[0])});
  await context.close();
 }
 assert.deepEqual(replays[0],replays[1],'Both real viewports generate the same deterministic payload and operations');
 const bytes=Buffer.from(JSON.stringify(replays[0],null,2)+'\n');
 await writeFile(resolve(out,'browser-payload.json'),bytes);
 report.payload={path:'test-results/tcg-i3-m6-p3/browser-payload.json',sha256:sha(bytes),save_keys:keys.length};
 report.forbidden_external_io_attempts=forbidden;report.passed=true;
 console.log('PASS P3 manual Magic vertical browser fixtures; actual captured RPC SHA256',report.payload.sha256);
}catch(error){report.error={message:error.message,stack:error.stack};process.exitCode=1;console.error(error);}
finally{await browser.close();await new Promise(r=>server.close(r));await writeFile(resolve(out,'browser-report.json'),JSON.stringify(report,null,2)+'\n');}
