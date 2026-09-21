import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {chromium} from 'playwright';
const root=resolve(import.meta.dirname,'..');
const server=createServer(async(req,res)=>{try{const p=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!p.startsWith(root+'/'))throw Error();res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'})[extname(p)]||'text/plain');res.end(await readFile(p))}catch{res.writeHead(404);res.end()}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true});
await mkdir(resolve(root,'test-results'),{recursive:true});
const card=(id,purchase_price,market_price,quantity=2)=>({id,card_name:'Fixture '+id,tcg:'pokemon',condition:'NM',quantity,purchase_price,market_price,folder_id:'own',grading_company:id==='graded'?'PSA':null,binder_page:id==='graded'?2:1,binder_slot:1});
const cases={empty:[],missing:[card('raw',null,null),card('graded',null,null)],mixed:[card('raw',4,10),card('graded',null,null)],known:[card('raw',4,10,3),card('graded',1,2,2)],zero:[card('raw',0,0,3),card('graded',0,0)],partial:[card('raw',null,10)]};
const measured=[];
try{
 for(const width of [1363,390]){
  const page=await browser.newPage({viewport:{width,height:844}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  let rows=[],mode='ready',releases=[];
  await page.route('**/*',async route=>{
   const u=route.request().url();
   if(u===base+'/api/compliance-message-dispatch?runtime_config=1')return route.fulfill({contentType:'text/javascript',body:'window.DV_SUPABASE={url:"https://xhmjxrcskfhbovhitdej.supabase.co",key:"fixture-only",environment:"preview"}'});
   if(u.startsWith('https://cdn.jsdelivr.net/npm/@supabase/supabase-js'))return route.fulfill({contentType:'text/javascript',body:`window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:{user:{id:'fixture-user'}}}}),onAuthStateChange:()=>({})},from:table=>{const q={select:()=>q,eq:()=>q,order:()=>q,single:async()=>({data:{role:'player'}}),then:(a,b)=>fetch('/fixture?table='+table).then(r=>r.json()).then(a,b)};return q},storage:{from:()=>({createSignedUrl:async()=>({data:{}})})}})}`});
   if(u.startsWith(base+'/fixture?')){if(mode==='loading')await new Promise(r=>releases.push(r));return route.fulfill({json:mode==='error'?{error:{message:'fixture load failure'}}:{data:u.includes('collection_folders')?[{id:'own',name:'Fixture Binder',binder_pages:2},{id:'empty',name:'Empty Binder',binder_pages:2}]:rows}})}
   if(u.includes('/scanner-v16-entry.js')||u.includes('/tesseract.'))return route.fulfill({contentType:'text/javascript',body:''});
   if(!u.startsWith(base+'/'))return route.abort();
   return route.continue();
  });
  for(const [name,data] of Object.entries(cases)){
   console.log('Fixture',width,name);rows=data;mode='ready';await page.goto(base+'/collect.html');await page.waitForFunction(()=>collectionState()==='ready'&&window.DV_SCAN_V16_BINDER?.interactive);
   assert.equal(await page.evaluate(()=>innerWidth),width);
   const expected=name==='empty'?'—':name==='missing'?'Nicht bewertet':name==='zero'?'0,00':name==='known'?'34,00':'20,00';
   assert.ok((await page.locator('#statValue').innerText()).includes(expected),name);
   assert.equal(await page.locator('#statPnl').innerText(),name==='known'?'20,00 €':name==='zero'?'0,00 €':'—');
   if(name==='mixed')assert.match(await page.locator('#statValueNote').innerText(),/unvollständig/);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${name}: horizontal overflow ${width}`);
   for(const scope of ['', '__graded__','own','empty']){
    await page.locator(`[data-folder="${scope}"]`).click();
    const count=scope==='empty'?0:scope==='__graded__'?rows.filter(x=>x.grading_company).length:rows.length;
    for(const view of ['list','binder']){
     await page.locator('#'+view+'View').click();
     if(!count)assert.match(await page.locator('#empty').innerText(),/Noch keine/);
     for(const [selector,value] of [['#search','no-match'],['#tcgFilter','one_piece'],['#gradeFilter',scope==='__graded__'?'raw':'graded']]){
      if(selector==='#search')await page.locator(selector).fill(value);else await page.locator(selector).selectOption(value);
      const matches=await page.evaluate(()=>filtered().length);
      if(count&&!matches)assert.match(await page.locator('#empty').innerText(),/Suche oder Filter/);
      if(!count)assert.match(await page.locator('#empty').innerText(),/Noch keine/);
      if(selector==='#search')await page.locator(selector).fill('');else await page.locator(selector).selectOption('');
      assert.equal(await page.evaluate(()=>filtered().length),count,'reset restores cards');
     }
    }
   }
   await page.locator('[data-folder="own"]').click();
   if(name==='known'){
    await page.locator('#nextPage').click();assert.match(await page.locator('#pageDots').innerText(),/Seite 2/);assert.equal(await page.locator('[data-card-id="graded"]').count(),1);
    await page.locator('#prevPage').click();assert.equal(await page.locator('[data-card-id="raw"]').count(),1);
   }
   if(name==='mixed'||name==='missing'){
    await page.locator('[data-folder=""]').click();await page.locator('#listView').click();await page.screenshot({path:resolve(root,`test-results/collect-ux-${width}-${name}.png`),fullPage:true});
   }
  }
  // Initial failure and rejected request must not claim empty inventory.
  mode='error';await page.reload();await page.waitForFunction(()=>collectionState()==='error');assert.match(await page.locator('#empty').innerText(),/nicht vollständig geladen/);assert.equal(await page.locator('#statValue').innerText(),'—');
  mode='loading';const navigation=page.reload({waitUntil:'domcontentloaded'});await navigation;assert.match(await page.locator('#empty').innerText(),/wird geladen/);mode='ready';for(const release of releases)release();releases=[];await page.waitForFunction(()=>collectionState()==='ready');
  measured.push({width:await page.evaluate(()=>innerWidth),height:await page.evaluate(()=>innerHeight)});
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log('PASS COLLECT F1/F2 browser matrix',JSON.stringify({browser:browser.version(),viewports:measured,network:'fixture-only; external requests blocked'}));
}finally{await browser.close();await new Promise(r=>server.close(r))}
