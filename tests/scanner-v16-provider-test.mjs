import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

globalThis.window=globalThis;
await import('../scanner-v16-tcg.js');
await import('../scanner-v16-recovery.js');
await import('../scanner-v16-quality.js');
await import('../scanner-v16-provider.js');
// Real core and wrappers, deterministic canvas/catalog boundary. No provider calls.
globalThis.document={createElement:()=>({width:630,height:880,getContext:()=>({drawImage(){},getImageData(_x,_y,w,h){const data=new Uint8ClampedArray(w*h*4);for(let i=0;i<data.length;i+=4){const v=i%8?190:70;data.set([v,v,v,255],i)}return{data}}})})};
let ocrCalls=0,lookups=0,available=true,wrongLanguage=false;
globalThis.Tesseract={recognize:async()=>{ocrCalls++;throw Error('Provider evidence must not repeat OCR')}};
const fixtureCards=[
  ['pokemon','074/084','DE','Retourorden','Backtrack Badge','PBL',null],
  ['pokemon','045/084','DE','Rameidon ex','Rampardos ex','PBL',null],
  ['pokemon','091/084','DE','Moruda','Dhelmise','PBL',null],
  ['pokemon','021/063','JP','メッソン','Sobble','M1S',null],
  ['one_piece','OP17-043','EN','Ganzui','Ganzui','OP17','OP17-043'],
  ['one_piece','OP17-019','EN','Event','Event','OP17','OP17-019'],
  ['one_piece','OP04-083','EN','Sabo','Sabo','OP04','OP04-083_R2'],
  ['one_piece','ST29-009','EN','Nico Robin','Nico Robin','ST29','ST29-009_P1']
];
globalThis.catalogLookup=async(id,{tcg})=>{
  lookups++;if(!available)return[];
  const f=fixtureCards.find(f=>f[0]===tcg&&DV_SCAN_V16_TCG.idCode({code:f[1]},tcg)===DV_SCAN_V16_TCG.idCode(id,tcg));
  return f?[{name:f[3],number:f[1],language:wrongLanguage?'JP':f[2],tcg,catalogVerified:true,set:'Independent fixture catalog'}]:[];
};
const storage=new Map();globalThis.localStorage={getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)};
await import('../scanner-v16-core.js');DV_SCAN_V16_QUALITY.install();
await import('../scanner-v16-resilience.js');DV_SCAN_V16_RESILIENCE.install();
await import('../scanner-v16-benchmark.js');
await new Promise(resolve=>setTimeout(resolve,65));
const file=new File(['same original bytes'],'original.jpg',{type:'image/jpeg'});
const sha256=createHash('sha256').update('same original bytes').digest('hex');
const proposalFor=f=>{
  const [tcg,code,language,,name]=f;
  return {model:'gpt-5.4-mini',selectedTcg:tcg,sha256,elapsedMs:2500,status:'proposal',observed:{tcg,printed_code:code,name,language,set_name:null,rarity:null,variant:null,needs_review:true},usage:{inputTokens:2000,outputTokens:100},estimatedCostUsd:.00195};
};
for(const f of fixtureCards){
  const proposal=proposalFor(f);await DV_SCAN_V16_PROVIDER.verifyPhoto(file,proposal);
  const pack=await DV_SCAN_V16_CORE.analyze({width:630,height:880},{tcg:f[0],providerObservation:proposal,providerReplay:true});
  const r=pack.results[0];
  assert.equal(DV_SCAN_V16_TCG.idCode(r.id,f[0]),DV_SCAN_V16_TCG.idCode({code:f[1]},f[0]));
  assert.equal(r.best.name,f[3]);assert.equal(r.best.language,f[2]);
  assert.equal(r.identifierSource,'openai');assert.equal(r.providerEvidence.printingId,null);
  assert.equal(r.identifierEvidence,null,'AI recognition is not multiple OCR votes');
  assert.equal(r.status,'review');assert.equal(pack.ready,0);
  assert.equal(DV_SCAN_V16_RECOVERY.canConfirm(r,r.best),false,'replayed tests never import');
  const b=DV_SCAN_V16_BENCHMARK.load().at(-1).results[0];
  assert.equal(b.identifier_source,'openai');assert.equal(b.provider_printing_id,null);assert.equal(b.provider_replay,true);
}
assert.equal(ocrCalls,0);assert.equal(DV_SCAN_V16_BENCHMARK.load().length,8);
const p=proposalFor(fixtureCards[0]);
const multi=await DV_SCAN_V16_CORE.analyze({width:1260,height:1760},{mode:'multi',layout:'2x2',tcg:'pokemon',providerObservations:[p,p,p,p]});
assert.equal(multi.results.length,4);assert.ok(multi.results.every(r=>r.identifierSource==='openai'&&r.id.code==='074/084'));
await assert.rejects(()=>DV_SCAN_V16_PROVIDER.verifyPhoto(new File(['different'],'other.jpg'),p),/anderen Foto/);
await assert.rejects(()=>DV_SCAN_V16_CORE.analyze({width:630,height:880},{tcg:'one_piece',providerObservation:p}),/Kartenspiel/);
await assert.rejects(()=>DV_SCAN_V16_CORE.analyze({width:630,height:880},{mode:'binder',tcg:'pokemon',providerObservation:p}),/genau eine Karte/);
const before=lookups;
const conflict=await DV_SCAN_V16_CORE.analyze({width:630,height:880},{tcg:'pokemon',providerObservation:{...p,status:'tcg_conflict'}});
assert.equal(conflict.results[0].best,null);assert.equal(lookups,before);assert.equal(ocrCalls,0);
available=false;
const miss=(await DV_SCAN_V16_CORE.analyze({width:630,height:880},{tcg:'pokemon',providerObservation:p})).results[0];
assert.equal(miss.failureType,'catalog_no_match');assert.match(miss.captureGuidance.title,/KATALOG/);assert.equal(miss.best,null);
available=true;wrongLanguage=true;
const wrong=(await DV_SCAN_V16_CORE.analyze({width:630,height:880},{tcg:'pokemon',providerObservation:p})).results[0];
assert.equal(wrong.best,null);assert.equal(wrong.failureType,'language_ambiguity');
wrongLanguage=false;
const live=(await DV_SCAN_V16_CORE.analyze({width:630,height:880},{tcg:'pokemon',providerObservation:p})).results[0];
assert.equal(live.status,'review');DV_SCAN_V16_RECOVERY.confirm(live,0);assert.equal(live.selected,true);
console.log('PASS: OpenAI evidence → original V16 catalog/language/quality/result/benchmark; exact-photo binding, no invented OCR, no replay imports, conflicts and no-match recovery.');
