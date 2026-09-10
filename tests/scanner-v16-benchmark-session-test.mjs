import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
globalThis.DV_SCAN_V16_TCG={
  normalizeOnePieceCode:x=>String(x||'').replace(/\s/g,'').toUpperCase().replace(/^OP5-/,'OP05-'),
  normalizePokemonCode:x=>String(x||'').replace(/\s/g,'').replace(/^0+(\d+\/)/,'$1')
};
await import('../scanner-v16-benchmark-session.js');
const b=globalThis.DV_SCAN_V16_BENCH_SESSION;
assert.ok(b,'benchmark session module missing');
assert.equal(b.normalizeCode('one_piece','OP5-119'),'OP05-119');
assert.equal(b.normalizeLanguage('deutsch'),'DE');
assert.equal(b.variantFamily('Parallel Alt Art','one_piece'),'parallel');
let v=b.suggestVerdict({tcg:'one_piece',mode:'single',code:'OP05-119',language:'EN',variant:'Parallel'},{tcg:'one_piece',results:[{number:'OP05-119',language:'EN',variant_family:'parallel'}]});
assert.equal(v.verdict,'correct');
v=b.suggestVerdict({tcg:'pokemon',mode:'single',code:'025/165',language:'DE'},{tcg:'pokemon',results:[{number:'025/165',language:'EN'}]});
assert.equal(v.verdict,'wrong_language');
v=b.suggestVerdict({tcg:'one_piece',mode:'single',code:'OP05-119'},{tcg:'one_piece',results:[]});
assert.equal(v.verdict,'no_hit');
const session={name:'Test',entries:[
  {expected:{mode:'single'},observed:{elapsed_ms:800,ready:1},verdict:'correct'},
  {expected:{mode:'single'},observed:{elapsed_ms:1200,ready:0},verdict:'wrong_variant'},
  {expected:{mode:'binder',expected_count:9},observed:{elapsed_ms:3000},verdict:'batch',correct_slots:7}
]};
const m=b.metrics(session);
assert.equal(m.accuracy,50);
assert.equal(m.batch_accuracy,78);
assert.equal(m.average_ms,1667);
assert.ok(b.report(session).includes('Multi/Binder Slots: 7/9 korrekt'));
const loader=await readFile(new URL('../scanner-v16-loader.js',import.meta.url),'utf8');
const lab=await readFile(new URL('../scanner-v16-lab.html',import.meta.url),'utf8');
assert.ok(loader.includes('scanner-v16-benchmark-session.js?v=16.9.0'),'V16.9 benchmark session not loaded');
assert.ok(lab.includes("location.replace('scanner-v16.html'"),'legacy lab route must forward to direct V16 page');
assert.ok(!loader.includes('service_role'),'benchmark loader must not expose service_role');
console.log('PASS: Scanner V16.9 benchmark session ground truth, metrics and direct-route wiring');
