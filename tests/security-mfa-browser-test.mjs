// Chromium UI integration plus Edge handler execution with isolated Auth/service fixtures.
// No real MFA enrollment, sessions, provider requests, invites or email. SQL authority is tested separately in PostgreSQL17.
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
import {chromium} from 'playwright';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const out=new URL('../test-results/security-step9a-browser/',import.meta.url);await mkdir(out,{recursive:true});
const results=[];
const src=await read('mfa.js'),html=(await read('mfa.html')).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{}),args:['--no-sandbox']});
try{
 for(const width of [390,1363]){
  const page=await browser.newPage({viewport:{width,height:900}});
  await page.route('**/*',route=>route.fulfill({contentType:'text/html',body:route.request().url().includes('/mfa.html')?html+'<script>'+src+'</script>':'<body>Isolated destination</body>'}));
  await page.addInitScript(()=>{
   window.calls=[];window.fixtureVerified=false;
   window.DV_SUPABASE={environment:'preview',url:'https://xhmjxrcskfhbovhitdej.supabase.co',key:'sb_publishable_isolatedfixture'};
   window.supabase={createClient:()=>({from:()=>({select:()=>({eq:()=>({single:async()=>({data:{role:'judge'}})})})}),auth:{getSession:async()=>({data:{session:{user:{id:'synthetic'}}}}),mfa:{
    getAuthenticatorAssuranceLevel:async()=>({data:{currentLevel:'aal1'}}),listFactors:async()=>({data:{totp:window.fixtureVerified?[{id:'synthetic-factor',status:'verified'}]:[]}}),
    enroll:async()=>{calls.push('enroll');return {data:{id:'synthetic-factor',totp:{qr_code:'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>',secret:'NOT-A-REAL-MFA-SECRET'}}}},
    challenge:async()=>{calls.push('challenge');return{data:{id:'synthetic-challenge'}}},
    verify:async({code})=>{calls.push('verify');if(code!=='123456')return{error:{message:'synthetic invalid code'}};window.fixtureVerified=true;return{data:{}}},unenroll:async()=>({})}}})};
  });
  await page.goto('https://isolated.invalid/mfa.html?required=1&next=battle.html');
  await page.waitForFunction(()=>document.getElementById('secret').textContent==='NOT-A-REAL-MFA-SECRET');
  assert.equal(await page.locator('#enroll').isVisible(),true);
  await page.fill('#enrollCode','000000');await page.click('#verifyEnroll');await page.waitForFunction(()=>document.getElementById('msg').textContent.includes('synthetic invalid code'));
  assert.ok(page.url().includes('mfa.html'));await page.screenshot({path:new URL(`mfa-denied-${width}.png`,out).pathname,fullPage:true});
  await page.fill('#enrollCode','123456');await page.click('#verifyEnroll');await page.waitForURL('**/battle.html');results.push({width,case:'actual MFA page: failed challenge stays closed; fixture success navigates',passed:true});
  await page.close();
 }
 const p=await browser.newPage();await p.setContent('<section id="judgeDesk" class="hidden"><div id="judgeCases"></div></section>');
 await p.evaluate(()=>{window.profile={role:'moderator'};window.currentMatch=null;window.user={id:'fixture'};window.db={rpc:async()=>({error:{message:'mfa_step_up_required'}})}});
 await p.addScriptTag({content:await read('battle-moderation.js')});await p.evaluate(()=>DV_BATTLE_MOD.loadDesk());
 assert.equal(await p.locator('a[href="mfa.html?required=1&next=battle.html"]').count(),1);
 await p.evaluate(()=>{window.profile.role='player'});await p.evaluate(()=>DV_BATTLE_MOD.loadDesk());assert.equal(await p.locator('#judgeDesk').getAttribute('class'),'hidden');
 results.push({case:'Judge/Moderator step-up link; normal player not enrolled by staff flow',passed:true});await p.close();
}finally{await browser.close()}
// Execute the real Edge source with isolated clients, not only a source regex.
let edgeSource=(await read('supabase/functions/owner-invite-beta-user/index.ts')).replace(/^import .*;$/gm,'');
edgeSource=stripTypeScriptTypes(edgeSource,{mode:'strip'});
for(const c of [{name:'AAL1',access:{owner:false,privileged:false}},{name:'revoked',error:{message:'session revoked'}},{name:'nonowner staff',access:{owner:false,privileged:true}},{name:'owner AAL2',access:{owner:true,privileged:true}}]){
 let handler,adminClients=0,invites=0;const rpc=[];
 const user={auth:{getUser:async()=>({data:{user:{id:'synthetic-owner'}}})},rpc:async name=>{rpc.push(name);return{data:c.access,error:c.error}}};
 const admin={auth:{admin:{inviteUserByEmail:async()=>{invites++;return{data:{user:{id:'synthetic-invite'}}}}}},from:()=>({insert:async()=>({})})};
 const context={Request,Response,console,createClient:(_url,key)=>key==='fixture-service'?(adminClients++,admin):user,Deno:{env:{get:key=>({SUPABASE_URL:'https://isolated.invalid',SUPABASE_ANON_KEY:'fixture-anon',SUPABASE_SERVICE_ROLE_KEY:'fixture-service'})[key]},serve:fn=>{handler=fn}}};
 vm.runInNewContext(edgeSource,context);
 const response=await handler(new Request('https://isolated.invalid/invite',{method:'POST',headers:{Authorization:'Bearer synthetic-fixture','Content-Type':'application/json'},body:JSON.stringify({email:'fixture@example.invalid'})}));
 assert.deepEqual(rpc,['get_my_privileged_access_v1']);
 if(c.name==='owner AAL2'){assert.equal(response.status,200);assert.equal(invites,1)}else{assert.equal(response.status,403);assert.equal(adminClients,0);assert.equal(invites,0)}
 results.push({case:'actual Edge handler '+c.name,passed:true,realMail:false});
}
await writeFile(new URL('results.json',out),JSON.stringify({synthetic:true,liveMfaPass:false,results},null,2)+'\n');console.log('PASS: Step 9A Chromium/Edge boundaries',results.length,'cases; no live MFA/email');
