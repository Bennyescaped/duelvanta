import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright';

test('R22 browser: native camera/gallery, local OCR, correction, cancellation and fail-closed',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  let external=0;await page.route('**/*',route=>{external++;return route.abort();});
  await page.setContent('<button id="anchor">V16</button><section id="edit"></section>');
  for(const f of ['scanner-v16-runtime.js','scanner-v16-native-camera.js','scanner-v16-core.js','scanner-v16-ocr.js','tcg-magic-camera.js'])await page.addScriptTag({content:readFileSync(new URL('../'+f,import.meta.url),'utf8')});
  await page.evaluate(()=>{
   window.allowed=true;window.observation='0344 R\nDSK • EN';window.confirmations=[];window.reads=0;
   window.Tesseract={createWorker:async()=>({setParameters:async()=>{},recognize:async canvas=>{if(!(canvas instanceof HTMLCanvasElement))throw Error('not local canvas');window.reads++;if(window.slow)await new Promise(r=>window.finish=r);return {data:{text:window.observation}};},terminate(){}})};
   window.pilot=DV_MAGIC_CAMERA.mount({document,anchor:document.querySelector('#anchor'),editAnchor:document.querySelector('#edit'),authorize:async()=>window.allowed,onConfirm:(v,c)=>window.confirmations.push({v,c})});
  });
  await page.click('#magicCameraLaunch');
  const cameraChooser=page.waitForEvent('filechooser');await page.click('#magicCameraPhoto');await cameraChooser;
  assert.equal(await page.locator('#magicCameraFile').getAttribute('capture'),'environment');
  const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=630;c.height=880;c.getContext('2d').fillRect(0,0,630,880);return c.toDataURL('image/png').split(',')[1];});
  const file={name:'synthetic.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')};
  await page.locator('#magicCameraFile').setInputFiles(file);
  await page.waitForFunction(()=>document.querySelector('#magicCameraNumber').value==='0344');
  assert.equal(await page.locator('#magicCameraRaw').textContent(),'0344 R\nDSK • EN');
  assert.equal(await page.evaluate(()=>confirmations.length),0);assert.equal(external,0);
  await page.click('#magicCameraConfirm');assert.equal(await page.evaluate(()=>confirmations[0].v.collector_number),'0344');
  await page.evaluate(()=>window.observation='0373 R\nECL • EN');await page.click('#magicCameraLaunch');
  const galleryChooser=page.waitForEvent('filechooser');await page.click('#magicCameraGallery');await galleryChooser;
  assert.equal(await page.locator('#magicGalleryFile').getAttribute('capture'),null);
  await page.locator('#magicGalleryFile').setInputFiles(file);await page.waitForFunction(()=>document.querySelector('#magicCameraNumber').value==='0373');
  await page.click('#magicCameraConfirm');assert.equal(await page.evaluate(()=>confirmations[1].v.set_code),'ECL');
  await page.evaluate(()=>window.observation='0344\n0373\nDSK • EN\nECL • EN');await page.click('#magicCameraLaunch');
  await page.locator('#magicGalleryFile').setInputFiles(file);await page.waitForFunction(()=>document.querySelector('#magicCameraStatus').textContent.includes('Nicht eindeutig'));
  await page.click('#magicCameraConfirm');assert.equal(await page.evaluate(()=>confirmations.length),2);
  await page.fill('#magicCameraSet','DSK');await page.fill('#magicCameraNumber','0344');await page.selectOption('#magicCameraLanguage','EN');await page.click('#magicCameraConfirm');
  assert.equal(await page.evaluate(()=>confirmations.length),3);
  await page.click('#magicCameraLaunch');await page.evaluate(()=>{window.slow=true;});await page.locator('#magicGalleryFile').setInputFiles(file);
  await page.waitForFunction(()=>!!window.finish);await page.click('#magicCameraCancel');await page.evaluate(()=>{window.finish();window.slow=false;});
  await page.click('#magicCameraLaunch');assert.equal(await page.inputValue('#magicCameraNumber'),'');assert.equal(await page.locator('#magicCameraConfirm').isDisabled(),false);
  await page.evaluate(()=>window.allowed=false);await page.fill('#magicCameraSet','DSK');await page.fill('#magicCameraNumber','0344');await page.selectOption('#magicCameraLanguage','EN');await page.click('#magicCameraConfirm');assert.equal(await page.evaluate(()=>confirmations.length),3);
  await page.click('#magicCameraCancel');await page.click('#magicCameraLaunch');assert.equal(await page.locator('#magicCameraDialog').evaluate(d=>d.open),false);
  await page.evaluate(()=>{window.allowed=true;DV_SCAN_V16_NATIVE_CAMERA.open=()=>{throw Error('NotAllowedError')}});await page.click('#magicCameraLaunch');await page.click('#magicCameraPhoto');assert.match(await page.locator('#magicCameraStatus').textContent(),/nicht verfügbar/);
  assert.equal(external,0);
 }finally{await browser.close();}
});
