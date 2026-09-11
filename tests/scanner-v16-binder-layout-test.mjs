import assert from 'node:assert/strict';

globalThis.window=globalThis;
globalThis.setInterval=()=>0;
globalThis.clearInterval=()=>{};
await import('../scanner-v16-binder.js');

const moved={id:'moved',binder_page:1,binder_slot:1};
const loose=Array.from({length:10},(_,i)=>({id:`loose-${i+1}`,binder_page:null,binder_slot:null}));
assert.equal(DV_SCAN_V16_BINDER_LAYOUT.pageCount(11,[moved]),2,'eleven cards with one fixed position must use two pages, not split fixed and loose pages');
let slots=DV_SCAN_V16_BINDER_LAYOUT.composeSlots([moved],loose,2);
assert.equal(slots.length,18);
assert.equal(slots[0],moved,'fixed card must retain its chosen position');
assert.deepEqual(slots.slice(1,9).map(x=>x.id),loose.slice(0,8).map(x=>x.id),'unpositioned cards must fill remaining first-page slots');
assert.deepEqual(slots.slice(9,11).map(x=>x.id),loose.slice(8).map(x=>x.id),'overflow must continue on the next page');
assert.ok(slots.slice(11).every(x=>x===null));

const late={id:'late',binder_page:4,binder_slot:9};
assert.equal(DV_SCAN_V16_BINDER_LAYOUT.pageCount(2,[late]),4,'an explicitly selected later page must remain available');
slots=DV_SCAN_V16_BINDER_LAYOUT.composeSlots([late],[{id:'first'}],4);
assert.equal(slots[0].id,'first');
assert.equal(slots[35],late,'explicit late-page placement must remain addressable');
console.log('PASS: fixed binder positions and legacy/unpositioned cards share compact pages without hiding cards.');
