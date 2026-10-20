/* Explicit dependency bootstrap for existing isolated consumer VM fixtures.
 * No assertions, provider calls or fixture inputs are changed. */
'use strict';
const vm=require('node:vm'),base=require('../../tcg-v1-consumers.js');
// In-memory fixture responders are defined in the host realm. Rehome only this
// artificial VM bridge; browser transports and I1 validation stay unchanged.
const copy=x=>JSON.parse(JSON.stringify(x));
const consumer=Object.freeze({...base,translate:(raw,key,context)=>base.translate(copy(raw),key,copy(context))});
globalThis.DV_TCG_V1_CONSUMERS=consumer;
function inject(context){if(context){context.DV_TCG_V1_CONSUMERS=consumer;if(context.window)context.window.DV_TCG_V1_CONSUMERS=consumer;}return context;}
for(const name of ['runInNewContext','runInContext']){const original=vm[name];vm[name]=function(code,context,...rest){return original.call(this,code,inject(context),...rest)};}
