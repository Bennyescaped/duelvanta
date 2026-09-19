import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';
const root=new URL('..',import.meta.url).pathname;
const server=spawn(process.execPath,['tests/trade-ui-server.mjs'],{cwd:root,stdio:['ignore','pipe','pipe']});
await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',code=>reject(Error('server '+code)))});
let browser;
try{
  browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:4173/listing-report.html?listing=30000000-0000-4000-8000-000000000001');
  await page.selectOption('#category','counterfeit');await page.fill('#reporterName','UI Hinweisgeber');await page.fill('#reporterEmail','ui@example.test');await page.fill('#explanation','Die konkreten Merkmale des Angebots begründen den Verdacht auf eine Fälschung.');await page.check('#goodFaith');await page.click('#submitNotice');
  await page.locator('#receipt').waitFor();assert.match(await page.locator('#receipt').innerText(),/DVN-UI-TEST/);
  await page.click('#statusTab');await page.fill('#caseReference','DVN-UI-TEST');await page.fill('#accessCode','A1B2C3D4E5F6');await page.click('#statusForm .primary');await page.locator('#submitAppeal').waitFor();
  assert.match(await page.locator('#statusResult').innerText(),/Automatisierte Entscheidung: Nein/);await page.fill('#appealGrounds','Die Entscheidung soll anhand der vorliegenden Originalbilder erneut menschlich geprüft werden.');await page.click('#submitAppeal');await page.waitForFunction(()=>window.NOTICE_UI_FIXTURE.appealed===true);
  assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1),true);
  console.log('PASS: mobile public notice, receipt, reasoned status and reporter appeal');
}finally{await browser?.close();server.kill()}
