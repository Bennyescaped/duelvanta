import assert from 'node:assert/strict';
await import('../scanner-v16-resilience.js');
const r=globalThis.DV_SCAN_V16_RESILIENCE;
assert.ok(r,'resilience module missing');

let g=r.guidanceFor({id:{code:'OP05-119'},quality:{score:61,sharpness:67,brightness:132,glare:10.2,centerGlare:12.4,reflectionRisk:true}},{});
assert.equal(g.code,'reflection');
assert.equal(g.title,'REFLEXION REDUZIEREN');
assert.ok(g.actions.some(x=>x.includes('10–15°')));

g=r.guidanceFor({id:null,quality:{score:52,sharpness:39,brightness:66,glare:1,reflectionRisk:false}},{});
assert.ok(['sharpness','dark','card_code'].includes(g.code));
assert.ok(g.actions.some(x=>x.includes('unteren Kartenbereich')||x.includes('ruhig halten')||x.includes('Umgebungslicht')));

assert.equal(r.shouldRetry({id:null,best:null,quality:{score:55}}),true);
assert.equal(r.shouldRetry({id:{code:'1/100'},best:{name:'A'},quality:{score:70}}),false);
assert.equal(r.shouldRetry({id:null,best:null,quality:{score:10}}),false);

const fakeApi={
  normalizeOnePieceCode:x=>String(x||'').toUpperCase(),
  normalizePokemonCode:x=>String(x||'').replace(/^0+/,'')
};
let v=r.voteIdentifiers([{code:'OP05-119'},{code:'OP05-119'},{code:'OP05-118'}],'one_piece',fakeApi);
assert.equal(v.key,'OP05-119');
assert.equal(v.votes,2);

assert.equal(r.bitSimilarity('11110000','11110000'),1);
assert.equal(r.bitSimilarity('11110000','11100000'),7/8);

const prev={tcg:'one_piece',number:'OP05-119',signature:'11110000',at:1000};
assert.equal(r.isLikelyRepeat(prev,{...prev,at:3000}),true);
assert.equal(r.isLikelyRepeat(prev,{...prev,number:'OP05-120',at:3000}),false);
assert.equal(r.isLikelyRepeat(prev,{...prev,at:6000}),false);

console.log('PASS: Scanner V16.5 retry guidance, identifier voting and continuous repeat guard policy');
