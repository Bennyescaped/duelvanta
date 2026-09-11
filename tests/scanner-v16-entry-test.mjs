import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const code=readFileSync(new URL('../scanner-v16-entry.js',import.meta.url),'utf8');
function fixture(){
  const events={},scripts=[],button={setAttribute(){},removeAttribute(){},insertAdjacentElement(_where,node){this.status=node}};
  const context={document:{getElementById:()=>button,createElement:()=>({setAttribute(){},style:{}}),addEventListener:(name,fn)=>events[name]=fn,body:{appendChild:node=>scripts.push(node)}},selectedScanTcg:'pokemon'};
  context.window=context;context.URLSearchParams=URLSearchParams;context.location={search:''};vm.createContext(context);vm.runInContext(code,context);
  return{context,button,scripts,events};
}
const {context,button,scripts,events}=fixture();
assert.equal(scripts.length,1);
button.onclick();button.onclick();
assert.match(button.status.textContent,/geladen/);
let opens=0;context.DV_SCAN_V16={open:async()=>{opens++}};context.__DV_V16_READY=true;
events['dv:v16:ready']();events['dv:v16:ready']();
assert.equal(opens,1,'repeated taps during loading open once');
button.onclick();assert.equal(opens,2,'existing scanner can reopen without navigation');
vm.runInContext(code,context);assert.equal(scripts.length,1,'entry is safe to load twice');
let tcg;context.DV_SCAN_V16_CATALOG={lookup:(_id,options)=>{tcg=options.tcg;return[]}};
context.catalogLookup({code:'OP05-119'},{tcg:'one_piece'});assert.equal(tcg,'one_piece');
const failed=fixture();failed.scripts[0].onerror();failed.button.onclick();
assert.match(failed.button.status.textContent,/neu laden/);
console.log('PASS integrated scanner readiness, repeated taps, catalog context and load failure');
