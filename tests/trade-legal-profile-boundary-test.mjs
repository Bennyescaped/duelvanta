// Evaluate the exact modified profile functions against private, local fixtures.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
let source,bootSnippet,eventSnippet;
if(process.argv[2]==='--manifest'){
 const patch=JSON.parse(await readFile(process.argv[3],'utf8'));
 const replacements=patch.changes.find(c=>c.path==='profile.js').replacements;
 source=replacements.find(r=>r.find.startsWith('async function loadBuyerProfile')).replace+'\n'+replacements.find(r=>r.find.startsWith('async function saveBuyerProfile')).replace;
 bootSnippet=replacements.find(r=>r.find.startsWith('await Promise.all')).replace;
 eventSnippet=replacements.find(r=>r.find.includes('.onclick=saveBuyerProfile')).replace;
}else{
 const profile=await readFile(new URL('../profile.js',import.meta.url),'utf8');
 const start=profile.indexOf('async function loadBuyerProfile(){'),end=profile.indexOf('async function checkUsername(){',start);
 assert.ok(start>=0&&end>start,'profile boundary functions must exist');
 source=profile.slice(start,end);bootSnippet=profile;eventSnippet=profile;
}
assert.ok(bootSnippet.includes('await Promise.all([loadFolders(),loadDefaultAddress()]);void loadBuyerProfile()'),'legal profile must not block ordinary profile boot');
assert.ok(eventSnippet.includes("'dv:trade-legal-schema'"),'profile reacts to completed compatibility check');
let checks=0;
for(const available of [undefined,false,true]){
 const calls=[],messages=[],nodes={buyerPurchaseType:{value:'consumer'},saveBuyerPurchaseType:{disabled:false}};
 const context=vm.createContext({window:available===undefined?{}:{DV_TRADE_LEGAL_SCHEMA:{available}},$:(id)=>nodes[id],msg:(...args)=>messages.push(args),db:{rpc:async(name)=>{calls.push(name);return{data:{configured:true,buyer_type:'consumer'},error:null}}}});
 vm.runInContext(source,context);
 await vm.runInContext('loadBuyerProfile();',context);await vm.runInContext('saveBuyerProfile();',context);
 assert.equal(calls.length,available===true?2:0,'missing/false guard must block direct profile calls');checks++;
 if(available!==true){assert.match(messages.at(-1)[1],/gesperrt/);checks++}
}
for(const name of ['loadBuyerProfile','saveBuyerProfile']){
 const nodes={buyerPurchaseType:{value:'consumer'},saveBuyerPurchaseType:{disabled:false}},messages=[];
 const context=vm.createContext({window:{DV_TRADE_LEGAL_SCHEMA:{available:true}},$:(id)=>nodes[id],msg:(...args)=>messages.push(args),db:{rpc:async()=>{throw Error('disconnected')}}});
 vm.runInContext(source,context);await vm.runInContext(name+'()',context);
 assert.match(messages.at(-1)[1],/konnte nicht/);assert.equal(nodes.saveBuyerPurchaseType.disabled,false);checks+=2;
}
console.log(`PASS: ${checks+2} profile boundary checks; direct calls fail closed, legal lookup detached from normal boot, failures handled`);
