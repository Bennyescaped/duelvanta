import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {dirname,extname,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const testDir=dirname(fileURLToPath(import.meta.url));
const root=resolve(testDir,'..');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.css':'text/css; charset=utf-8','.txt':'text/plain; charset=utf-8'};
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
const errors=[];
page.on('pageerror',error=>errors.push(error.message));
page.on('console',message=>{if(message.type()==='error')errors.push(message.text())});

async function upload(button,fixture){
  const chooser=page.waitForEvent('filechooser');
  await page.click(button);
  await (await chooser).setFiles(resolve(testDir,'fixtures',fixture));
}

async function waitForResult(name,number){
  await page.waitForFunction(()=>document.getElementById('dvV16Status')?.textContent?.includes('Analyse fertig'),null,{timeout:30000});
  await page.locator('#dvV16Results').getByText(name,{exact:false}).waitFor({timeout:5000});
  assert.match(await page.locator('#dvV16Results').innerText(),new RegExp(number.replace('/','\\/'),'i'));
  assert.equal(await page.evaluate(()=>window.DV_SCAN_V16.controller.state),'result');
}

try{
  console.log('E2E: open direct mobile route');
  await page.goto(`${base}/scanner-v16.html?e2e=1`,{waitUntil:'domcontentloaded'});
  await page.locator('#dvV16Dialog[open]').waitFor({timeout:15000});
  assert.equal(await page.locator('iframe').count(),0,'direct mobile route must not contain an iframe');
  assert.equal(await page.locator('input[type=file]').count(),2,'camera and gallery must have separate inputs');

  await page.click('#dvV16Close');
  await page.click('#dvV16BenchLaunch');
  await page.selectOption('#dvV16BenchScenario','pokemon_standard');
  await page.fill('#dvV16BenchCode','183/196');
  await page.selectOption('#dvV16BenchLang','DE');
  await page.click('#dvV16BenchArm');
  await page.click('#dvV16BenchClose');
  await page.click('#dvV16Launch');
  await page.selectOption('#dvV16Tcg','pokemon');
  console.log('E2E: upload Pokemon fixture');
  await upload('#dvV16Choose','pokemon-183-196.svg');
  await waitForResult('Galar-Mauzinger V','183/196');

  await page.click('#dvV16Close');
  await page.click('#dvV16BenchLaunch');
  await page.waitForFunction(()=>document.getElementById('dvV16BenchObserved')?.textContent?.includes('Galar-Mauzinger V'),null,{timeout:5000});
  await page.click('[data-v16-verdict="correct"]');
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('duelvanta_scanner_v16_eval_v1')).entries.length),1,'benchmark result was not persisted');
  await page.click('#dvV16BenchClose');

  await page.click('#dvV16Launch');
  await page.selectOption('#dvV16Tcg','one_piece');
  console.log('E2E: upload One Piece fixture');
  await upload('#dvV16Choose','onepiece-op05-119.svg');
  await waitForResult('Monkey D. Luffy','OP05-119');

  await page.click('#dvV16Retry');
  console.log('E2E: upload invalid fixture and verify recovery');
  await upload('#dvV16Choose','invalid-upload.txt');
  await page.waitForFunction(()=>document.getElementById('dvV16Status')?.textContent?.includes('kein Bild'),null,{timeout:5000});
  assert.equal(await page.evaluate(()=>window.DV_SCAN_V16.controller.state),'error');
  assert.equal(await page.locator('#dvV16Choose').isEnabled(),true,'gallery button stayed locked after a decoding error');
  await page.click('#dvV16Retry');
  assert.equal(await page.evaluate(()=>window.DV_SCAN_V16.controller.state),'idle');
  assert.equal(await page.locator('#dvV16Choose').isEnabled(),true,'gallery button did not recover');

  assert.deepEqual(errors,[],`browser errors: ${errors.join(' | ')}`);
  console.log('PASS: mobile Chromium photo upload, Pokemon, One Piece, recovery and benchmark E2E');
}finally{
  await browser.close();
  await new Promise(resolveClose=>server.close(resolveClose));
}
