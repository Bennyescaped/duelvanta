import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {dirname,extname,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const server=createServer(async(req,res)=>{
  try{
    const path=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
    if(!path.startsWith(root+sep))throw new Error('Invalid path');
    const body=await readFile(path);
    res.writeHead(200,{'Content-Type':({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json'})[extname(path)]||'application/octet-stream'});res.end(body);
  }catch{res.writeHead(404);res.end()}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
page.setDefaultTimeout(15000);
const errors=[],requests=[];let calls=0;
const diagnostic={recognition:{get:0,post:0,requests:[],responses:[]},optcg:{requests:[],responses:[]},catalog:[],browser:{pageerrors:[],console:[]},dom:[]};
page.on('pageerror',e=>errors.push(e.message));
page.on('request',r=>requests.push(r.url()));
page.on('pageerror',e=>diagnostic.browser.pageerrors.push({at:Date.now(),name:e.name,message:e.message,stack:e.stack}));
page.on('console',message=>{if(['warning','error'].includes(message.type()))diagnostic.browser.console.push({at:Date.now(),type:message.type(),text:message.text()})});
async function observeDom(phase){
  const state=await page.evaluate(()=>{
    const results=document.getElementById('dvV16Results');
    const visible=element=>!!(element.offsetWidth||element.offsetHeight||element.getClientRects().length)&&getComputedStyle(element).visibility!=='hidden';
    return{at:Date.now(),status:document.getElementById('dvV16Status')?.textContent,resultsText:results?.innerText,resultsHtml:results?.innerHTML,
      approveCount:document.querySelectorAll('[data-v16-approve]').length,candidateCount:document.querySelectorAll('.dvV16Candidate').length,resultCount:document.querySelectorAll('.dvV16Result').length,
      debug:[...document.querySelectorAll('.dvV16Debug')].map(element=>element.textContent),visibleButtons:[...(results?.querySelectorAll('button')||[])].filter(visible).map(element=>element.textContent.trim()),
      catalogPartiallyFailed:!!results?.textContent.includes('Katalogzugriff teilweise fehlgeschlagen'),catalog:window.__DV_COLLECT_E2E_DIAGNOSTIC?.catalog||[]};
  });
  diagnostic.catalog=state.catalog;
  diagnostic.dom.push({phase,...state,calls,recognitionGetCount:diagnostic.recognition.get,recognitionPostCount:diagnostic.recognition.post,optcgRequestCount:diagnostic.optcg.requests.length});
}
// Replace external services only. COLLECT, navigation, scanner and binder run unchanged.
await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',route=>route.fulfill({contentType:'text/javascript',body:`
  window.testCollection={clients:0,rows:[],uploads:0};
  window.supabase={createClient:()=>{
    testCollection.clients++;
    const session={user:{id:'collect-test-user'},access_token:'collect-test-session'};
    return {
      auth:{getSession:async()=>({data:{session}}),onAuthStateChange:()=>({}),signOut:async()=>({})},
      from:table=>{
        let insert=null,update=null,id=null;
        const query={
          select:()=>query,order:()=>query,
          eq:(key,value)=>{if(key==='id')id=value;return query},
          insert:row=>{insert=row;return query},update:row=>{update=row;return query},
          single:async()=>{if(insert){const row={...insert,id:'saved-'+(testCollection.rows.length+1)};testCollection.rows.push(row);return{data:row}}return{data:{role:'player'}}},
          then:(resolve,reject)=>Promise.resolve().then(()=>{
            if(update){Object.assign(testCollection.rows.find(r=>r.id===id),update);return{error:null}}
            return{data:table==='collection_folders'?[{id:'binder-one',name:'Mein One Piece Binder',binder_pages:2}]:testCollection.rows};
          }).then(resolve,reject)
        };return query;
      },
      storage:{from:()=>({upload:async()=>{testCollection.uploads++;return{error:null}},createSignedUrl:async()=>({data:{signedUrl:'/tests/fixtures/onepiece-op05-119.svg'}})})}
    };
  }};
`}));
await page.route('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js',route=>route.fulfill({contentType:'text/javascript',body:'window.Tesseract={recognize:async()=>{throw new Error("Unexpected OCR during OpenAI integration test")}}'}));
await page.route('https://fonts.googleapis.com/**',route=>route.fulfill({contentType:'text/css',body:''}));
await page.route(base+'/api/compliance-message-dispatch?runtime_config=1',route=>route.fulfill({contentType:'text/javascript',body:'window.DV_SUPABASE=Object.freeze({url:"https://xhmjxrcskfhbovhitdej.supabase.co",key:"sb_publishable_test_only",environment:"preview"});'}));
await page.route('https://optcgapi.com/**',route=>{
  const url=route.request().url();
  const response=url.includes('/sets/card/OP05-119/')?[{card_set_id:'OP05-119',card_image_id:'OP05-119',card_name:'Monkey D. Luffy',set_name:'Integration fixture',rarity:'SEC',card_image:base+'/tests/fixtures/onepiece-op05-119.svg'}]:[];
  diagnostic.optcg.requests.push({at:Date.now(),url});
  diagnostic.optcg.responses.push({at:Date.now(),url,payload:response,card_images:response.map(card=>card.card_image)});
  return route.fulfill({contentType:'application/json',body:JSON.stringify(response)});
});
await page.route('https://api.tcgdex.net/**',route=>route.fulfill({contentType:'application/json',body:'[]'}));
await page.route('https://api.frankfurter.dev/**',route=>route.fulfill({contentType:'application/json',body:'{"rate":0.85}'}));
await page.route(base+'/api/scanner-v16-recognize',route=>{
  assert.equal(route.request().headers().authorization,'Bearer collect-test-session');
  if(route.request().method()==='GET'){
    const response={active:true,remaining:50-calls,slabRemaining:10};
    diagnostic.recognition.get++;diagnostic.recognition.requests.push({at:Date.now(),method:'GET',url:route.request().url()});
    diagnostic.recognition.responses.push({at:Date.now(),method:'GET',payload:response});
    return route.fulfill({contentType:'application/json',body:JSON.stringify(response)});
  }
  const body=route.request().postDataJSON();calls++;
  diagnostic.recognition.post++;diagnostic.recognition.requests.push({at:Date.now(),method:route.request().method(),url:route.request().url(),body});
  assert.equal(body.tcg,'one_piece');assert.equal(body.kind,'raw');
  const sha256=createHash('sha256').update(Buffer.from(body.imageBase64,'base64')).digest('hex');
  const response={model:'gpt-5.4-mini',selectedTcg:'one_piece',sha256,status:'proposal',observed:{tcg:'one_piece',printed_code:'OP05-119',language:'EN',name:'Monkey D. Luffy',needs_review:true}};
  diagnostic.recognition.responses.push({at:Date.now(),method:route.request().method(),payload:response});
  return route.fulfill({contentType:'application/json',body:JSON.stringify(response)});
});
try{
  await page.goto(base+'/collect.html?binder=binder-one');
  await page.waitForFunction(()=>typeof activeFolder!=='undefined'&&activeFolder==='binder-one');
  await page.click('#scanCard');
  await page.locator('#dvV16Dialog[open]').waitFor();
  const url=page.url();assert.equal(new URL(url).pathname,'/collect.html');
  assert.equal(await page.locator('#dvV16Folder').inputValue(),'binder-one');
  assert.equal(await page.locator('#dvV16Launch,#dvV16BenchLaunch').count(),0,'no duplicate scanner or benchmark launcher');
  assert.equal(requests.some(url=>/scanner-v15|scanner-v16-host|benchmark-session/.test(url)),false,'production loads no old scanner or test host');
  assert.equal(requests.filter(url=>/scanner-v16-binder\.js/.test(url)).length,1,'binder installs once');
  assert.equal(await page.evaluate(()=>testCollection.clients),1,'scanner reuses the existing Supabase client');
  await page.locator('#dvV16EngineField:not(.dvV16Hidden)').waitFor();
  await page.selectOption('#dvV16Tcg','one_piece');
  await page.click('#dvV16Close');await page.click('#scanCard');
  assert.equal(await page.locator('#dvV16Tcg').inputValue(),'one_piece','TCG selection survives reopening within COLLECT');
  await page.evaluate(()=>{
    const catalog=window.DV_SCAN_V16_CATALOG,descriptor=catalog&&Object.getOwnPropertyDescriptor(catalog,'lookup');
    if(!catalog||typeof catalog.lookup!=='function'||!descriptor||!descriptor.writable)throw new Error('Diagnostic catalog lookup is not transparently wrappable');
    const original=catalog.lookup,events=[];
    window.__DV_COLLECT_E2E_DIAGNOSTIC={catalog:events};
    catalog.lookup=async function(...args){
      const input={identifier:args[0],context:args[1]};
      events.push({at:Date.now(),event:'CALL',...input});
      try{
        const result=await original.apply(this,args);
        events.push({at:Date.now(),event:'RETURN',...input,count:result?.length,lookupInfo:result?.lookupInfo});
        return result;
      }catch(error){
        events.push({at:Date.now(),event:'THROW',...input,error:{name:error.name,message:error.message,stack:error.stack},rethrowSameError:true});
        throw error;
      }
    };
  });
  await mkdir(resolve(root,'test-results'),{recursive:true});
  await page.screenshot({path:resolve(root,'test-results/v16-collect-integrated.png')});
  await page.locator('#dvV16GalleryFile').setInputFiles(resolve(root,'tests/fixtures/onepiece-op05-119.svg'));
  await observeDom('after-upload');
  try{
    await page.getByRole('button',{name:'KARTE BESTÄTIGEN',exact:true}).waitFor();
  }catch(error){
    diagnostic.timeout={at:Date.now(),name:error.name,message:error.message,stack:error.stack};
    diagnostic.calls=calls;
    diagnostic.browser.requests=requests.filter(url=>/scanner-v16-recognize|optcgapi/.test(url));
    try{await observeDom('timeout')}catch(observationError){diagnostic.domError={name:observationError.name,message:observationError.message}}
    try{await writeFile(resolve(root,'test-results/tcg-i2-collect-e2e-diagnostic.json'),JSON.stringify(diagnostic,null,2)+'\n')}catch(writeError){console.error('Diagnostic JSON write failed',writeError)}
    try{await page.screenshot({path:resolve(root,'test-results/v16-collect-integrated-after-upload.png')})}catch(screenshotError){console.error('Diagnostic screenshot failed',screenshotError)}
    throw error;
  }
  assert.match(await page.locator('#dvV16Results').innerText(),/Monkey D. Luffy/);
  assert.equal(calls,1);
  await page.getByRole('button',{name:'KARTE BESTÄTIGEN',exact:true}).click();
  await page.click('#dvV16ImportBtn');
  await page.locator('#dvV16Complete:not(.dvV16Hidden)').waitFor();
  assert.equal(await page.locator('#dvV16CompleteText').innerText(),'1 Karte gespeichert.');
  await page.click('#dvV16ViewSaved');
  assert.equal(await page.locator('#dvV16Dialog').getAttribute('open'),null);
  assert.equal(page.url(),url,'view saved card returns to the binder without navigation');
  await page.locator('#slots [data-edit="saved-1"]').waitFor();
  const saved=await page.evaluate(()=>({rows:testCollection.rows,uploads:testCollection.uploads,folder:activeFolder,clients:testCollection.clients}));
  assert.equal(saved.rows.length,1);assert.equal(saved.rows[0].folder_id,'binder-one');
  assert.equal(saved.rows[0].user_id,'collect-test-user');assert.equal(saved.rows[0].tcg,'one_piece');
  assert.equal(saved.uploads,1);assert.equal(saved.clients,1);assert.equal(saved.folder,'binder-one');
  await page.click('#scanCard');assert.equal(await page.locator('#dvV16Dialog').count(),1);
  assert.equal(await page.locator('#dvV16Folder').inputValue(),'binder-one');
  assert.equal(calls,1,'reopening never sends a new paid scan');
  assert.equal(await page.evaluate(()=>document.getElementById('dvV16Dialog').scrollWidth<=document.getElementById('dvV16Dialog').clientWidth+1),true,'mobile dialog fits');
  await page.goto(base+'/scanner-v16.html?folder=binder-one');
  await page.locator('#dvV16Dialog[open]').waitFor();
  assert.equal(new URL(page.url()).pathname,'/collect.html','old shared scanner URL opens the integrated scanner');
  assert.equal(await page.locator('#dvV16Folder').inputValue(),'binder-one');
  assert.equal(await page.evaluate(()=>testCollection.clients),1);
  assert.equal(await page.locator('#dvV16BenchLaunch').count(),0);
  assert.deepEqual(errors,[]);
  console.log('PASS mobile COLLECT → one OpenAI mock → confirm → saved binder → reopen; same URL/session, no lab or V15');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
