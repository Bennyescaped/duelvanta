import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import pilot from '../benchmark/scanner-pilot/ximilar-server.cjs';

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
  const [tcg,code,language,,name,set_code,card_id]=f;
  const [num,den]=code.split('/');
  const raw={records:[{_objects:[{name:'Card',_ocr:{lang:language,full_text:code},_identification:{best_match:{name,card_number:tcg==='pokemon'?String(Number(num)):code.split('-')[1],out_of:tcg==='pokemon'&&set_code!=='M1S'?den:undefined,set_code,card_id,subcategory:tcg==='pokemon'?'Pokemon':'One Piece'},alternatives:[],distances:[0.1]}}]}]};
  return {...pilot.parseResponse(raw,tcg),model:pilot.MODEL,selectedTcg:tcg,sha256,elapsedMs:2500};
};
for(const f of fixtureCards){
  const proposal=proposalFor(f);await DV_SCAN_V16_PROVIDER.verifyPhoto(file,proposal);
  const pack=await DV_SCAN_V16_CORE.analyze({width:630,height:880},{tcg:f[0],providerObservation:proposal,providerReplay:true});
  const r=pack.results[0];
  assert.equal(DV_SCAN_V16_TCG.idCode(r.id,f[0]),DV_SCAN_V16_TCG.idCode({code:f[1]},f[0]));
  assert.equal(r.best.name,f[3]);assert.equal(r.best.language,f[2]);
  assert.equal(r.identifierSource,'ximilar');assert.equal(r.providerEvidence.printingId,f[6]);
  assert.equal(r.identifierEvidence,null,'AI recognition is not multiple OCR votes');
  assert.equal(r.status,'review');assert.equal(pack.ready,0);
  assert.equal(DV_SCAN_V16_RECOVERY.canConfirm(r,r.best),false,'replayed tests never import');
  const b=DV_SCAN_V16_BENCHMARK.load().at(-1).results[0];
  assert.equal(b.identifier_source,'ximilar');assert.equal(b.provider_printing_id,f[6]);assert.equal(b.provider_replay,true);
}
assert.equal(ocrCalls,0);assert.equal(DV_SCAN_V16_BENCHMARK.load().length,8);
const p=proposalFor(fixtureCards[0]);
await assert.rejects(()=>DV_SCAN_V16_PROVIDER.verifyPhoto(new File(['different'],'other.jpg'),p),/anderen Foto/);
await assert.rejects(()=>DV_SCAN_V16_CORE.analyze({width:630,height:880},{tcg:'one_piece',providerObservation:p}),/TCG/);
await assert.rejects(()=>DV_SCAN_V16_CORE.analyze({width:630,height:880},{mode:'binder',tcg:'pokemon',providerObservation:p}),/genau eine Karte/);
const before=lookups;
const conflict=await DV_SCAN_V16_CORE.analyze({width:630,height:880},{tcg:'pokemon',providerObservation:{...p,identifierConflict:true}});
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
console.log('PASS: Ximilar evidence → original V16 catalog/language/quality/result/benchmark; exact-photo replay, no invented OCR, no replay imports, conflicts and no-match recovery.');
