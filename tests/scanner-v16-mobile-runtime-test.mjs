import assert from 'node:assert/strict';

await import('../scanner-v16-runtime.js');
const runtime=globalThis.DV_SCAN_V16_RUNTIME;
assert.equal(runtime.version,'16.9.0-lab');

const states=[];
let analyzed=0,closed=0;
const controller=runtime.createController({
  decode:async file=>({width:630,height:880,name:file.name,close:()=>closed++}),
  analyze:async source=>{analyzed++;return{mode:'single',tcg:'pokemon',results:[],sourceName:source.name}},
  onState:event=>states.push(event.state)
});
const file=new File(['fixture'],'pokemon-183-196.jpg',{type:'image/jpeg'});
const result=await controller.run(file,{mode:'single',tcg:'pokemon'});
assert.equal(result.sourceName,'pokemon-183-196.jpg');
assert.equal(analyzed,1);
assert.equal(closed,1);
assert.deepEqual(states,['decoding','preview','analyzing','result']);
assert.equal(controller.busy,false);
assert.equal(controller.state,'result');

const failures=[];
const broken=runtime.createController({decode:async()=>({width:1,height:1}),analyze:async()=>{throw new Error('ocr_failed')},onState:event=>failures.push(event.state)});
await assert.rejects(()=>broken.run(file),/ocr_failed/);
assert.equal(broken.busy,false);
assert.equal(broken.state,'error');
broken.recover();
assert.equal(broken.state,'idle');
assert.deepEqual(failures,['decoding','preview','analyzing','error','idle']);

let bindings=0;
const target={dataset:{},addEventListener:()=>bindings++};
assert.equal(runtime.bindOnce(target,'click','capture',()=>{}),true);
assert.equal(runtime.bindOnce(target,'click','capture',()=>{}),false);
assert.equal(bindings,1,'capture handler must only bind once');
console.log('PASS: Scanner V16.9 photo pipeline, analysis start, state recovery and duplicate binding guard');
