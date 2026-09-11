import assert from 'node:assert/strict';

globalThis.window=globalThis;
globalThis.document={getElementById:()=>null,querySelectorAll:()=>[]};
globalThis.MutationObserver=class{};
globalThis.setInterval=()=>0;
let calls=[];
globalThis.fetch=async url=>{
  calls.push(String(url));
  if(String(url).includes('frankfurter.dev'))return{ok:true,json:async()=>({rate:.85})};
  if(String(url).includes('/cards/fixture-074'))return{ok:true,json:async()=>({id:'fixture-074',pricing:{cardmarket:{updated:'2026-09-11','trend':.07,'low':.02,'avg1':.06,'avg7':.05,'avg30':.04}}})};
  throw new Error('unexpected '+url);
};
await import('../scanner-v16-market.js');

const onePiece={tcg:'one_piece',name:'Sanji (Parallel)',set:'Romance Dawn',number:'OP01-013',language:'EN',marketUsd:12};
const op=await DV_SCAN_V16_MARKET.enrich(onePiece);
assert.equal(op.trend,10.2);assert.equal(onePiece.marketEur,10.2);assert.match(onePiece.priceSource,/OPTCG API/);
const sameKey={...onePiece,marketEur:null,priceSource:null};
await DV_SCAN_V16_MARKET.enrich(sameKey);
assert.equal(sameKey.marketEur,10.2,'cached pricing must still populate the card that will be imported');
assert.equal(calls.filter(x=>x.includes('frankfurter.dev')).length,1);

const pokemon={tcg:'pokemon',catalogId:'fixture-074',name:'Retourorden',set:'Dunkelnacht',number:'074/084',language:'DE',variant:'Uncommon'};
const pk=await DV_SCAN_V16_MARKET.enrich(pokemon);
assert.equal(pk.trend,.07);assert.equal(pokemon.marketEur,.07);assert.equal(pk.dataQuality,100);
console.log('PASS: One Piece USD→EUR and Pokémon Cardmarket values populate cached candidates before collection import.');
