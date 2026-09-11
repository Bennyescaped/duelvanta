import assert from 'node:assert/strict';

globalThis.DV_SCAN_V16_TCG={
  candidateCode:(c)=>String(c?.number||''),
  idCode:(id)=>String(id?.code||''),
  rankCandidates:(cands)=>{const rows=cands.map(c=>({...c,v16Score:Number(c.confidence||70),v16Reasons:[]})).sort((a,b)=>b.v16Score-a.v16Score);return{rows,gap:0,variantConfidence:0}}
};
globalThis.DV_SCAN_V16_CORE={analyze:async()=>({tcg:'one_piece',results:[]})};
await import('../scanner-v16-quality.js');
const q=globalThis.DV_SCAN_V16_QUALITY,t=globalThis.DV_SCAN_V16_TCG;
assert.ok(q?.installed,'quality module should install');
assert.equal(q.languageOf({sourceLang:'ja'}),'JP');
assert.equal(q.languageOf({language:'Deutsch'}),'DE');
assert.equal(q.variantFamily({variant:'Manga Rare'},'one_piece'),'manga');
assert.equal(q.variantFamily({variant:'Parallel Alt Art'},'one_piece'),'parallel');
assert.equal(q.variantFamily({rarity:'Special Illustration Rare'},'pokemon'),'special_illustration');

const strongOp=q.decision({id:{code:'OP05-119'},confidence:96,quality:{score:82,reflectionRisk:false,glare:1},candidates:[
  {number:'OP05-119',language:'EN',variant:'Parallel',image:'a.jpg',v16Visual:88},
  {number:'OP05-119',language:'EN',variant:'Standard',image:'b.jpg',v16Visual:72}
]},'one_piece',t);
assert.equal(strongOp.forceReview,false,'strong clean One Piece artwork separation should pass');

const closeOp=q.decision({id:{code:'OP05-119'},confidence:97,quality:{score:84,reflectionRisk:false,glare:1},candidates:[
  {number:'OP05-119',language:'EN',variant:'Parallel',image:'a.jpg',v16Visual:83},
  {number:'OP05-119',language:'EN',variant:'Standard',image:'b.jpg',v16Visual:79}
]},'one_piece',t);
assert.equal(closeOp.forceReview,true,'close One Piece variants must require review');
assert.ok(closeOp.reasons.includes('variant_ambiguity'));
assert.ok(closeOp.evidenceConfidence<=83,'ambiguous match confidence must be capped');

const langPokemon=q.decision({id:{code:'62/63'},confidence:95,quality:{score:85,reflectionRisk:false,glare:1},candidates:[
  {number:'62/63',sourceLang:'de',image:'de.jpg',v16Visual:80},
  {number:'62/63',sourceLang:'en',image:'en.jpg',v16Visual:76}
]},'pokemon',t);
assert.equal(langPokemon.forceReview,true,'close Pokemon language variants must require review');
assert.ok(langPokemon.reasons.includes('language_ambiguity'));

const foil=q.decision({id:{code:'OP05-119'},confidence:98,quality:{score:79,reflectionRisk:true,glare:9,centerGlare:10},candidates:[
  {number:'OP05-119',variant:'Parallel',image:'a.jpg',v16Visual:84},
  {number:'OP05-119',variant:'Standard',image:'b.jpg',v16Visual:70}
]},'one_piece',t);
assert.equal(foil.forceReview,true,'reflection risk must prevent weak visual auto-confirmation');
assert.ok(foil.reasons.includes('reflection_guard'));

const ranked=t.rankCandidates([
  {number:'OP05-119',confidence:72,variant:'Parallel',image:'a.jpg',v16Visual:88},
  {number:'OP05-119',confidence:72,variant:'Standard',image:'b.jpg',v16Visual:76}
],{tcg:'one_piece',id:{code:'OP05-119'},visualReliable:true});
assert.equal(ranked.rows[0].image,'a.jpg');
assert.ok(ranked.rows[0].v16Reasons.includes('art_leader_gap'),'clear visual leader should receive evidence bonus');
assert.ok(ranked.gap>0);

console.log('PASS: Scanner V16.3 evidence gates for One Piece variants, Pokemon language ambiguity and foil reflection');

// Near-identical Winner printings must retain their ordering without turning a
// sub-point artwork gap into a confident variant decision.
const nearWinner=[
 {number:'P-001',language:'EN',name:'Luffy Online Winner',image:'online.jpg',confidence:88,v16Visual:99.63},
 {number:'P-001',language:'EN',name:'Luffy Offline Winner',image:'offline.jpg',confidence:88,v16Visual:100}
];
const precise=globalThis.DV_SCAN_V16_TCG.rankCandidates(nearWinner,{tcg:'one_piece',id:{code:'P-001'},qualityScore:95});
assert.equal(precise.rows[0].image,'offline.jpg');
const narrow=globalThis.DV_SCAN_V16_QUALITY.decision({id:{code:'P-001'},identifierReliable:true,candidates:precise.rows,best:precise.rows[0],confidence:99,quality:{score:95}},'one_piece');
assert.equal(narrow.forceReview,true);assert.ok(narrow.reasons.includes('variant_ambiguity'));
