// Controlled reference-image recognition, NOT a claim about photographed foil.
// Public catalog JSON/pixels are relayed unchanged; only delivery/CORS is local.
// No OCR, identifier, ranking or recognition result is mocked. No collection writes.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {chromium} from 'playwright';
const root=resolve(import.meta.dirname,'..'),out=resolve(root,'test-results/real-cards');
await mkdir(out,{recursive:true});
const cases=[
 {key:'charizard',tcg:'pokemon',code:'223/197',catalog:'sv03-223',url:'https://api.tcgdex.net/v2/de/cards/sv03-223'},
 {key:'umbreon',tcg:'pokemon',code:'215/203',catalog:'swsh7-215',url:'https://api.tcgdex.net/v2/en/cards/swsh7-215',recoveryExpected:true},
 {key:'op-standard',tcg:'one_piece',code:'OP05-119',catalog:'OP05-119'},
 {key:'op-parallel',tcg:'one_piece',code:'OP05-119',catalog:'OP05-119_p1'},
 {key:'op-manga',tcg:'one_piece',code:'OP05-119',catalog:'OP05-119_p2'},
 {key:'op-promo',tcg:'one_piece',code:'P-001',catalog:'P-001'}
];
const cache=new Map(),providerErrors=[];
async function remote(url){
 if(!cache.has(url))cache.set(url,(async()=>{
  let last;for(let i=0;i<3;i++)try{const r=await fetch(url,{signal:AbortSignal.timeout(20000)});if(r.status>=500)throw Error(`HTTP ${r.status}`);return{status:r.status,body:Buffer.from(await r.arrayBuffer()),contentType:r.headers.get('content-type')||'application/octet-stream'}}catch(e){last=e}
  throw last;
 })());return cache.get(url);
}
for(const c of cases){
 try{
 c.url??=`https://optcgapi.com/api/${c.code.startsWith('P-')?'promos':'sets'}/card/${c.code}/`;
 const r=await remote(c.url);assert.equal(r.status,200);const data=JSON.parse(r.body),row=c.tcg==='pokemon'?data:data.find(r=>r.card_image_id===c.catalog);assert.ok(row,`source ${c.catalog} exists`);
 c.name=row.name||row.card_name;c.image=c.tcg==='pokemon'?row.image+'/high.webp':row.card_image;
 const img=await remote(c.image);assert.equal(img.status,200);c.file=resolve(out,c.key+(c.tcg==='pokemon'?'.webp':'.jpg'));await writeFile(c.file,img.body);
 }catch(error){c.sourceError=error.message;providerErrors.push({case:c.key,url:c.url,error:error.message})}
}
const server=createServer(async(req,res)=>{try{const target=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!target.startsWith(root+sep))throw Error('path');const data=await readFile(target);res.writeHead(200,{'content-type':({'.html':'text/html','.js':'application/javascript','.css':'text/css','.wasm':'application/wasm','.gz':'application/gzip'})[extname(target)]||'application/octet-stream'});res.end(data)}catch{res.writeHead(404);res.end()}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch(),page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
page.setDefaultTimeout(15000);const errors=[],report=[];let failed=false;
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error'&&!/status of 404/.test(m.text()))errors.push(m.text())});
await page.route(/https:\/\/(api\.tcgdex\.net|assets\.tcgdex\.net|optcgapi\.com)\//,async route=>{try{const r=await remote(route.request().url());await route.fulfill({status:r.status,contentType:r.contentType,body:r.body})}catch(e){providerErrors.push({url:route.request().url(),error:e.message});await route.abort()}});
const snapshot=()=>page.evaluate(()=>{const r=window.DV_SCAN_V16.batch[0];return{tcg:r?.tcg,id:r?.id?.code,observedLanguage:r?.observedLanguage,evidence:r?.identifierEvidence,status:r?.status,failure:r?.failureType,quality:r?.quality,reviewReasons:r?.reviewReasons,manualConfirmed:r?.manualConfirmed,best:r?.best&&{id:r.best.catalogId,name:r.best.name,number:r.best.number,language:r.best.language,variant:r.best.variant,artwork:r.best.v16Visual},candidates:r?.candidates?.map(c=>({id:c.catalogId,art:c.v16Visual,language:c.language,variant:c.variant})),benchmark:window.DV_SCAN_V16_BENCHMARK.load().length}});
const waitResult=()=>page.waitForFunction(()=>document.getElementById('dvV16Status')?.textContent.includes('Analyse fertig'),null,{timeout:100000});
try{
 await page.goto(base+'/scanner-v16.html?e2e=1',{waitUntil:'domcontentloaded'});await page.locator('#dvV16Dialog[open]').waitFor();assert.equal(await page.locator('iframe').count(),0);
 for(const c of cases){
  if(c.sourceError){failed=true;report.push({case:c.key,providerUnavailable:c.sourceError});console.error('SOURCE UNAVAILABLE:',c.key,c.sourceError);continue}
  console.log('REAL CARD:',c.key,c.name,c.code,c.catalog);
  try{
   await page.selectOption('#dvV16Tcg',c.tcg);const before=await page.evaluate(()=>window.DV_SCAN_V16_BENCHMARK.load().length);
   await page.locator('#dvV16GalleryFile').setInputFiles(c.file);await waitResult();
   const automatic=await snapshot(),entry={case:c.key,expected:{code:c.code,catalog:c.catalog,image:c.image},automatic};report.push(entry);
   await page.locator('#dvV16Results').screenshot({path:resolve(out,c.key+'-result.png')});
   assert.equal(automatic.tcg,c.tcg);assert.equal(automatic.benchmark,before+1,'one benchmark per upload');
   if(c.recoveryExpected&&(automatic.id!==c.code||automatic.best?.id!==c.catalog)){
    assert.notEqual(automatic.status,'ready','a wrong identifier must never auto-confirm this card');assert.equal(await page.locator('[data-v16-check]').isDisabled(),true);
    entry.automaticRecognition='FAILED — manual number correction required';
    if(await page.locator('.dvV16Recovery').getAttribute('open')===null)await page.locator('.dvV16Recovery summary').click();await page.locator('[name=code]').fill(c.code);await page.locator('[data-v16-recover] button[type=submit]').click();
    await page.waitForFunction(()=>document.getElementById('dvV16Status').textContent.includes('passenden Kandidaten bestätigen'),null,{timeout:100000});
    entry.recovered=await snapshot();assert.equal(entry.recovered.best.id,c.catalog,'manual code must retrieve and rank the right artwork');
    if(await page.locator('.dvV16Recovery').getAttribute('open')===null)await page.locator('.dvV16Recovery summary').click();await page.locator('[data-v16-confirm]').first().click();assert.equal(await page.locator('[data-v16-check]').isChecked(),true);assert.equal((await snapshot()).manualConfirmed,true);
   }else{
    assert.equal(automatic.id,c.code,'correct printed identifier is required');assert.equal(automatic.best?.id,c.catalog,'correct printing/artwork is required, not just same OP code');assert.equal(automatic.best?.name,c.name);assert.ok(automatic.best.artwork>=98,'identical reference pixels must survive common-resolution artwork comparison');
    if(c.key.startsWith('op-')&&c.key!=='op-promo')assert.equal(automatic.quality.reflectionRisk,false,'printed white areas matched to reference are not photographic glare');
    assert.match(await page.locator('#dvV16Results').innerText(),new RegExp(c.code));
    entry.automaticRecognition=automatic.status==='ready'?'correct, ready':'correct candidate, review required';
   }
   console.log('REAL CARD EVIDENCE:',JSON.stringify(entry));
  }catch(e){failed=true;console.error('REAL CARD FAILURE',c.key,e);report.push({case:c.key,error:e.message,actual:await snapshot().catch(()=>null)})}
  await page.click('#dvV16Reset');
 }
 // A new white obstruction must still fail the glare/evidence gates.
 const standard=cases.find(c=>c.key==='op-standard');if(!standard.sourceError){await page.selectOption('#dvV16Tcg','one_piece');
 const blocked=await page.evaluate(async url=>{const i=new Image();i.crossOrigin='anonymous';i.src=url;await i.decode();const c=document.createElement('canvas');c.width=i.width;c.height=i.height;const x=c.getContext('2d');x.drawImage(i,0,0);x.fillStyle='white';x.fillRect(c.width*.25,c.height*.18,c.width*.5,c.height*.48);return c.toDataURL('image/png').split(',')[1]},standard.image);
 await page.locator('#dvV16GalleryFile').setInputFiles({name:'obstructed.png',mimeType:'image/png',buffer:Buffer.from(blocked,'base64')});await waitResult();const obstruction=await snapshot();report.push({case:'new-white-obstruction',automatic:obstruction});assert.notEqual(obstruction.status,'ready');assert.equal(obstruction.quality.reflectionRisk,true);assert.equal(await page.locator('[data-v16-check]').isDisabled(),true);}
 assert.deepEqual(errors,[],'unexpected browser errors');assert.deepEqual(providerErrors,[],'provider delivery failure is not recognition evidence');
} catch(e){failed=true;console.error(e)}finally{
 await writeFile(resolve(out,'matrix.json'),JSON.stringify({scope:'Unmodified public reference pixels/catalogs with controlled delivery; no physical foil/iPhone claim',report,errors,providerErrors},null,2));
 await browser.close();server.closeAllConnections();server.close();
}
process.exit(failed?1:0);
