import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {chromium,webkit} from 'playwright';
const root=resolve(import.meta.dirname,'..'),baseline=process.env.COLLECT_UI_BASELINE==='1';
const server=createServer(async(req,res)=>{try{const p=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!p.startsWith(root+'/'))throw Error();res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'})[extname(p)]||'text/plain');res.end(await readFile(p))}catch{res.writeHead(404);res.end()}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`,results=[];
await mkdir(resolve(root,'test-results'),{recursive:true});
const rows=Array.from({length:6},(_,i)=>({id:'card-'+i,card_name:['B07 Pickup Order Chat Testkarte Verkäufer','Karte mit Bild','Karte Bildfehler'][i%3],card_number:'TEST-'+i,tcg:'pokemon',condition:'NM',quantity:2,purchase_price:null,market_price:i%3===0?2:null,folder_id:'own',grading_company:i>=3?'PSA':null,grade:i>=3?9:null,binder_page:1,binder_slot:i+1,image_path:[null,'valid.png','broken.png'][i%3]}));
const engines=process.env.COLLECT_UI_ENGINES?.split(',')||['chromium'];
try{for(const engine of engines){
 const browser=await ({chromium,webkit}[engine]).launch({headless:true});
 try{for(const width of [1363,390,430]){
  const page=await browser.newPage({viewport:{width,height:844},reducedMotion:'reduce'}),errors=[],writes=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
   const req=route.request(),u=req.url();
   if(req.method()!=='GET'){writes.push(req.method()+' '+new URL(u).pathname);return route.abort()}
   if(u===base+'/api/compliance-message-dispatch?runtime_config=1')return route.fulfill({contentType:'text/javascript',body:'window.DV_SUPABASE={url:"https://xhmjxrcskfhbovhitdej.supabase.co",key:"fixture-only",environment:"preview"}'});
   if(u.startsWith('https://cdn.jsdelivr.net/npm/@supabase/supabase-js'))return route.fulfill({contentType:'text/javascript',body:`window.fixtureWrites=[];window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:{user:{id:'fixture-user'}}}}),onAuthStateChange:()=>({})},from:table=>{const q={select:()=>q,eq:()=>q,order:()=>q,single:async()=>({data:{role:'player'}}),update:()=>{window.fixtureWrites.push('update');throw Error('unexpected write')},insert:()=>{window.fixtureWrites.push('insert');throw Error('unexpected write')},delete:()=>{window.fixtureWrites.push('delete');throw Error('unexpected write')},then:(a,b)=>fetch('/fixture?table='+table).then(r=>r.json()).then(a,b)};return q},storage:{from:()=>({createSignedUrl:async path=>({data:{signedUrl:'/fixture-image/'+path}})})}})}`});
   if(u.startsWith(base+'/fixture?'))return route.fulfill({json:{data:u.includes('collection_folders')?[{id:'own',name:'Fixture Binder',binder_pages:2}]:rows}});
   if(u===base+'/fixture-image/valid.png')return route.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jGqkAAAAASUVORK5CYII=','base64')});
   if(u===base+'/fixture-image/broken.png')return route.fulfill({status:404,body:'fixture image unavailable'});
   if(u.includes('/scanner-v16-entry.js')||u.includes('/tesseract.'))return route.fulfill({contentType:'text/javascript',body:''});
   if(!u.startsWith(base+'/'))return route.abort();
   return route.continue();
  });
  await page.goto(base+'/collect.html');await page.waitForFunction(()=>collectionState()==='ready'&&window.DV_SCAN_V16_BINDER?.interactive);
  const price=await page.locator('#statInvest').evaluate(el=>{
   const t=el.firstChild,words=t.textContent.split(' ');let offset=0;return {text:el.textContent,font:getComputedStyle(el).fontSize,width:el.clientWidth,words:words.map(word=>{const r=document.createRange();r.setStart(t,offset);r.setEnd(t,offset+word.length);offset+=word.length+1;return {word,lines:r.getClientRects().length}})};
  });
  const slots=[];
  for(const scope of ['','__graded__','own']){
   await page.locator(`[data-folder="${scope}"]`).click();
   await page.waitForFunction(()=>[...document.querySelectorAll('#slots img')].every(e=>e.complete));
   const data=await page.locator('#slots .hasCard').evaluateAll(es=>es.map(e=>{const f=e.querySelector('.slotMeta'),img=e.querySelector('img'),meta=e.querySelector('.slotMeta');return {name:e.textContent,hasImage:!!img,imagePath:img?.dataset.imgpath,imageLoaded:!!img?.naturalWidth,fallbackVisible:!e.classList.contains('imageReady')&&getComputedStyle(f).display!=='none',metaVisible:getComputedStyle(meta).display!=='none',fallbackFits:!f||getComputedStyle(f).overflowY==='auto'||(f.scrollHeight<=f.clientHeight&&f.scrollWidth<=f.clientWidth)}}));
   slots.push({scope,cards:data});
   if(!baseline)for(const c of data){if(c.imagePath==='valid.png')assert.equal(c.imageLoaded,true,'valid image preserved');if(c.imagePath==='broken.png')assert.equal(c.imageLoaded,false,'broken-image fixture');assert.equal(c.fallbackVisible,!c.imageLoaded,`${engine}/${width}/${scope}: fallback`);assert.equal(c.fallbackFits,true,'fallback must fit slot')}
   if(!baseline){
    await page.locator('#slots .hasCard .slotMeta strong').first().click();assert.equal(await page.locator('#cardDialog').isVisible(),true);await page.locator('#cancelDialog').click();
    const overlap=await page.locator('#slots .hasCard:not(.imageReady)').evaluateAll(es=>es.some(e=>{const text=e.querySelector('.slotMeta').getBoundingClientRect(),move=e.querySelector('.slotMove')?.getBoundingClientRect(),price=e.querySelector('.slotPrice')?.getBoundingClientRect();return (move&&text.bottom>move.top)||(price&&text.top<price.bottom)}));assert.equal(overlap,false,'fallback overlaps price or move action');
    if(scope==='own')await page.screenshot({path:resolve(root,`test-results/collect-mobile-${engine}-${width}-own-binder.png`),fullPage:true});
   }
   if(scope==='own'&&!baseline){assert.equal(await page.locator('[data-card-id="card-0"][data-page="1"][data-slot="1"]').count(),1);await page.locator('#nextPage').click();assert.match(await page.locator('#pageDots').innerText(),/Seite 2/);await page.locator('#prevPage').click();assert.equal(await page.locator('[data-card-id="card-0"]').count(),1)}
  }
  await page.locator('[data-folder=""]').click();
  if(!baseline)await page.screenshot({path:resolve(root,`test-results/collect-mobile-${engine}-${width}-binder.png`),fullPage:true});
  await page.locator('#listView').click();
  const labels=await page.locator('#rows tr').first().locator('td').evaluateAll(es=>es.map(e=>({label:e.dataset.label||'',content:getComputedStyle(e,'::before').content,display:getComputedStyle(e,'::before').display})));
  if(!baseline){
   assert.equal(price.words.every(w=>w.lines===1),true,'status words must not split');
   for(const label of ['Zustand / Grading','Menge','Kaufpreis','Referenzwert','Gewinn / Verlust']){const cell=labels.find(x=>x.label===label);assert.ok(cell);if(width<850)assert.equal(cell.content,JSON.stringify(label));else assert.ok(cell.content==='none'||cell.content==='normal')}
   await page.screenshot({path:resolve(root,`test-results/collect-mobile-${engine}-${width}-list.png`),fullPage:true});
  }
  await page.locator('#rows [data-edit="card-0"]').click();
  const measure=()=>page.locator('#cardDialog').evaluate(d=>({width:d.getBoundingClientRect().width,client:d.clientWidth,scroll:d.scrollWidth,height:d.clientHeight,scrollHeight:d.scrollHeight,viewport:{width:innerWidth,height:innerHeight,scale:visualViewport.scale},fields:[...d.querySelectorAll('input,select,textarea')].map(e=>({id:e.id,font:getComputedStyle(e).fontSize,width:e.getBoundingClientRect().width,parent:e.parentElement.getBoundingClientRect().width,scroll:e.scrollWidth,client:e.clientWidth}))}));
  const before=await measure();await page.locator('#cardName').click();const focused=await measure();await page.locator('#cardName').press('Tab');const afterFocus=await measure();
  await page.locator('#purchaseDate').fill('2026-09-21');const date=await page.locator('#purchaseDate').boundingBox();
  await page.locator('#cardName').fill('Unsaved fixture edit');
  // Reach bottom by normal vertical scrolling, with no fixed action bar or zoom reset.
  await page.locator('#cardDialog').evaluate(d=>d.scrollTop=d.scrollHeight);
  const actions=await page.locator('#cardDialog .modalFoot').evaluate(e=>{const r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,visible:r.top>=0&&r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth}});
  if(!baseline){assert.equal(before.viewport.width,width);assert.equal(focused.viewport.scale,1);assert.equal(afterFocus.viewport.scale,1);assert.equal(afterFocus.width,before.width);assert.doesNotMatch(await page.locator('meta[name=viewport]').getAttribute('content'),/user-scalable\s*=\s*no|maximum-scale/i);assert.equal(before.scroll<=before.client+1,true,'dialog overflow');assert.equal(focused.scroll<=focused.client+1,true,'focused dialog overflow');for(const f of focused.fields){assert.ok(f.width<=f.parent+1,`field overflow ${f.id}`);if(width<850)assert.ok(parseFloat(f.font)>=16,`small font ${f.id}`)}assert.ok(date.x+date.width<=width);assert.equal(actions.visible,true,'actions reachable by vertical scroll');await page.screenshot({path:resolve(root,`test-results/collect-mobile-${engine}-${width}-dialog.png`)});}
  await page.locator('#cancelDialog').click();assert.equal(await page.locator('#cardDialog').isVisible(),false);assert.equal(await page.locator('#rows tr').count(),6);assert.equal(await page.locator('#rows').innerText().then(t=>t.includes('Unsaved fixture edit')),false);
  assert.deepEqual(await page.evaluate(()=>window.fixtureWrites),[]);assert.deepEqual(writes,[]);assert.deepEqual(errors,[]);
  results.push({engine,version:browser.version(),width,price,slots,labels,before,focused,afterFocus,actions});console.log(`${baseline?'MEASURE':'PASS'} mobile UI ${engine} ${width}x844; writes=0`);
  await page.close();
 }}finally{await browser.close()}
}}finally{await server.close()}
await writeFile(resolve(root,`test-results/collect-mobile-${baseline?'baseline':'results'}.json`),JSON.stringify(results,null,2));
