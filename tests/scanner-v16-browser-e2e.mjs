import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {readFile,stat,mkdir} from 'node:fs/promises';
import {dirname,extname,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const testDir=dirname(fileURLToPath(import.meta.url));
const root=resolve(testDir,'..');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.css':'text/css; charset=utf-8','.txt':'text/plain; charset=utf-8','.wasm':'application/wasm','.gz':'application/gzip'};
const server=createServer(async(request,response)=>{
  try{
    const pathname=decodeURIComponent(new URL(request.url,'http://127.0.0.1').pathname);
    const target=resolve(root,`.${pathname==='/'?'/scanner-v16.html':pathname}`);
    if(target!==root&&!target.startsWith(`${root}${sep}`))throw new Error('path outside root');
    const info=await stat(target);
    if(!info.isFile())throw new Error('not a file');
    response.writeHead(200,{'content-type':mime[extname(target)]||'application/octet-stream','cache-control':'no-store'});
    response.end(await readFile(target));
  }catch{
    response.writeHead(404,{'content-type':'text/plain'});response.end('Not found');
  }
});

await new Promise((resolveListen,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolveListen)});
const address=server.address();
assert.equal(typeof address,'object');
const base=`http://127.0.0.1:${address.port}`;
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
const page=await context.newPage();
page.setDefaultTimeout(12000);
await page.addInitScript(()=>{
  const media={getUserMedia:()=>Promise.reject(new DOMException('No camera in deterministic E2E','NotAllowedError'))};
  try{Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:media})}catch{}
});
const errors=[],catalogRequests=[],assetDiagnostics=[];let liveCatalogPhase=false,expectedProviderError=false;
await page.route('https://api.tcgdex.net/**',async route=>{
  const url=new URL(route.request().url());catalogRequests.push(url.href);
  const path=url.pathname;let data=[];
  if(path==='/v2/de/sets')data=[...Array.from({length:25},(_,i)=>({id:'older'+i,cardCount:{official:100,total:100}})),{id:'fixture84',cardCount:{official:84,total:84}}];
  if(path==='/v2/de/sets/fixture84')data={cards:[{id:'fixture84-074',localId:'074'},{id:'wrong-174',localId:'174'}]};
  if(path==='/v2/de/cards/fixture84-074')data={id:'fixture84-074',localId:'074',name:'Retourorden',rarity:'Uncommon',set:{name:'Synthetic regression set',cardCount:{official:84,total:84}},image:base+'/fixtures/pokemon'};
  if(path==='/v2/ja/sets')data=[{id:'wrong81',cardCount:{official:81,total:81}}];
  if(path==='/v2/ja/sets/wrong81')data={cards:[{id:'wrong81-074',localId:'074'}]};
  if(path==='/v2/ja/cards/wrong81-074')data={id:'wrong81-074',localId:'074',name:'リトライバッジ',set:{name:'Wrong Japanese printing',cardCount:{official:81,total:81}}};
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
});
await page.route('https://optcgapi.com/**',async route=>{
  const url=route.request().url();catalogRequests.push(url);
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(url.includes('/sets/card/OP05-119/')?[{card_set_id:'OP05-119',card_image_id:'OP05-119',card_name:'Monkey D. Luffy',set_name:'Synthetic regression set',rarity:'SEC',card_image:base+'/fixtures/onepiece/high.webp'}]:[])});
});
await page.route(base+'/fixtures/**',async route=>{
  const file=route.request().url().includes('pokemon')?'pokemon-074-084.svg':'onepiece-op05-119.svg';
  await route.fulfill({status:200,contentType:'image/svg+xml',body:await readFile(resolve(root,'tests/fixtures',file))});
});
await page.route(base+'/api/scanner-v16-recognize',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({active:false,remaining:0})}));
page.on('requestfailed',request=>console.error('Failed request:',request.url(),request.failure()?.errorText));
page.on('pageerror',error=>errors.push(error.message));
page.on('console',message=>{if(message.type()==='error'){
  const text=message.text(),url=message.location().url;
  const knownAssetFailure=liveCatalogPhase&&((text.includes('https://assets.tcgdex.net/')&&text.includes('CORS policy'))||(url.startsWith('https://assets.tcgdex.net/')&&text.includes('Failed to load resource')));
  if(knownAssetFailure)assetDiagnostics.push({text,url});else if(!(expectedProviderError&&url===base+'/api/scanner-v16-recognize'&&text.includes('504')))errors.push(text);
}});
const watchdog=setTimeout(()=>{console.error('FAIL: browser E2E exceeded 300 seconds');process.exit(1)},300000);

