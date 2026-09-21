import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {chromium} from 'playwright';
const root=resolve(import.meta.dirname,'..');
const server=createServer(async(req,res)=>{try{const p=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!p.startsWith(root+'/'))throw Error();res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'})[extname(p)]||'text/plain');res.end(await readFile(p))}catch{res.writeHead(404);res.end()}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch({headless:true}),measurements=[];
await mkdir(resolve(root,'test-results'),{recursive:true});
try{
 for(const width of [1363,390,430]){
  const page=await browser.newPage({viewport:{width,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const name='<img src=x onerror=alert(1)> & „F3“';
  let folders,rows,rpcCalls=0,mode='success',pendingResolve,loadMode='ready',loadRelease;
  const reset=()=>{folders=[{id:'empty',name,user_id:'fixture-user',binder_pages:2},{id:'occupied',name:'Occupied',user_id:'fixture-user',binder_pages:2}];rows=[{id:'card',user_id:'fixture-user',folder_id:'occupied',card_name:'F3 Card',tcg:'pokemon',quantity:1,binder_page:2,binder_slot:3}];loadMode='ready';mode='success'};
  reset();
  await page.route('**/*',async route=>{
   const u=route.request().url();
   if(u===base+'/api/compliance-message-dispatch?runtime_config=1')return route.fulfill({contentType:'text/javascript',body:'window.DV_SUPABASE={url:"https://xhmjxrcskfhbovhitdej.supabase.co",key:"fixture-only",environment:"preview"}'});
   if(u.startsWith('https://cdn.jsdelivr.net/npm/@supabase/supabase-js'))return route.fulfill({contentType:'text/javascript',body:`window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:{user:{id:'fixture-user'}}}}),onAuthStateChange:()=>({})},rpc:(name,args)=>fetch('/fixture-rpc',{method:'POST',body:JSON.stringify({name,args})}).then(r=>r.json()),from:table=>{const q={select:()=>q,eq:()=>q,order:()=>q,single:async()=>({data:{role:'player'}}),then:(a,b)=>fetch('/fixture?table='+table).then(r=>r.json()).then(a,b)};return q},storage:{from:()=>({createSignedUrl:async()=>({data:{}})})}})}`});
   if(u===base+'/fixture-rpc'){
    rpcCalls++;const body=route.request().postDataJSON();assert.equal(body.name,'dv_collect_delete_empty_binder');assert.equal(body.args.p_folder_id,'empty');
    if(mode==='pending')await new Promise(r=>pendingResolve=r);
    if(mode==='nonempty'){rows.push({id:'new-card',folder_id:'empty',card_name:'Concurrent fixture',quantity:1});return route.fulfill({json:{error:{message:'binder_not_empty'}}})}
    if(mode==='error')return route.fulfill({json:{error:{message:'server_failed'}}});
    if(mode==='network')return route.abort();
    if(mode==='lost-success'){folders=folders.filter(f=>f.id!=='empty');return route.abort()}
    if(mode==='unavailable')return route.fulfill({json:{data:{status:'unavailable'}}});
    if(mode==='unknown')return route.fulfill({json:{data:{}}});
    folders=folders.filter(f=>f.id!=='empty');
    return route.fulfill({json:{data:{status:'deleted'}}});
   }
   if(u.startsWith(base+'/fixture?')){
    if(loadMode==='loading')await new Promise(r=>loadRelease=r);
    const data=u.includes('collection_folders')?folders:rows;
    return route.fulfill({json:loadMode==='error'?{error:{message:'load_failed'}}:{data,count:loadMode==='partial'&&u.includes('collection_items')?1001:data.length}});
   }
   if(u.includes('/scanner-v16-entry.js')||u.includes('/tesseract.'))return route.fulfill({contentType:'text/javascript',body:''});
   if(!u.startsWith(base+'/'))return route.abort();return route.continue();
  });
  const open=async()=>{await page.locator('[data-folder="empty"]').click();await page.locator('#deleteBinder').click();await page.locator('#deleteBinderDialog').waitFor({state:'visible'})};
  const ready=()=>page.waitForFunction(()=>collectionState()==='ready'&&window.DV_SCAN_V16_BINDER?.interactive);
  await page.goto(base+'/collect.html');await ready();
  assert.equal(await page.evaluate(()=>innerWidth),width);
  for(const scope of ['','__graded__']){await page.locator(`[data-folder="${scope}"]`).click();assert.equal(await page.locator('#deleteBinder').isVisible(),false)}
  await page.locator('[data-folder="occupied"]').click();assert.equal(await page.locator('#deleteBinder').isDisabled(),true);
  await page.locator('#search').fill('no-such-card');assert.equal(await page.locator('#deleteBinder').isDisabled(),true);assert.match(await page.locator('#deleteBinderHint').innerText(),/Nur leere Binder/);await page.locator('#search').fill('');
  await open();assert.equal(await page.locator('#deleteBinderQuestion').innerText(),`Leeren Binder ‚${name}‘ löschen?`);assert.equal(await page.locator('#deleteBinderQuestion img').count(),0);
  assert.equal(await page.evaluate(()=>document.querySelector('#deleteBinderDialog').scrollWidth<=document.querySelector('#deleteBinderDialog').clientWidth),true);
  for(const id of ['cancelDeleteBinder','confirmDeleteBinder']){await page.locator('#'+id).scrollIntoViewIfNeeded();const box=await page.locator('#'+id).boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width&&box.y+box.height<=844)}
  await page.screenshot({path:resolve(root,`test-results/collect-f3-${width}-confirm.png`)});
  await page.locator('#cancelDeleteBinder').click();assert.equal(rpcCalls,0);
  await open();await page.keyboard.press('Escape');assert.equal(rpcCalls,0);
  for(const failure of ['nonempty','error','network','lost-success','unavailable','unknown']){
   reset();mode=failure;await page.reload();await ready();await open();const calls=rpcCalls;await page.locator('#confirmDeleteBinder').click();await page.waitForFunction(()=>!deletingBinder);
   assert.equal(rpcCalls,calls+1);assert.doesNotMatch(await page.locator('#binderDeleteStatus').innerText(),/^Binder gelöscht/);
   assert.equal(await page.locator('[data-folder="empty"]').count(),failure==='lost-success'?0:1);
   if(failure==='nonempty'){assert.match(await page.locator('#binderDeleteStatus').innerText(),/Nur leere Binder/);assert.equal(await page.locator('#deleteBinder').isDisabled(),true)}
  }
  reset();await page.reload();await ready();await page.locator('[data-folder="empty"]').click();
  loadMode='loading';await page.evaluate(()=>{void loadItems()});await page.waitForFunction(()=>itemsLoadState==='loading');assert.equal(await page.locator('#deleteBinder').isDisabled(),true);loadMode='ready';loadRelease();await ready();
  for(const partial of ['partial','error']){loadMode=partial;await page.evaluate(()=>loadItems());assert.equal(await page.locator('#deleteBinder').isDisabled(),true)}
  loadMode='ready';await page.evaluate(()=>loadItems());await ready();
  mode='pending';await page.goto(base+'/collect.html?binder=empty&page=1');await ready();await page.waitForFunction(()=>activeFolder==='empty');await page.evaluate(()=>{pendingScanFolder='empty';document.getElementById('folderId').value='empty';document.getElementById('scanFolder').value='empty'});await open();const calls=rpcCalls;
  await page.evaluate(()=>{const b=document.getElementById('confirmDeleteBinder');b.click();b.click()});await page.waitForFunction(()=>deletingBinder);
  assert.equal(await page.locator('#confirmDeleteBinder').isDisabled(),true);assert.equal(await page.locator('#cancelDeleteBinder').isDisabled(),true);
  while(!pendingResolve)await new Promise(r=>setTimeout(r,10));assert.equal(rpcCalls,calls+1);pendingResolve();await page.waitForFunction(()=>!deletingBinder);
  assert.match(await page.locator('#binderDeleteStatus').innerText(),/^Binder gelöscht/);assert.equal(await page.locator('#workspaceName').innerText(),'Master Collection');
  assert.equal(await page.locator('[data-folder="empty"]').count(),0);assert.equal(await page.locator('#folderId option[value="empty"],#scanFolder option[value="empty"]').count(),0);
  assert.equal(await page.evaluate(()=>page),0);assert.equal(await page.evaluate(()=>pendingScanFolder),null);assert.equal(new URL(page.url()).searchParams.has('page'),false);
  assert.equal(new URL(page.url()).searchParams.has('binder'),false);
  await page.reload();await ready();assert.equal(await page.locator('[data-folder="empty"]').count(),0);
  assert.equal(await page.locator('button button').count(),0);assert.deepEqual(errors,[]);
  measurements.push({width:await page.evaluate(()=>innerWidth),height:await page.evaluate(()=>innerHeight)});await page.close();
 }
 const result={engine:browser.version(),viewports:measurements,network:'local fixtures only',dbConcurrency:'NOT TESTED'};
 await writeFile(resolve(root,'test-results/collect-f3-browser.json'),JSON.stringify(result,null,2));console.log('PASS F3 browser fixtures',JSON.stringify(result));
}finally{await browser.close();await new Promise(r=>server.close(r))}
