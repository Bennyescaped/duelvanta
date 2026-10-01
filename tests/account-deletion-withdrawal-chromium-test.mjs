// Real Chromium, synthetic Auth/RPC and intercepted requests only.
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const html=(await readFile(new URL('../account-deletion-withdrawal.html',import.meta.url),'utf8')).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,''),script=await readFile(new URL('../account-deletion-withdrawal.js',import.meta.url),'utf8');
await mkdir('test-results/c-withdrawal-chromium',{recursive:true});const results=[];
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{}),args:['--no-sandbox']});
try{for(const width of [390,1363])for(const deny of [false,true]){
 const page=await browser.newPage({viewport:{width,height:900}});
 await page.route('**/*',r=>r.fulfill({contentType:'text/html',body:html+'<script>'+script+'</script>'}));
 await page.addInitScript(({deny})=>{
 window.calls=[];window.fixtureAal='aal2';window.DV_SUPABASE={url:'https://isolated.invalid',key:'synthetic'};
 window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:{}}}),getUser:async()=>({data:{user:{id:'own',email:'own@example.invalid'}}}),signInWithPassword:async()=>{calls.push('signin');fixtureAal='aal1';return{};},mfa:{getAuthenticatorAssuranceLevel:async()=>({data:{currentLevel:fixtureAal,nextLevel:'aal2'}}),listFactors:async()=>({data:{totp:[{id:'fixture',status:'verified'}]}}),challenge:async()=>({data:{id:'fixture'}}),verify:async({code})=>{if(code!=='123456')return{error:{message:'invalid'}};calls.push('mfa');fixtureAal='aal2';return{};}}},rpc:async(name,args)=>{calls.push(name);if(name==='get_my_account_deletion_requests')return{data:[{request_id:'concrete-request',status:'processing'}]};if(name==='begin_my_account_deletion_withdrawal')return{data:'challenge'};if(deny)return{error:{message:'c_prepare_or_history_unresolved'}};return{data:{withdrawn:true,request_id:args.p_request_id,receipt_id:'durable-receipt'}};}})};
 },{deny});
 await page.goto('https://isolated.invalid/account-deletion-withdrawal.html');await page.click('#begin');await page.fill('#password','synthetic-password');await page.click('#login');await page.waitForSelector('#factor:visible');assert.equal(await page.evaluate(()=>calls.includes('withdraw_my_account_deletion')),false);
 await page.fill('#code','000000');await page.click('#verify');await page.waitForFunction(()=>!document.getElementById('verify').disabled);assert.equal(await page.evaluate(()=>calls.includes('withdraw_my_account_deletion')),false);
 await page.fill('#code','123456');await page.click('#verify');await page.waitForFunction(()=>document.getElementById('message').textContent.includes('durable-receipt')||document.getElementById('message').textContent.includes('nicht sicher zurückgenommen'));
 assert.equal(await page.locator('#password').inputValue(),'');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 const text=await page.locator('#message').textContent();assert.match(text,deny?/nicht sicher zurückgenommen/:/durable-receipt/);
 await page.screenshot({path:`test-results/c-withdrawal-chromium/${width}-${deny?'denied':'receipt'}.png`,fullPage:true});results.push({width,deny,passed:true});await page.close();
 }}finally{await browser.close();}
await writeFile('test-results/c-withdrawal-chromium/results.json',JSON.stringify({synthetic:true,liveAuth:false,results},null,2));console.log('PASS: C Chromium Auth/MFA/receipt/denial contract',results.length);