async function upload(input,fixture){
  await page.locator(input).setInputFiles(resolve(root,fixture),{timeout:12000});
}

async function waitForResult(name,number){
  try{await page.waitForFunction(()=>document.getElementById('dvV16Status')?.textContent?.includes('Analyse fertig'),null,{timeout:90000})}
  catch(error){console.error('E2E state:',await page.evaluate(()=>({state:window.DV_SCAN_V16?.controller?.state,status:document.getElementById('dvV16Status')?.textContent,loadError:String(window.__DV_V16_LOAD_ERROR?.message||'')})));throw error}
  await page.locator('#dvV16Results .dvV16ResultTitle').filter({hasText:name}).first().waitFor({timeout:5000});
  assert.match(await page.locator('#dvV16Results').innerText(),new RegExp(number.replace('/','\\/'),'i'));
  assert.equal(await page.evaluate(()=>window.DV_SCAN_V16.controller.state),'result');
  const actual=await page.evaluate(()=>{const row=window.DV_SCAN_V16.batch[0];return{id:row.id?.code,name:row.best?.name,number:row.best?.number,tcg:row.tcg,verified:row.best?.catalogVerified}});
  assert.equal(actual.id,number);assert.equal(actual.number,number);assert.equal(actual.name,name);assert.equal(actual.verified,true);
  assert.ok(!await page.locator('#dvV16Results .dvV16ResultTitle').filter({hasText:'Kein sicherer Treffer'}).count());
  assert.equal(await page.locator('[data-v16-tcg="'+actual.tcg+'"]').count(),1);
  assert.equal(await page.locator('.dvV16Details').getAttribute('open'),null,'technical details start collapsed');
  assert.equal(await page.locator('.dvV16ResultTitle').first().isVisible(),true);
  assert.equal(await page.locator('.dvV16ResultMessage').first().isVisible(),true);
  assert.ok(!await page.locator('#dvV16Results').innerText().then(text=>text.includes('ein etwas besseres Bild')),'recognized high quality results must not ask for a better image');
  console.log('Recognition evidence:',JSON.stringify(actual));
}

