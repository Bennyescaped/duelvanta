// DUELVANTA ProviderCanonicalJSON V1. Pure serialization; no acquisition.
import {createHash} from 'node:crypto';
export const contract='ProviderCanonicalJSON',version='1';
export const limits=Object.freeze({depth:20,array:1000,record:1048576,derivation:16384});
const fail=code=>{throw new TypeError('TCG evidence: '+code);};
const unsafe=new Set(['__proto__','prototype','constructor']);
function scalarString(s){
 if(s.includes('\0'))fail('unicode_nul');
 for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);if(c>=0xd800&&c<=0xdbff){const d=s.charCodeAt(++i);if(!(d>=0xdc00&&d<=0xdfff))fail('unpaired_surrogate');}else if(c>=0xdc00&&c<=0xdfff)fail('unpaired_surrogate');}
 return JSON.stringify(s);
}
export function canonicalJSON(value,maxBytes=limits.record){
 const seen=new Set();
 function walk(v,depth){
  if(depth>limits.depth)fail('depth_limit');
  if(v===null)return 'null';
  if(typeof v==='string')return scalarString(v);
  if(typeof v==='boolean')return String(v);
  if(typeof v==='number'){if(!Number.isFinite(v)||Number.isInteger(v)&&!Number.isSafeInteger(v))fail('number_invalid');return JSON.stringify(v);}
  if(typeof v!=='object')fail('json_type_invalid');
  if(seen.has(v))fail('cycle');seen.add(v);
  const keys=Reflect.ownKeys(v),ds=Object.getOwnPropertyDescriptors(v);
  if(keys.some(k=>typeof k!=='string'))fail('symbol_key');
  if(keys.some(k=>!Object.hasOwn(ds[k],'value')))fail('accessor');
  let out;
  if(Array.isArray(v)){
   if(Object.getPrototypeOf(v)!==Array.prototype)fail('prototype');
   if(v.length>limits.array)fail('array_limit');
   if(keys.length!==v.length+1||keys.some(k=>k!=='length'&&(!/^(0|[1-9][0-9]*)$/.test(k)||Number(k)>=v.length)))fail('array_shape');
   const parts=[];for(let i=0;i<v.length;i++){if(!Object.hasOwn(ds,String(i)))fail('sparse_array');parts.push(walk(ds[String(i)].value,depth+1));}out='['+parts.join(',')+']';
  }else{
   if(![Object.prototype,null].includes(Object.getPrototypeOf(v)))fail('prototype');
   const sorted=keys.sort();out='{'+sorted.map(k=>{if(unsafe.has(k))fail('unsafe_key');if(!ds[k].enumerable)fail('nonenumerable');return scalarString(k)+':'+walk(ds[k].value,depth+1);}).join(',')+'}';
  }
  seen.delete(v);return out;
 }
 const text=walk(value,0);if(Buffer.byteLength(text,'utf8')>maxBytes)fail('size_limit');return text;
}
// Token parser detects duplicate decoded keys BEFORE construction/JSON.parse.
export function parseProviderJSON(input,maxBytes=limits.record){
 if(typeof input==='string')scalarString(input);
 const b=typeof input==='string'?Buffer.from(input,'utf8'):Buffer.from(input);
 if(b.length>maxBytes)fail('size_limit');
 if(b.length>=3&&b[0]===239&&b[1]===187&&b[2]===191)fail('bom');
 let text;try{text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(b);}catch{fail('utf8');}
 let i=0;const ws=()=>{while(/[\t\n\r ]/.test(text[i]??'!'))i++;};
 const string=()=>{const start=i++;let escaped=false;while(i<text.length){const c=text[i++];if(!escaped&&c==='"'){try{return JSON.parse(text.slice(start,i));}catch{fail('json_syntax');}}if(!escaped&&c==='\\')escaped=true;else escaped=false;}fail('json_syntax');};
 function token(depth){ws();if(depth>limits.depth)fail('depth_limit');const c=text[i];
  if(c==='"')return string();
  if(c==='{'){i++;ws();const out=Object.create(null),keys=new Set();if(text[i]==='}'){i++;return out;}for(;;){ws();if(text[i]!=='"')fail('json_syntax');const key=string();if(keys.has(key))fail('duplicate_key');if(unsafe.has(key))fail('unsafe_key');keys.add(key);ws();if(text[i++]!==':')fail('json_syntax');out[key]=token(depth+1);ws();const sep=text[i++];if(sep==='}')return out;if(sep!==',')fail('json_syntax');}}
  if(c==='['){i++;ws();const out=[];if(text[i]===']'){i++;return out;}for(;;){out.push(token(depth+1));if(out.length>limits.array)fail('array_limit');ws();const sep=text[i++];if(sep===']')return out;if(sep!==',')fail('json_syntax');}}
  for(const [literal,v] of [['true',true],['false',false],['null',null]])if(text.startsWith(literal,i)){i+=literal.length;return v;}
  const n=text.slice(i).match(/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/);if(!n)fail('json_syntax');i+=n[0].length;return Number(n[0]);
 }
 const out=token(0);ws();if(i!==text.length)fail('json_syntax');canonicalJSON(out,maxBytes);return out;
}
export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
export function detachedFrozen(value,maxBytes=limits.record){
 const v=JSON.parse(canonicalJSON(value,maxBytes));const freeze=x=>{if(x&&typeof x==='object'){for(const y of Object.values(x))freeze(y);Object.freeze(x);}return x;};return freeze(v);
}
export function prepareProviderEvidence(raw_record){
 const canonical_utf8=canonicalJSON(raw_record),content_sha256=sha256(Buffer.from(canonical_utf8,'utf8'));
 return Object.freeze({raw_record:detachedFrozen(raw_record),canonical_utf8,content_sha256,record_version:'sha256:'+content_sha256});
}
