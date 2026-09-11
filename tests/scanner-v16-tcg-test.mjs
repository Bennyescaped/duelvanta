import assert from 'node:assert/strict';
await import('../scanner-v16-tcg.js');
const t=globalThis.DV_SCAN_V16_TCG;
assert.ok(t,'TCG recognition module missing');

assert.equal(t.normalizePokemonCode('062 / 063'),'62/63');
for(const code of ['215/203','223/197','198/165'])assert.equal(t.pokemonIds(code)[0]?.code,code,'secret rares can exceed the printed set count');
for(const text of ['0/100','215/0','1234/203'])assert.equal(t.pokemonIds(text).length,0);
assert.deepEqual(t.pokemonIds('Karte 062/063 DE').map(x=>x.code),['062/063']);

for(const [raw,expected] of [
  ['OP05-119','OP05-119'],
  ['OPOS-119','OP05-119'],
  ['0P05-119','OP05-119'],
  ['OP5 119','OP05-119'],
  ['ST1-012','ST01-012'],
  ['EB1-006','EB01-006'],
  ['PRB1-001','PRB01-001'],
  ['P-001','P-001']
]) assert.equal(t.normalizeOnePieceCode(raw),expected,`One Piece normalization failed: ${raw}`);

const ranked=t.rankCandidates([
  {number:'OP05-119',confidence:72,v16Visual:88,name:'Variant A'},
  {number:'OP05-119',confidence:72,v16Visual:54,name:'Variant B'}
],{tcg:'one_piece',id:{code:'OP05-119'},qualityScore:80,visualReliable:true});
assert.equal(ranked.rows[0].name,'Variant A','stronger artwork match should win parallel/variant ranking');
assert.ok(ranked.gap>0,'variant ranking should expose a candidate gap');
assert.ok(ranked.variantConfidence>0,'variant confidence should be calculated');

console.log('PASS: Scanner V16.2 Pokemon/One Piece OCR normalization and variant ranking');
