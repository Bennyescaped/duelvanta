import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';
const results=JSON.parse(readFileSync(process.argv[2]||'test-results/battle-safety-sanctions-preparation.json'));
assert.equal(results.passed,true);assert.ok(results.ui.causes.length);
const source=readFileSync('control-center.js','utf8');
const fn=source.slice(source.indexOf('async function reviewReport('),source.indexOf("document.querySelectorAll('.tab')",source.indexOf('async function reviewReport(')));
const calls=[];const context={db:{rpc:async(n,p)=>{calls.push({n,p});return {}}},confirm:()=>true,prompt:()=> 'synthetic correction',alert:()=>{},loadAll:async()=>{},render:()=>{}};
vm.createContext(context);vm.runInContext(fn,context);
await context.reviewReport('report','restrict');assert.equal(calls[0].n,'moderate_battle_report');
await context.reviewReport('report','warning');assert.equal(calls[1].n,'review_battle_report');
for(const held of [false,true]){
 const {window}=parseHTML('<html><body><nav class="tabs"></nav><h2 id="sectionTitle"></h2><div id="content"></div></body></html>');
 let state=structuredClone(results.ui);state.data_rights_blocked=held;
 const writes=[];
 const c={window,document:window.document,$:id=>window.document.getElementById(id),tab:'safety',render:()=>{},data:{profiles:[{id:state.target_id,role:'player',display_name:'Synthetic player'}]},
 prompt:()=> 'reviewed correction',confirm:()=>true,alert:()=>{},db:{rpc:async(n,p)=>{if(n==='get_owner_battle_safety_causes')return {data:state};writes.push({n,p});state={...state,causes:state.causes.map(x=>({...x,active:false}))};return {data:{safety_restricted:false}}}}};
 vm.createContext(c);vm.runInContext(readFileSync('control-center-safety.js','utf8'),c);c.render();
 const select=c.$('safetyTarget');Object.defineProperty(select,'value',{value:state.target_id,configurable:true});await select.onchange();
 const action=c.$('safetyCauses').querySelector('button');assert.ok(action);assert.equal(action.disabled,held);
 if(!held){await action.onclick();assert.equal(writes.length,1);assert.equal(writes[0].n,'owner_unrestrict_battle_sanction');assert.equal(writes[0].p.p_sanction_id,results.ui.causes[0].id);assert.equal(c.$('safetyCauses').querySelector('button'),null);}
 else assert.equal(writes.length,0);
}
assert.match(readFileSync('control-center-auth-preflight.js','utf8'),/control-center-safety.js/);
console.log('PASS: actual Control Center restriction routing and correction DOM; SQL-derived cause ID; held target disabled; refresh after correction');
