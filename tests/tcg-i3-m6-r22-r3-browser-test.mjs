// Synthetic component E2E: real COLLECT/V16 scripts, decoded images and geometry.
// Only external services and Tesseract observations are deterministic fakes.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {chromium} from 'playwright';
const root=resolve(new URL('..',import.meta.url).pathname),out=resolve(root,'test-results/tcg-i3-m6-r22-r3');
await mkdir(out,{recursive:true});
const server=createServer(async(req,res)=>{try{const p=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!p.startsWith(root+sep))throw Error();const b=await readFile(p);res.writeHead(200,{'Content-Type':({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'})[extname(p)]||'application/octet-stream'});res.end(b)}catch{res.writeHead(404);res.end()}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
const errors=[],provider=[],forbidden=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
const A='10000000-0000-4000-8000-000000000001',F='20000000-0000-4000-8000-000000000002';
await page.route('**/*',async route=>{
 const url=route.request().url();
 if(url.startsWith(base))return route.continue();
 if(url.includes('supabase-js@2'))return route.fulfill({contentType:'text/javascript',body:`
 window.testMagic={admitted:true,placementReady:true,rows:[],calls:[],texts:[],ocr:[],failSave:0,failPlace:false};
 window.supabase={createClient:()=>{const t=testMagic,user={id:'${A}'};return {
 auth:{getSession:async()=>({data:{session:{user,access_token:'SYNTHETIC'}}}),onAuthStateChange(){},signOut:async()=>{}},
 rpc:async(name,args)=>{t.calls.push({name,args});
 if(name==='get_magic_on_demand_collection_beta_v1')return {data:{contract:'magic-on-demand-collect-beta/1',user_id:user.id,magic_on_demand_collection_beta:t.admitted,checked_at:new Date().toISOString()}};
 if(name==='get_magic_scan_placement_ready_v1')return {data:t.placementReady};
 if(name==='save_my_tcg_collection_item_v1'){
 if(!t.admitted)return {error:{message:'admission expired'}};
 if(t.failSave&&t.calls.filter(c=>c.name===name).length===t.failSave)return {error:{message:'synthetic save failure'}};
 await new Promise(r=>setTimeout(r,30));const id=args.p_item_id||crypto.randomUUID(),old=t.rows.find(x=>x.id===id);if(old)Object.assign(old,args.p_item);else t.rows.push({...args.p_item,id,user_id:user.id,tcg:'magic'});return {data:id};}
 if(name==='place_my_magic_scan_item_v1'){if(t.failPlace)return {error:{message:'synthetic placement failure'}};const x=t.rows.find(x=>x.id===args.p_item_id);if(t.rows.some(r=>r.id!==x.id&&r.folder_id===args.p_folder_id&&r.binder_page===args.p_page&&r.binder_slot===args.p_slot))return {error:{message:'occupied'}};Object.assign(x,{folder_id:args.p_folder_id,binder_page:args.p_page,binder_slot:args.p_slot});return {data:true};}
 return {data:null};},
 from:table=>{let op='select',payload,filters={};const q={select:()=>q,order:()=>q,limit:()=>q,eq:(k,v)=>(filters[k]=v,q),is:(k,v)=>(filters[k]=v,q),single:()=>q,update:p=>(op='update',payload=p,q),insert:p=>(op='insert',payload=p,q),then:(yes,no)=>Promise.resolve().then(()=>{
 if(op!=='select')throw Error('Forbidden direct mutation '+table);
 const rows=table==='collection_items'?t.rows:table==='collection_folders'?[{id:'${F}',user_id:user.id,name:'Synthetic Binder',binder_pages:2}]:[];
 return {data:rows.filter(x=>Object.entries(filters).every(([k,v])=>x[k]===v))};}).then(yes,no)};return q;},
 storage:{from:()=>({upload:async()=>{throw Error('Forbidden raw upload')},createSignedUrl:async()=>({data:{signedUrl:''}})})}
 }}};`});
 if(url.includes('tesseract.min.js'))return route.fulfill({contentType:'text/javascript',body:`window.Tesseract={createWorker:async()=>({setParameters:async()=>{},terminate(){},recognize:async canvas=>{const p=canvas.getContext('2d').getImageData(Math.floor(canvas.width/2),Math.floor(canvas.height/2),1,1).data;const index=Math.round(p[0]/20)-1;testMagic.ocr.push({index,width:canvas.width,height:canvas.height});return {data:{text:testMagic.texts[index]||''}}}})};`});
 if(url.includes('fonts.googleapis'))return route.fulfill({contentType:'text/css',body:''});
 forbidden.push(url);return route.abort();
});
await page.route(base+'/api/compliance-message-dispatch?runtime_config=1',r=>r.fulfill({contentType:'text/javascript',body:'window.DV_SUPABASE={url:"https://synthetic.invalid",key:"synthetic-only"};'}));
await page.route(base+'/api/scanner-v16-recognize',r=>{if(r.request().method()!=='GET')forbidden.push(r.request().url());return r.fulfill({contentType:'application/json',body:'{"active":false}'});});
await page.route(base+'/api/tcg-magic-scryfall?**',async r=>{
 const u=new URL(r.request().url());provider.push(Object.fromEntries(u.searchParams));assert.equal(r.request().headers().authorization,'Bearer SYNTHETIC');
 if(await page.evaluate(()=>testMagic.quota))return r.fulfill({status:429,contentType:'application/json',body:'{"status":"quota"}'});
 const set=u.searchParams.get('set_code'),number=u.searchParams.get('collector_number'),id='12345678-1234-4234-8234-123456789abc';
 return r.fulfill({contentType:'application/json',body:JSON.stringify({status:'candidates',candidate:{tcg:'magic',name:set==='DSK'?'Abhorrent Oculus':'High Perfect Morcant',set,number:number.replace(/^0+/,''),language:'EN',variant:'regular',rarity:'mythic',provider_ref:{external_id:id},image_url:`https://cards.scryfall.io/normal/front/1/2/${id}.jpg`}})});
});
const textDSK='M 0344 … 5/5\nDSK * EN',textECL='R 0373 … 4/4\nECL *#EN » Victor ADAME MINGULZ ME 2026';
const count=()=>page.locator('[data-magic-row]').count();
const row=n=>page.locator(`[data-magic-row="${n}"]`);
async function scan(mode,layout,texts,{blank=false}={}){
 await page.locator(`[data-v16-mode="${mode}"]`).click();if(mode==='multi')await page.selectOption('#dvV16Layout',layout);
 const data=await page.evaluate(({mode,layout,texts,blank})=>{
  testMagic.texts=texts;const c=document.createElement('canvas'),x=c.getContext('2d'),single=['single','continuous'].includes(mode),cols=single?1:Number(layout[0]||3),rows=single?1:Number(layout[2]||3);
  c.width=single?630:1200;c.height=single?880:1200;x.fillStyle='#050505';x.fillRect(0,0,c.width,c.height);
  if(!blank){const outer=mode==='binder'?.035:single?0:.035,gap=mode==='binder'?.018:single?0:.025;
   const cw=(c.width*(1-2*outer)-c.width*gap*(cols-1))/cols,ch=(c.height*(1-2*outer)-c.height*gap*(rows-1))/rows;
   for(let i=0;i<cols*rows;i++){const w=Math.min(cw,ch*63/88),h=w*88/63,px=c.width*outer+(i%cols)*(cw+c.width*gap)+(cw-w)/2,py=c.height*outer+Math.floor(i/cols)*(ch+c.height*gap)+(ch-h)/2;
    x.fillStyle='rgb('+((i+1)*20)+',40,80)';x.fillRect(px,py,w,h);x.fillStyle='white';x.font='14px sans-serif';x.fillText('SYNTHETIC '+(i+1),px+5,py+30);
   }}return c.toDataURL('image/png').split(',')[1];
 },{mode,layout:layout==='auto'?'2x2':layout||'3x3',texts,blank});
 await page.locator('#dvV16GalleryFile').setInputFiles({name:'synthetic-'+mode+'-'+layout+'.png',mimeType:'image/png',buffer:Buffer.from(data,'base64')});
 await page.waitForFunction(()=>['result','error'].includes(DV_SCAN_V16.controller.state));
 return data;
}
async function confirm(n){await row(n).locator('[data-magic-action="confirm-search"]').click();await page.waitForFunction(n=>!DV_SCAN_V16.batch[n].busy,n);}
async function chooseNew(n){const choice=row(n).locator('[data-magic-save-action]');if(await choice.count())await choice.selectOption('new');}
async function resolveRow(n){await confirm(n);await page.waitForFunction(n=>!!DV_SCAN_V16.batch[n].best,n);await chooseNew(n);await row(n).locator('[data-magic-action="select"]').click();await page.waitForFunction(n=>DV_SCAN_V16.batch[n].selected,n);}
const cases=[];
try{
 await page.goto(base+'/collect.html');await page.waitForFunction(()=>window.__DV_V16_READY&&window.DV_COLLECT_READY);
 await page.click('#scanCard');await page.selectOption('#dvV16Tcg','magic');
 assert.equal(await page.locator('#magicCameraLaunch').count(),0);assert.equal(await page.locator('#magicCameraDialog').count(),0);
 assert.equal(await page.evaluate(()=>DV_TCG_V1_CONSUMERS.games('scanner').some(x=>x.game_key==='magic')),false);
 await scan('single','',[textDSK]);await scan('single','',[textECL]);assert.equal(await count(),2);
 assert.deepEqual(await page.evaluate(()=>DV_SCAN_V16.batch.map(r=>r.values)),[{set_code:'DSK',collector_number:'0344',language:'EN'},{set_code:'ECL',collector_number:'0373',language:'EN'}]);
 assert.equal(provider.length,0);cases.push('KARTE: DSK 0344 EN + ECL 0373 EN, immutable independent raw, zero provider requests');
 await page.click('#dvV16Reset');await scan('continuous','',[textDSK]);await scan('continuous','',[textECL]);assert.equal(await count(),2);
 await resolveRow(0);await resolveRow(1);assert.equal(provider.length,2);
 await page.evaluate(()=>{document.getElementById('dvV16ImportBtn').click();document.getElementById('dvV16ImportBtn').click()});
 await page.waitForFunction(()=>DV_SCAN_V16.batch.every(r=>r.savedId));assert.equal(await page.evaluate(()=>testMagic.rows.length),2);
 await page.click('#dvV16ImportBtn',{force:true,timeout:500}).catch(()=>{});
 assert.equal(await page.evaluate(()=>testMagic.calls.filter(c=>c.name==='save_my_tcg_collection_item_v1').length),2);
 cases.push('SERIE: append/order, per-row confirmation/search, explicit new entry, double-click protected, saved rows retained');
 await page.click('#dvV16Reset');await scan('continuous','',[textDSK]);await scan('continuous','',[textECL]);await scan('continuous','',[textDSK]);
 for(let i=0;i<3;i++)await resolveRow(i);
 await page.evaluate(()=>testMagic.failSave=testMagic.calls.filter(c=>c.name==='save_my_tcg_collection_item_v1').length+2);
 await page.click('#dvV16ImportBtn');await page.waitForFunction(()=>DV_SCAN_V16.batch[1].saveAttempted&&!DV_SCAN_V16.batch[1].busy);
 assert.deepEqual(await page.evaluate(()=>DV_SCAN_V16.batch.map(r=>[!!r.savedId,!!r.saveAttempted])),[[true,true],[false,true],[false,false]]);
 const savedCalls=await page.evaluate(()=>testMagic.calls.filter(c=>c.name==='save_my_tcg_collection_item_v1').length);
 await page.click('#dvV16ImportBtn');await page.waitForFunction(()=>!!DV_SCAN_V16.batch[2].savedId);
 assert.equal(await page.evaluate(()=>testMagic.calls.filter(c=>c.name==='save_my_tcg_collection_item_v1').length),savedCalls+1);
 cases.push('SERIE partial failure: saved and uncertain rows never repeated; remaining selected row saved once on explicit next action');
 await page.click('#dvV16Reset');const ownImage=await scan('continuous','',[textDSK]);
 await page.route('https://cards.scryfall.io/**',r=>r.fulfill({contentType:'image/png',body:Buffer.from(ownImage,'base64')}));
 const existing=await page.evaluate(()=>{testMagic.rows[0].image_path='own/protected.jpg';testMagic.rows[0].quantity=7;return testMagic.rows[0].id;});
 await page.evaluate(()=>loadItems());await resolveRow(0);await row(0).locator('[data-magic-save-action]').selectOption(existing);
 await row(0).locator('[data-magic-printing] summary').click();await row(0).locator('[data-magic-action="image"]').click();await page.waitForFunction(()=>!!DV_SCAN_V16.batch[0].imageBlob&&!DV_SCAN_V16.batch[0].busy);
 await row(0).locator('[data-magic-action="select"]').click();const ownBefore=await page.evaluate(()=>testMagic.rows.length);
 await page.click('#dvV16ImportBtn');await page.waitForFunction(()=>!!DV_SCAN_V16.batch[0].savedId);
 assert.equal(await page.evaluate(()=>testMagic.rows.length),ownBefore);assert.equal(await page.evaluate(()=>testMagic.rows[0].image_path),'own/protected.jpg');assert.equal(await page.evaluate(()=>testMagic.rows[0].quantity),7);
 cases.push('Explicit own-entry update retains quantity and protected image; R21 image download is conscious and printing-bound');
 await page.click('#dvV16Reset');const png4=await scan('multi','2x2',[textDSK,textECL,'',textDSK]);assert.equal(await count(),4);
 assert.deepEqual(await page.evaluate(()=>DV_SCAN_V16.batch.map(r=>r.observation.raw)),[textDSK,textECL,'',textDSK]);
 await writeFile(resolve(out,'synthetic-2x2.png'),Buffer.from(png4,'base64'));
 // Exercise a multi import and an individually corrected blank region through
 // the same real controls, while retaining its immutable empty observation.
 await row(2).locator('[data-magic-field="set_code"]').fill('ECL');
 await row(2).locator('[data-magic-field="collector_number"]').fill('0373');
 await row(2).locator('[data-magic-field="language"]').selectOption('EN');
 await resolveRow(0);await resolveRow(2);const multiBefore=await page.evaluate(()=>testMagic.rows.length);
 await page.click('#dvV16ImportBtn');await page.waitForFunction(()=>DV_SCAN_V16.batch[0].savedId&&DV_SCAN_V16.batch[2].savedId);
 assert.equal(await page.evaluate(()=>testMagic.rows.length),multiBefore+2);
 assert.equal(await page.evaluate(()=>DV_SCAN_V16.batch[2].observation.raw),'');
 assert.deepEqual(await page.evaluate(()=>DV_SCAN_V16.batch.map(r=>!!r.savedId)),[true,false,true,false]);
 cases.push('MEHRERE selection/save: only regions 1 and 3 imported, blank region individually corrected without changing raw, unselected rows retained');
 await page.click('#dvV16Reset');await scan('multi','3x2',[textDSK,textECL,'',textECL,textDSK,textECL]);assert.equal(await count(),6);
 assert.deepEqual(await page.evaluate(()=>DV_SCAN_V16.batch.map(r=>r.observation.raw)),[textDSK,textECL,'',textECL,textDSK,textECL]);
 await page.click('#dvV16Reset');const texts=[textECL,'',textDSK,'unreadable',textDSK,textECL,textDSK,textECL,textDSK];const png9=await scan('multi','3x3',texts);assert.equal(await count(),9);
 assert.deepEqual(await page.evaluate(()=>DV_SCAN_V16.batch.map(r=>r.observation.raw)),texts);await writeFile(resolve(out,'synthetic-3x3.png'),Buffer.from(png9,'base64'));
 await page.screenshot({path:resolve(out,'multi-ui.png'),fullPage:true});
 await page.click('#dvV16Reset');await scan('multi','auto',[],{blank:true});assert.equal(await count(),0);assert.match(await page.textContent('#dvV16Status'),/Weniger als zwei/);
 await scan('multi','auto',[textDSK,textECL,textDSK,textECL]);assert.ok(await count()>=2);assert.equal(provider.length,8);
 await page.click('#dvV16Reset');
 cases.push('MEHRERE: real 2x2/3x2/3x3 crops + separate OCR observations, AUTO detects cards and incomplete geometry fails closed');
 await page.evaluate(F=>Object.assign(testMagic.rows[0],{folder_id:F,binder_page:2,binder_slot:8}),F);await page.evaluate(()=>loadItems());
 await page.selectOption('#dvV16Folder',F);const binderPng=await scan('binder','3x3',texts);assert.equal(await count(),9);
 assert.deepEqual(await page.evaluate(()=>DV_SCAN_V16.batch.map(r=>r.slot)),[1,2,3,4,5,6,7,8,9]);
 assert.deepEqual(await page.evaluate(()=>DV_SCAN_V16.batch.map(r=>r.observation.raw)),texts);
 await resolveRow(2);
 assert.deepEqual(await row(2).locator('[data-magic-save-action] option').evaluateAll(xs=>xs.map(x=>x.value)),['','new']);
 assert.match(await row(2).textContent(),/Bestehende Karte zum Aktualisieren im Einzelkartenmodus/);
 const protectedBefore=await page.evaluate(()=>JSON.stringify(testMagic.rows));
 const mutationCalls=()=>page.evaluate(()=>testMagic.calls.filter(x=>['save_my_tcg_collection_item_v1','place_my_magic_scan_item_v1'].includes(x.name)).length);
 const beforeForged=await mutationCalls();
 await page.evaluate(existing=>{testMagic.failPlace=true;DV_SCAN_V16.batch[2].action=existing;DV_SCAN_V16.batch[2].selected=true;},existing);
 await page.click('#dvV16ImportBtn');await page.waitForFunction(()=>DV_SCAN_V16.batch[2].message.includes('Einzelkartenmodus'));
 assert.equal(await mutationCalls(),beforeForged);assert.equal(await page.evaluate(()=>JSON.stringify(testMagic.rows)),protectedBefore);
 assert.equal(await page.evaluate(()=>!!DV_SCAN_V16.batch[2].saveAttempted),false);
 cases.push('R22-R3-R2: binder excludes updates; forged existing target rejected before save/place RPC; placed card folder/position/image unchanged even with placement failure enabled');
 await page.evaluate(()=>testMagic.failPlace=false);await row(2).locator('[data-magic-save-action]').selectOption('new');await row(2).locator('[data-magic-action="select"]').click();
 await page.evaluate(()=>testMagic.placementReady=false);await page.click('#dvV16ImportBtn');await page.waitForFunction(()=>DV_SCAN_V16.batch[2].message.includes('noch nicht freigegeben'));
 const binderBefore=await page.evaluate(()=>testMagic.rows.length);
 await page.evaluate(()=>{testMagic.placementReady=true;testMagic.failPlace=true});await page.click('#dvV16ImportBtn');await page.waitForFunction(()=>!!DV_SCAN_V16.batch[2].savedId);
 assert.equal(await page.evaluate(()=>testMagic.rows.length),binderBefore+1);assert.equal(await page.evaluate(()=>testMagic.rows.at(-1).folder_id),null);await page.evaluate(()=>testMagic.failPlace=false);await row(2).locator('[data-magic-action="place"]').click();await page.waitForFunction(()=>DV_SCAN_V16.batch[2].placed);
 assert.equal(await page.evaluate(()=>testMagic.rows.at(-1).folder_id),F);
 assert.equal(await page.evaluate(()=>testMagic.rows.at(-1).binder_slot),3);
 await resolveRow(4);await page.evaluate(F=>testMagic.rows.push({id:crypto.randomUUID(),user_id:'10000000-0000-4000-8000-000000000001',tcg:'pokemon',folder_id:F,binder_page:1,binder_slot:5}),F);await page.click('#dvV16ImportBtn');await page.waitForFunction(()=>DV_SCAN_V16.batch[4].message.includes('belegt'));
 await writeFile(resolve(out,'synthetic-binder.png'),Buffer.from(binderPng,'base64'));await page.screenshot({path:resolve(out,'binder-ui.png'),fullPage:true});
 cases.push('BINDER: 9 stable slots, empty/unreadable/swapped observations, absent candidate blocks save, occupied target protected, placement-only retry never reimports');
 assert.equal(await page.locator('[data-magic-row] .dvV16Explain').count(),0);
 assert.equal(await page.evaluate(()=>{const el=document.querySelector('#dvV16Dialog .modal');return el.scrollWidth<=el.clientWidth+1}),true);
 assert.match(await row(2).textContent(),/Bildqualität \d+ %/);
 await row(2).evaluate(el=>el.scrollIntoView({block:'start'}));
 await page.screenshot({path:resolve(out,'binder-position-review.png')});
 await page.evaluate(()=>testMagic.quota=true);const before=provider.length;await confirm(0);await page.waitForFunction(()=>DV_SCAN_V16.batch[0].message.includes('Tageskontingent'));assert.equal(provider.length,before+1);assert.equal(await count(),9);
 await page.evaluate(()=>testMagic.admitted=false);await confirm(6);await page.waitForFunction(()=>DV_SCAN_V16.batch[6].message.includes('nicht zugelassen'));assert.equal(provider.length,before+1);
 await page.click('#dvV16Close');await page.click('#scanCard');assert.equal(await page.locator('#dvV16Tcg option[value="magic"]').count(),0);
 cases.push('Security: admission/hold denial and expiry fail closed; quota keeps all local rows; no automatic search or retry; no generic insert or raw upload');
 // R22-R3 gallery continuation: real buttons, delayed save, no camera or
 // file picker from the asynchronous save callback (Safari user activation).
 await page.evaluate(()=>{testMagic.admitted=true;testMagic.quota=false;testMagic.failSave=0;});
 await page.click('#dvV16Close');await page.click('#scanCard');await page.selectOption('#dvV16Tcg','magic');
 await page.click('#dvV16Reset');await page.selectOption('#dvV16Folder','');
 await scan('single','',[textDSK]);
 assert.match(await row(0).locator('[data-magic-next-step]').textContent(),/alle drei Angaben/);
 assert.equal(await row(0).locator('[data-magic-check],[data-v16-check]').count(),0);
 const beforeCombined=provider.length;await confirm(0);assert.equal(provider.length,beforeCombined+1);
 assert.match(await row(0).locator('[data-magic-next-step]').textContent(),/Druckvariante prüfen/);
 assert.equal(await page.locator('#dvV16SaveNext').isDisabled(),true);
 await chooseNew(0);
 await page.evaluate(()=>{testMagic.cameraStarts=0;const start=DV_SCAN_V16_CAMERA.start;DV_SCAN_V16_CAMERA.start=async(...args)=>{testMagic.cameraStarts++;return start(...args)};});
 let pickers=0;page.on('filechooser',()=>pickers++);
 const providerBeforeContinue=provider.length;
 const savesBeforeContinue=await page.evaluate(()=>testMagic.calls.filter(c=>c.name==='save_my_tcg_collection_item_v1').length);
 await row(0).locator('[data-magic-action="save"]').click();await page.waitForFunction(()=>!document.getElementById('dvV16Complete').classList.contains('dvV16Hidden'));
 assert.equal(await page.locator('#dvV16Results').isVisible(),false);
 assert.equal(await page.locator('#dvV16Import').isVisible(),false);
 assert.match(await page.textContent('#dvV16CompleteText'),/1 Karte gespeichert/);
 assert.equal(await page.textContent('#dvV16Next'),'NÄCHSTES GALERIEFOTO');
 assert.equal(await page.textContent('#dvV16ViewSaved'),'ZUR COLLECTION');
 assert.equal(pickers,0);assert.equal(await page.evaluate(()=>testMagic.cameraStarts),0);
 const chooserPromise=page.waitForEvent('filechooser');await page.click('#dvV16Next');await chooserPromise;
 assert.equal(pickers,1);assert.equal(await page.evaluate(()=>testMagic.cameraStarts),0);
 // Cancellation leaves the saved receipt usable; selecting a new gallery file
 // must preserve the saved row without saving it or looking it up again.
 assert.equal(await page.locator('#dvV16Complete').isVisible(),true);
 await scan('continuous','',[textECL]);assert.equal(await count(),2);
 assert.equal(await page.evaluate(()=>!!DV_SCAN_V16.batch[0].savedId),true);
 assert.equal(provider.length,providerBeforeContinue);
 assert.equal(await page.evaluate(()=>testMagic.calls.filter(c=>c.name==='save_my_tcg_collection_item_v1').length),savesBeforeContinue+1);
 await resolveRow(1);await page.click('#dvV16ImportBtn');await page.waitForFunction(()=>DV_SCAN_V16.batch[1].savedId&&!document.getElementById('dvV16Complete').classList.contains('dvV16Hidden'));
 await page.click('#dvV16ViewSaved');assert.equal(await page.locator('#dvV16Dialog').isVisible(),false);
 cases.push('Gallery save and save-next: clear receipt, fresh-tap gallery picker, cancellation safe, no camera launch/provider replay/duplicate save, next image and return to collection');
 // The operator-approved single-card flow has only one explicit search and
 // one explicit printing-confirming save. No checkbox or silent duplicate.
 await page.click('#scanCard');await page.selectOption('#dvV16Tcg','magic');await page.click('#dvV16Reset');
 await scan('single','',[textECL]);
 await row(0).locator('[data-magic-field="language"]').selectOption('');
 const beforeInvalid=provider.length;await confirm(0);
 assert.equal(provider.length,beforeInvalid);assert.match(await row(0).textContent(),/vollständig prüfen/);
 assert.equal(await row(0).locator('[data-magic-action="save"]').count(),0);
 await row(0).locator('[data-magic-field="language"]').selectOption('EN');
 await page.evaluate(()=>{const b=document.querySelector('[data-magic-action="confirm-search"]');b.click();b.click()});
 await page.waitForFunction(()=>DV_SCAN_V16.batch[0].best&&!DV_SCAN_V16.batch[0].busy);
 assert.equal(provider.length,beforeInvalid+1);
 const beforeChoice=await mutationCalls();await row(0).locator('[data-magic-action="save"]').click();
 assert.equal(await mutationCalls(),beforeChoice);assert.match(await row(0).textContent(),/Aktualisieren oder weitere Kopie auswählen/);
 const updateId=await row(0).locator('[data-magic-save-action] option').evaluateAll(xs=>xs.find(x=>x.value&&x.value!=='new').value);
 await row(0).locator('[data-magic-save-action]').selectOption(updateId);
 const beforeSingleUpdate=await page.evaluate(()=>testMagic.rows.length);
 await row(0).locator('[data-magic-action="save"]').click();await page.waitForFunction(()=>!!DV_SCAN_V16.batch[0].savedId);
 assert.equal(await page.evaluate(()=>testMagic.rows.length),beforeSingleUpdate);
 assert.equal(await page.evaluate(()=>testMagic.calls.filter(c=>c.name==='save_my_tcg_collection_item_v1').at(-1).args.p_item_id),updateId);
 await page.click('#dvV16Reset');await scan('single','',['R 0999\nECL *#EN']);await confirm(0);
 assert.equal(await row(0).locator('[data-magic-save-action],[data-v16-check],[data-magic-check]').count(),0);
 assert.equal(await page.locator('#dvV16Import').isVisible(),false);
 await page.screenshot({path:resolve(out,'simplified-single-ready.png'),fullPage:true});
 const beforeSingleNew=await mutationCalls();
 await page.evaluate(()=>{const b=document.querySelector('[data-magic-action="save"]');b.click();b.click()});
 await page.waitForFunction(()=>DV_SCAN_V16.batch[0].savedId&&!DV_SCAN_V16.batch[0].busy);
 assert.equal(await mutationCalls(),beforeSingleNew+1);
 assert.equal(await page.evaluate(()=>testMagic.calls.filter(c=>c.name==='save_my_tcg_collection_item_v1').at(-1).args.p_item_id),null);
 cases.push('Simplified single: missing language blocks search with visible reason; double click uses one search/save; duplicates require conscious update/copy; unique card needs no checkbox/dropdown; explicit save confirms printing');
 await page.click('#dvV16Reset');await scan('continuous','',[textECL]);await confirm(0);await chooseNew(0);await row(0).locator('[data-magic-action="select"]').click();
 const beforeEdit=provider.length;await row(0).locator('[data-magic-field="collector_number"]').fill('0374');
 assert.equal(await page.evaluate(()=>!!DV_SCAN_V16.batch[0].confirmed||!!DV_SCAN_V16.batch[0].best||DV_SCAN_V16.batch[0].selected),false);
 assert.equal(await page.locator('#dvV16Import').isVisible(),false);assert.equal(provider.length,beforeEdit);
 assert.equal(await row(0).locator('[data-magic-action="confirm-search"]').isEnabled(),true);
 cases.push('Editing after confirmation removes printing/selection/save eligibility without network; shared confirmation is required again');
 assert.deepEqual(errors,[]);assert.deepEqual(forbidden,[]);
 const report={synthetic:true,real_user_verification:false,cases,provider_requests:provider.length,forbidden_requests:forbidden,browser_errors:errors,hardware_camera:'OPEN',physical_multi_binder:'OPEN'};
 await writeFile(resolve(out,'browser.json'),JSON.stringify(report,null,2));console.log('PASS R22-R3 actual COLLECT/V16 four-mode synthetic browser E2E',JSON.stringify(report));
}catch(error){console.error({errors,forbidden,state:await page.evaluate(()=>({ready:window.__DV_V16_READY,loadError:String(window.__DV_V16_LOAD_ERROR||''),status:document.getElementById('dvV16Status')?.textContent}))});throw error;}finally{await browser.close();await new Promise(r=>server.close(r));}
