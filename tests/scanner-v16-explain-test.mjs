import assert from 'node:assert/strict';
await import('../scanner-v16-explain.js');
const e=globalThis.DV_SCAN_V16_EXPLAIN;
assert.ok(e,'explainability module missing');

const opA={name:'Luffy',number:'OP05-119',v16Visual:91,v16Score:108,v16Language:'EN',v16VariantFamily:'parallel',v16ExactId:true};
const opB={name:'Luffy',number:'OP05-119',v16Visual:72,v16Score:91,v16Language:'EN',v16VariantFamily:'standard',v16ExactId:true};
let data=e.explain({status:'ready',confidence:95,candidates:[opA,opB],best:opA,visualGap:19,quality:{score:82,reflectionRisk:false,glare:1.2},reviewReasons:['exact_id','variant_art_separated','art_leader_gap']},'one_piece');
assert.equal(data.headline,'STARKER TREFFER');
assert.ok(data.evidence.some(x=>x.label==='Kartennummer'&&x.value==='OCR/Katalog gleich · noch unbestätigt'&&x.kind==='neutral'));
assert.equal(data.rivals.length,2);

let variant=e.explain({status:'review',confidence:82,candidates:[opA,opB],best:opA,visualGap:3,quality:{score:78,reflectionRisk:false,glare:1},reviewReasons:['variant_ambiguity']},'one_piece');
assert.equal(variant.headline,'PRÜFEN · VARIANTE NICHT EINDEUTIG');
assert.ok(variant.warnings.includes('Variante nicht eindeutig'));

const de={name:'Pikachu',number:'025/165',v16Visual:80,v16Language:'DE',v16VariantFamily:'standard'};
const en={name:'Pikachu',number:'025/165',v16Visual:78,v16Language:'EN',v16VariantFamily:'standard'};
let lang=e.explain({status:'review',confidence:81,candidates:[de,en],best:de,visualGap:2,quality:{score:74,reflectionRisk:false,glare:0.8},reviewReasons:['language_ambiguity'],languageAmbiguity:true},'pokemon');
assert.equal(lang.headline,'PRÜFEN · SPRACHE NICHT EINDEUTIG');

let foil=e.explain({status:'review',confidence:77,candidates:[opA],best:opA,quality:{score:64,reflectionRisk:true,glare:12.5,centerGlare:16.2},reviewReasons:['reflection_guard']},'one_piece');
assert.equal(foil.headline,'PRÜFEN · REFLEXION ERKANNT');
assert.ok(foil.evidence.some(x=>x.label==='Reflexion'));

let manual=e.explain({status:'ready',confidence:95,candidates:[opA,opB],best:opA,quality:{score:82}},'one_piece',{candidateIndex:1});
assert.equal(manual.headline,'MANUELL AUSGEWÄHLT · BITTE PRÜFEN');
assert.ok(e.panelHtml(data).includes('TOP-KANDIDATEN · ARTWORK-VERGLEICH'));

console.log('PASS: Scanner V16.4 explainable confidence headlines, evidence chips and rival comparison');
