// Actual page/controller with synthetic Auth/RPC; no network, mail or user access.
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {parseHTML} from 'linkedom';
import vm from 'node:vm';
const html=await readFile(new URL('../account-deletion-withdrawal.html',import.meta.url),'utf8'),script=await readFile(new URL('../account-deletion-withdrawal.js',import.meta.url),'utf8');
const results=[];
for(const scenario of ['success','mfa','different-user','prepare-won','lost-response','email']){
 const {window}=parseHTML(html);const document=window.document,store=new Map(),calls=[];let user={id:'own',email:'own@example.invalid'},aal='aal2',stage=0;
 const localStorage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)};
 const db={auth:{getSession:async()=>({data:{session:{user}}}),getUser:async()=>({data:{user}}),signInWithPassword:async()=>{calls.push('signIn');stage=1;if(scenario==='different-user')user={id:'foreign'};if(scenario==='mfa')aal='aal1';return {data:{session:{user}}};},signInWithOtp:async()=>{calls.push('otp');stage=1;return{};},mfa:{getAuthenticatorAssuranceLevel:async()=>({data:{currentLevel:aal,nextLevel:'aal2'}}),listFactors:async()=>({data:{totp:[{id:'factor',status:'verified'}]}}),challenge:async()=>({data:{id:'challenge'}}),verify:async()=>{calls.push('mfa');aal='aal2';return{};}}},rpc:async(name,args)=>{calls.push(name);if(name==='get_my_account_deletion_requests')return{data:[{request_id:'specific-request',status:'requested'}]};if(name==='begin_my_account_deletion_withdrawal')return{data:'auth-challenge'};assert.equal(stage,1);assert.equal(args.p_request_id,'specific-request');assert.equal(args.p_challenge_id,'auth-challenge');if(scenario==='prepare-won')return{error:{message:'c_prepare_or_history_unresolved'}};if(scenario==='lost-response')throw Error('transport');return{data:{withdrawn:true,receipt_id:'durable-receipt',request_id:'specific-request'}};}};
 window.DV_SUPABASE={url:'https://isolated.invalid',key:'publishable-fixture'};window.supabase={createClient:()=>db};
 const context={window,document,localStorage,location:{origin:'https://isolated.invalid'},console};vm.runInNewContext(script,context);
 const settle=()=>new Promise(resolve=>setTimeout(resolve,0));await settle();assert.equal(document.getElementById('requests').hidden,false);
 document.querySelector('#request option').setAttribute('selected','');await document.getElementById('begin').onclick();await settle();assert.equal(calls.includes('withdraw_my_account_deletion'),false);
 if(scenario==='email'){await document.getElementById('emailLink').onclick();await settle();assert.equal(calls.includes('withdraw_my_account_deletion'),false);vm.runInNewContext(script,context);await settle();}
 else{document.getElementById('password').value='synthetic-password';document.getElementById('signin').onsubmit({preventDefault(){}});await settle();assert.equal(document.getElementById('password').value,'');}
 if(scenario==='mfa'){assert.equal(calls.includes('withdraw_my_account_deletion'),false);document.getElementById('code').value='123456';await document.getElementById('verify').onclick();await settle();}
 const text=document.getElementById('message').textContent;
 if(['success','mfa','email'].includes(scenario))assert.match(text,/zurückgenommen.*durable-receipt/);
 else assert.doesNotMatch(text,/wurde zurückgenommen/);
 if(scenario==='different-user')assert.equal(calls.includes('withdraw_my_account_deletion'),false);
 assert.equal(calls.some(x=>/release|unrestrict|delete|prepare/.test(x)&&x!=='withdraw_my_account_deletion'),false);
 results.push({scenario,passed:true,calls});
}
for(const file of ['profile.html','login.html'])assert.match(await readFile(new URL('../'+file,import.meta.url),'utf8'),/href="account-deletion-withdrawal.html"/);
await mkdir('test-results',{recursive:true});await writeFile('test-results/account-deletion-withdrawal-browser.json',JSON.stringify({engine:'linkedom',liveAuth:false,results},null,2));console.log('PASS: C page/controller',results.length,'Auth/MFA/receipt/fail-closed cases and both entry links');