let failure=null;
try{
  console.log('E2E: open direct mobile route');
  await page.goto(`${base}/scanner-v16.html?e2e=1`,{waitUntil:'domcontentloaded'});
  await page.locator('#dvV16Dialog[open]').waitFor({timeout:15000});
  assert.equal(await page.locator('iframe').count(),0,'direct mobile route must not contain an iframe');
  assert.equal(await page.locator('input[type=file]').count(),2,'camera and gallery must have separate inputs');
  assert.equal(await page.locator('#dvV16Capture').isVisible(),false,'unavailable shutter should not compete with camera-start');
  await page.locator('.dvV16Alternative summary').click();
  assert.equal(await page.locator('#dvV16Native').isVisible(),true,'native camera fallback stays reachable');
  await page.locator('.dvV16Alternative summary').click();

  await page.click('#dvV16Close');
  await page.click('#dvV16BenchLaunch');
  await page.selectOption('#dvV16BenchScenario','pokemon_standard');
  await page.fill('#dvV16BenchCode','074/084');
  await page.selectOption('#dvV16BenchLang','DE');
  await page.click('#dvV16BenchArm');
  await page.click('#dvV16BenchClose');
  await page.click('#dvV16Launch');
  await page.selectOption('#dvV16Tcg','pokemon');
  console.log('E2E: upload Pokemon fixture');
  await upload('#dvV16GalleryFile','tests/fixtures/pokemon-074-084.svg');
  await waitForResult('Retourorden','074/084');

  await page.click('#dvV16Close');
  await page.click('#dvV16BenchLaunch');
  await page.waitForFunction(()=>document.getElementById('dvV16BenchObserved')?.textContent?.includes('Retourorden'),null,{timeout:5000});
  await page.click('[data-v16-verdict="correct"]');
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('duelvanta_scanner_v16_eval_v1')).entries.length),1,'benchmark result was not persisted');
  await page.click('#dvV16BenchClose');

  await page.click('#dvV16Launch');
  await page.click('#dvV16Close');
  await page.click('#dvV16BenchLaunch');
  await page.selectOption('#dvV16BenchScenario','onepiece_standard');
  await page.fill('#dvV16BenchCode','OP05-119');await page.selectOption('#dvV16BenchLang','EN');
  await page.click('#dvV16BenchArm');await page.click('#dvV16BenchClose');await page.click('#dvV16Launch');
  assert.equal(await page.locator('#dvV16Tcg').inputValue(),'one_piece','benchmark-selected TCG must survive scanner reopen');
  console.log('E2E: upload One Piece fixture');
  await upload('#dvV16CameraFile','tests/fixtures/onepiece-op05-119.svg');
  await waitForResult('Monkey D. Luffy','OP05-119');

  const observed=await page.evaluate(()=>window.DV_SCAN_V16_BENCH_SESSION.state.captured.observed);
  assert.equal(observed.tcg,'one_piece');assert.equal(observed.results[0].number,'OP05-119');assert.equal(observed.results[0].catalog_matched,true);
  console.log('E2E: code-only recovery without a new photo');
  await page.locator('.dvV16Recovery summary').click();
  await page.locator('[name=code]').fill('OP05-118');await page.locator('[data-v16-recover] button[type=submit]').click();
  await page.waitForFunction(()=>document.getElementById('dvV16Status').textContent.includes('kein passender Katalogeintrag'));
  assert.equal(await page.locator('[data-v16-check]').isDisabled(),true);
  await page.locator('.dvV16Details summary').click();
  assert.match(await page.locator('.dvV16Debug').innerText(),/OP05-118/);
  await page.locator('[name=code]').fill('OP05-119');await page.locator('[data-v16-recover] button[type=submit]').click();
  await page.waitForFunction(()=>document.getElementById('dvV16Status').textContent.includes('passenden Kandidaten bestätigen'));
  await page.locator('.dvV16Recovery summary').click();
  assert.equal(await page.locator('[data-v16-check]').isChecked(),false);
  await page.locator('[data-v16-confirm]').first().click();
  assert.equal(await page.locator('[data-v16-check]').isChecked(),true);
  assert.equal(await page.evaluate(()=>window.DV_SCAN_V16.batch[0].manualConfirmed),true);
  assert.equal(await page.evaluate(()=>document.getElementById('dvV16Dialog').scrollWidth<=document.getElementById('dvV16Dialog').clientWidth+1),true,'mobile results must not overflow horizontally');
  await mkdir(resolve(root,'test-results'),{recursive:true});
  await page.screenshot({path:resolve(root,'test-results/v16-recognition-mobile.png'),fullPage:true});
  const runs=await page.evaluate(()=>window.DV_SCAN_V16_BENCHMARK.load());
  assert.equal(runs.length,4,'each upload / correction must run and record exactly once');
  assert.ok(catalogRequests.some(url=>url.includes('/sets/fixture84')));
  assert.ok(!catalogRequests.some(url=>url.includes('wrong-174')));
  await page.click('#dvV16Retry');
  console.log('E2E: upload invalid fixture and verify recovery');
  await upload('#dvV16GalleryFile','tests/fixtures/invalid-upload.txt');
  await page.waitForFunction(()=>document.getElementById('dvV16Status')?.textContent?.includes('kein Bild'),null,{timeout:5000});
  assert.equal(await page.evaluate(()=>window.DV_SCAN_V16.controller.state),'error');
  assert.equal(await page.locator('#dvV16Choose').isEnabled(),true,'gallery button stayed locked after a decoding error');
  await page.click('#dvV16Retry');
  await page.waitForFunction(()=>window.DV_SCAN_V16.controller.state==='error');
  assert.equal(await page.locator('#dvV16Choose').isEnabled(),true,'gallery button did not recover');

  console.log('E2E: real canvas video stream, contour gate and single automatic capture');
  await page.selectOption('#dvV16Tcg','pokemon');
  await page.evaluate(async()=>{
    const canvas=document.createElement('canvas');canvas.width=720;canvas.height=1280;
    const image=new Image();image.src='/tests/fixtures/pokemon-074-084.svg';await image.decode();
    const video=document.getElementById('dvV16Video'),box=video.getBoundingClientRect();
    const g=window.DV_SCAN_V16_LIVE.geometry({sourceWidth:720,sourceHeight:1280,boxWidth:box.width,boxHeight:box.height});
    let tick=0;const x=canvas.getContext('2d'),draw=()=>{tick++;x.filter='none';x.fillStyle='#303030';x.fillRect(0,0,720,1280);const r=g.source;x.filter=`brightness(${1+Math.sin(tick)*.035})`;x.drawImage(image,r.x+r.w*.09+Math.sin(tick)*2,r.y+r.h*.09+Math.cos(tick)*2,r.w*.82,r.h*.82);x.filter='none'};
    draw();const stream=canvas.captureStream(10);window.__liveFixtureTimer=setInterval(draw,100);
    navigator.mediaDevices.getUserMedia=async()=>stream;
    window.__captureCount=0;const capture=window.DV_SCAN_V16_CAMERA.capture;
    window.DV_SCAN_V16_CAMERA.capture=(video,options)=>{window.__captureCount++;const canvas=capture(video,options);window.__capturedGeometry=canvas.__v16CaptureGeometry;return canvas};
  });
  await page.click('#dvV16Camera');
  await page.waitForFunction(()=>window.DV_SCAN_V16.controller.state==='camera-ready');
  const overlayError=await page.evaluate(()=>{
    const video=document.getElementById('dvV16Video'),v=video.getBoundingClientRect(),o=document.getElementById('dvV16Overlay').getBoundingClientRect(),g=window.DV_SCAN_V16_CAMERA.geometry(video);
    return Math.max(Math.abs(o.x-v.x-g.overlay.x),Math.abs(o.y-v.y-g.overlay.y),Math.abs(o.width-g.overlay.w),Math.abs(o.height-g.overlay.h));
  });
  assert.ok(overlayError<.1,'rendered overlay and capture transform must agree, including parent borders');
  await page.locator('.dvV16Stage').screenshot({path:resolve(root,'test-results/v16-live-guide.png')});
  await page.waitForFunction(()=>window.__captureCount===1,null,{timeout:20000});
  await waitForResult('Retourorden','074/084');
  assert.equal(await page.evaluate(()=>window.__captureCount),1,'live loop must submit exactly one frame, not run OCR repeatedly');
  assert.equal(await page.evaluate(()=>window.__capturedGeometry.detected),true,'green contour must determine the actual captured crop');
  assert.equal(await page.evaluate(()=>window.DV_SCAN_V16_BENCHMARK.load().length),5);
  await page.evaluate(()=>clearInterval(window.__liveFixtureTimer));
  await page.screenshot({path:resolve(root,'test-results/v16-auto-capture.png'),fullPage:true});

  console.log('E2E: real iPhone screenshot pixels, including patterned background; wrong JP distractor present');
  await page.click('#dvV16Retry');
  await upload('#dvV16GalleryFile','tests/fixtures/retourorden-iphone.png');
  await waitForResult('Retourorden','074/084');
  const real=await page.evaluate(()=>{const r=window.DV_SCAN_V16.batch[0];return{language:r.best.language,observed:r.observedLanguage,evidence:r.identifierEvidence,crop:{width:r.crop.width,height:r.crop.height}}});
  assert.equal(real.language,'DE');assert.equal(real.observed,'DE');
  assert.equal(await page.locator('#dvV16Results').innerText().then(t=>t.includes('リトライバッジ')),false);
  console.log('Real iPhone OCR evidence:',JSON.stringify(real));
  await page.screenshot({path:resolve(root,'test-results/v16-real-iphone-result.png'),fullPage:true});
  assert.equal(await page.evaluate(()=>window.DV_SCAN_V16_BENCHMARK.load().length),6);

  console.log('E2E: import completion → one-tap next capture; isolated in-memory collection');
  await page.evaluate(()=>{
    window.currentUser={id:'v16-test-user'};window.__importCalls=0;
    window.db={from:()=>({insert:payload=>{window.__lastImportPayload=payload;window.__importCalls++;return{select:()=>({single:async()=>({data:{id:'test-card-1'},error:null})})}},update:()=>({eq:()=>({eq:async()=>({error:null})})})}),storage:{from:()=>({upload:async()=>({error:null})})}};
    window.loadItems=async()=>[];
  });
  await page.click('#dvV16ImportBtn');
  await page.locator('#dvV16Complete:not(.dvV16Hidden)').waitFor();
  assert.equal(await page.locator('#dvV16CompleteText').innerText(),'1 Karte gespeichert.');
  assert.equal(await page.locator('#dvV16Dialog').getAttribute('open'),'');
  const receiptUrl=page.url();
  await page.click('#dvV16ViewSaved');
  assert.match(await page.locator('#dvV16Saved').innerText(),/Retourorden/);
  assert.match(await page.locator('#dvV16Saved').innerText(),/074\/084/);
  assert.equal(page.url(),receiptUrl,'viewing the saved card must stay in the scanner');
  assert.equal(await page.evaluate(()=>window.__importCalls),1);
  await page.locator('#dvV16Complete').screenshot({path:resolve(root,'test-results/v16-import-next-scan.png')});
  const selectedTcg=await page.locator('#dvV16Tcg').inputValue(),selectedBinder=await page.locator('#dvV16Folder').inputValue();
  await page.evaluate(()=>{navigator.mediaDevices.getUserMedia=()=>Promise.reject(new DOMException('No camera','NotAllowedError'))});
  await page.click('#dvV16Next');
  await page.waitForFunction(()=>window.DV_SCAN_V16.controller.state==='error');
  assert.equal(await page.locator('#dvV16Choose').isEnabled(),true,'next scan must fall back to a photo when camera permission is absent');
  assert.equal(await page.locator('#dvV16Tcg').inputValue(),selectedTcg);assert.equal(await page.locator('#dvV16Folder').inputValue(),selectedBinder);
  assert.equal(await page.evaluate(()=>window.__importCalls),1,'starting next scan must not repeat an import');

  console.log('E2E: saved Ximilar evidence → correct catalog result → benchmark; replay cannot import');
  for(const fixture of [{tcg:'pokemon',file:'pokemon-074-084.svg',code:'074/084',name:'Retourorden',language:'DE',printing:'me05-074'},{tcg:'one_piece',file:'onepiece-op05-119.svg',code:'OP05-119',name:'Monkey D. Luffy',language:'EN',printing:'OP05-119_P1'}]){
    await page.selectOption('#dvV16Tcg',fixture.tcg);
    await page.evaluate(async fixture=>{
      const file=await fetch('/tests/fixtures/'+fixture.file).then(r=>r.blob());
      const digest=await crypto.subtle.digest('SHA-256',await file.arrayBuffer()),sha256=Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');
      await window.DV_SCAN_V16.processProviderResult(file,{model:'ximilar-collectibles-v2-tcg-id',selectedTcg:fixture.tcg,sha256,observed:{tcg:fixture.tcg,printed_code:fixture.code,language:fixture.language,name:fixture.name},catalogCandidate:{card_id:fixture.printing},status:'proposed',elapsedMs:2700});
    },fixture);
    await waitForResult(fixture.name,fixture.code);
    await page.locator('.dvV16Details summary').click();
    assert.match(await page.locator('.dvV16Debug').innerText(),/Ximilar · gespeicherter Test/);
    assert.equal(await page.locator('[data-v16-check]').isDisabled(),true);
    assert.match(await page.locator('.dvV16Badge').first().innerText(),/TEST · KEIN IMPORT/);
    const saved=await page.evaluate(()=>window.DV_SCAN_V16_BENCHMARK.load().at(-1));
    assert.equal(saved.results[0].provider,'ximilar');assert.equal(saved.results[0].provider_replay,true);assert.equal(saved.results[0].number,fixture.code);
    assert.equal(await page.evaluate(()=>window.__importCalls),1);
  }
  await page.screenshot({path:resolve(root,'test-results/v16-ximilar-replay.png'),fullPage:true});

  console.log('E2E: explicit Ximilar choice → authenticated mock API → review → manual confirmation → isolated import');
  let providerCalls=0,providerError=false;
  await page.unroute(base+'/api/scanner-v16-recognize');
  await page.route(base+'/api/scanner-v16-recognize',async route=>{
    if(route.request().method()==='GET')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({active:true,remaining:20-providerCalls,slabRemaining:5})});
    providerCalls++;const body=route.request().postDataJSON();
    assert.equal(route.request().headers().authorization,'Bearer test-session');assert.equal(body.tcg,'pokemon');
    const sha256=createHash('sha256').update(Buffer.from(body.imageBase64,'base64')).digest('hex');
    if(body.kind==='slab')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({model:'ximilar-collectibles-v2-slab-id',selectedTcg:'pokemon',kind:'slab',sha256,status:'slab_review',slab:{company:'PSA',grade:'9',certificateNumber:'00123456',printedCode:'#74',reviewRequired:true,certificateVerified:false},cardRect:{x:50/730,y:230/1180,w:630/730,h:880/1180}})});
    return route.fulfill({status:providerError?504:200,contentType:'application/json',body:JSON.stringify(providerError?{error:'provider_timeout_or_network'}:{model:'ximilar-collectibles-v2-tcg-id',selectedTcg:'pokemon',sha256,observed:{tcg:'pokemon',printed_code:'074/084',language:'DE'},catalogCandidate:{card_id:'me05-074'},status:'proposed',remaining:19})});
  });
  await page.evaluate(()=>{window.db.auth={getSession:async()=>({data:{session:{access_token:'test-session'}}})}});
  await page.click('#dvV16Close');await page.click('#dvV16Launch');
  await page.locator('#dvV16EngineField:not(.dvV16Hidden)').waitFor();
  await page.selectOption('#dvV16Tcg','pokemon');await page.selectOption('#dvV16Engine','ximilar');
  await upload('#dvV16GalleryFile','tests/fixtures/pokemon-074-084.svg');
  await waitForResult('Retourorden','074/084');assert.equal(providerCalls,1);
  assert.equal(await page.locator('[data-v16-check]').isDisabled(),true);
  await page.locator('.dvV16Details summary').click();
  assert.match(await page.locator('.dvV16Explain').innerText(),/KI-VORSCHLAG/);
  await page.locator('.dvV16Recovery summary').click();await page.locator('[data-v16-confirm]').first().click();
  assert.equal(await page.locator('[data-v16-check]').isChecked(),true);
  await page.click('#dvV16SaveNext');await page.locator('#dvV16Complete:not(.dvV16Hidden)').waitFor();
  await page.waitForFunction(()=>window.DV_SCAN_V16.controller.state==='error');
  assert.equal(await page.locator('#dvV16Choose').isEnabled(),true,'save and next must recover when live camera is unavailable');
  assert.equal(await page.evaluate(()=>window.__importCalls),2);
  await page.click('#dvV16ViewSaved');assert.match(await page.locator('#dvV16Saved').innerText(),/074\/084/);
  providerError=true;expectedProviderError=true;
  await upload('#dvV16GalleryFile','tests/fixtures/pokemon-074-084.svg');
  await page.waitForFunction(()=>window.DV_SCAN_V16.controller.state==='error');
  assert.equal(providerCalls,2,'one user action must make one request with no automatic retry');
  assert.equal(await page.locator('#dvV16Choose').isEnabled(),true);
  assert.match(await page.locator('#dvV16Status').innerText(),/Kein automatischer Wiederholungsversuch/);
  await page.selectOption('#dvV16Engine','local');

  console.log('E2E: whole slab upload → one mock label API → real card OCR → separate card/label confirmation → isolated graded import');
  providerError=false;expectedProviderError=false;
  await page.selectOption('#dvV16Kind','slab');
  assert.equal(await page.locator('#dvV16Engine').inputValue(),'ximilar');
  await upload('#dvV16GalleryFile','tests/fixtures/slab-pokemon-074-084.svg');
  await waitForResult('Retourorden','074/084');
  assert.equal(providerCalls,3);assert.equal(await page.locator('[data-v16-check]').isDisabled(),true);
  await page.locator('.dvV16Recovery summary').click();await page.locator('[data-v16-confirm]').first().click();
  assert.equal(await page.locator('[data-v16-check]').isDisabled(),true,'card confirmation does not confirm slab label');
  await page.locator('[data-v16-slab] [name=certificateNumber]').fill('00123457');
  await page.locator('[data-v16-slab] button').click();
  assert.equal(await page.locator('[data-v16-check]').isEnabled(),true);
  await page.locator('[data-v16-check]').check();
  assert.equal(await page.locator('.dvV16Market').count(),0,'no raw price presented as graded value');
  const slabEvidence=await page.evaluate(()=>{const r=window.DV_SCAN_V16.batch[0];return{id:r.id.code,language:r.best.language,ratio:r.capturePhoto.width/r.capturePhoto.height,slab:r.slab,benchmark:window.DV_SCAN_V16_BENCHMARK.load().at(-1)}});
  assert.equal(slabEvidence.id,'074/084');assert.equal(slabEvidence.language,'DE');assert.ok(Math.abs(slabEvidence.ratio-730/1180)<.005);
  assert.equal(slabEvidence.benchmark.results[0].capture_kind,'slab');
  await page.screenshot({path:resolve(root,'test-results/v16-slab-review.png'),fullPage:true});
  await page.click('#dvV16ImportBtn');await page.locator('#dvV16Complete:not(.dvV16Hidden)').waitFor();
  const graded=await page.evaluate(()=>window.__lastImportPayload);
  assert.equal(graded.grading_company,'PSA');assert.equal(graded.grade,9);assert.equal(graded.cert_number,'00123457');assert.equal(graded.market_price,null);assert.equal(graded.card_number,'074/084');
  await page.selectOption('#dvV16Engine','local');

  // Same real image, actual public catalogs; no mocked OCR, identifier or provider.
  if(process.env.V16_LIVE_CATALOG==='1'){
    assert.deepEqual(errors,[],'hermetic browser tests must have no console errors');liveCatalogPhase=true;
    await page.unroute('https://api.tcgdex.net/**');
    await page.reload({waitUntil:'domcontentloaded'});
    await page.locator('#dvV16Dialog[open]').waitFor({timeout:15000});
    await upload('#dvV16GalleryFile','tests/fixtures/retourorden-iphone.png');
    await waitForResult('Retourorden','074/084');
    const live=await page.evaluate(()=>{const r=window.DV_SCAN_V16.batch[0];return{id:r.id.code,catalogId:r.best.catalogId,language:r.best.language,observed:r.observedLanguage,status:r.status}});
    assert.equal(live.catalogId,'me05-074');assert.equal(live.language,'DE');
    if(assetDiagnostics.length){
      assert.equal(live.status,'review','blocked reference artwork must never auto-confirm the result');
      assert.equal(await page.locator('[data-v16-check]').isDisabled(),true);
      assert.equal(await page.locator('.dvV16Market').count(),0);
      await page.locator('.dvV16Details summary').click();
      assert.match(await page.locator('.dvV16Explain').innerText(),/REFERENZBILD NICHT PRÜFBAR/);
      console.log('PUBLIC ASSET LIMITATION (fail-closed review verified):',JSON.stringify(assetDiagnostics));
    }
    console.log('LIVE RECOGNITION PROOF:',JSON.stringify(live));
    await page.screenshot({path:resolve(root,'test-results/v16-real-iphone-live-catalog.png'),fullPage:true});
  }

  assert.deepEqual(errors,[],`browser errors: ${errors.join(' | ')}`);
  console.log('PASS: real Tesseract pixel OCR → normalized identifier → production catalog adapter → correct Pokemon/One Piece candidate → evidence/result → benchmark; manual recovery and error-state recovery');
}catch(error){
  failure=error;
  await mkdir(resolve(root,'test-results'),{recursive:true});
  await page.screenshot({path:resolve(root,'test-results/v16-failure.png'),fullPage:true}).catch(()=>{});
  console.error('Failure state:',JSON.stringify(await page.evaluate(()=>({status:document.getElementById('dvV16Status')?.textContent,rows:window.DV_SCAN_V16?.batch?.map(r=>({id:r.id,best:r.best?.name,quality:r.quality,failureType:r.failureType,lookup:r.lookupInfo})),errors:String(window.__DV_V16_LOAD_ERROR||'')})).catch(()=>null)));
}finally{
  await Promise.race([browser.close(),new Promise(resolveTimeout=>setTimeout(resolveTimeout,5000))]);
  server.closeAllConnections();
  server.close();
}
clearTimeout(watchdog);
if(failure)console.error(failure);
process.exit(failure?1:0);
