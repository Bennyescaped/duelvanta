// Synthetic provider transport and recording DB; never a native DB acceptance.
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {gzipSync} from 'node:zlib';
import {Readable} from 'node:stream';
import {createRequire,syncBuiltinESMExports} from 'node:module';
import assert from 'node:assert/strict';
export const fixture=JSON.parse(await readFile(new URL('../fixtures/tcg-i3-magic/source-ingest-v1.json',import.meta.url),'utf8'));
export const clone=v=>JSON.parse(JSON.stringify(v));
export const uuid=n=>'50000000-0000-4000-8000-'+n.toString(16).padStart(12,'0');
export const card=extra=>({...clone(fixture.card),...extra});
export async function sandbox(fn){const path=await mkdtemp(join(tmpdir(),'duelvanta-m5-'));try{return await fn(path);}finally{await rm(path,{recursive:true,force:true});}}
export function sourceFixture({cards=[card()],jsonl=null,compressed=null,manifest={},pages=fixture.pages,schedule=[],chunkSize=17}={}){
 const raw=jsonl===null?Buffer.from(cards.map(r=>JSON.stringify(r)).join('\n')+'\n'):Buffer.from(jsonl),gzip=compressed===null?gzipSync(raw):Buffer.from(compressed);
 const bound={...clone(fixture.manifest),compressed_size:gzip.length,...manifest};let now=Date.parse(fixture.clock);const calls=[],delays=[];
 const clock=()=>now,sleep=async ms=>{assert.ok(ms>=0);delays.push(ms);now+=ms;};
 const transport=async(url,options)=>{
  calls.push({url,options:{...options,signal:undefined},at:now});const next=schedule.shift();if(next?.error)throw new Error('injected secret that must never enter reports');
  const status=next?.status??200;let bytes;
  if(next?.bytes!==undefined)bytes=Buffer.from(next.bytes);
  else if(url==='https://api.scryfall.com/bulk-data')bytes=Buffer.from(JSON.stringify({object:'list',has_more:false,data:[bound]}));
  else if(url===bound.jsonl_download_uri)bytes=gzip;
  else {const p=pages.find(p=>p.url===url);assert.ok(p,'No card/image/other endpoint permitted: '+url);bytes=Buffer.from(p.raw);}
  async function* chunks(){if(next?.bodyError)throw new Error('transport credential SECRET_MUST_NOT_LOG');for(let i=0;i<bytes.length;i+=chunkSize)yield bytes.subarray(i,i+chunkSize);}
  return {status,url:next?.url??url,redirected:next?.redirected??false,headers:new Headers(next?.headers??{}),body:Readable.from(chunks())};
 };
 return {transport,clock,sleep,calls,delays,manifest:bound,gzip,jsonl:raw,advance:ms=>{now+=ms;}};
}
export function recordingDB({failAt=null,snapshot=null,generation='7',owner='postgres',major=17}={}){
 const calls=[],rowsByStage={header:[],sets:[],cards:[],variants:[],records:[]};let transaction=false,published=false;
 const query=async(sql,params=[])=>{
  calls.push({sql,params});if(failAt&&(typeof failAt==='function'?failAt(sql,params):sql.includes(failAt)))throw new Error('recording DB injected failure');
  if(sql.startsWith('select current_user'))return {rows:[{owner,server_version_num:String(major*10000+11),security_ready:true,legal_ready:true,generation,snapshot}]};
  if(sql==='begin'){transaction=true;return {rows:[]};}
  if(sql==='rollback'){transaction=false;published=false;return {rows:[]};}
  if(sql==='commit'){transaction=false;return {rows:[]};}
  if(sql.startsWith('insert into pg_temp.')){assert.ok(transaction);const match=sql.match(/stage_(\w+)\(([^)]+)\)/),cols=match[2].split(',');const row=Object.fromEntries(cols.map((k,i)=>[k,params[i]]));rowsByStage[match[1]].push(row);return {rows:[]};}
  if(sql.includes('select dv_collect_private.tcg_publish_catalog_snapshot_v1')){assert.ok(transaction);published=true;return {rows:[{id:snapshot?.id??params[0]}]};}
  assert.ok(sql.includes('create temporary table'));return {rows:[]};
 };
 return {query,calls,rowsByStage,state:()=>({transaction,published}),engine:'recording-sequence-only'};
}
export function forbidExternalIO(){
 const require=createRequire(import.meta.url),originals=[];let attempts=0;const fail=()=>{attempts++;throw Error('FORBIDDEN_EXTERNAL_IO');};
 const set=(object,key)=>{originals.push([object,key,object[key]]);object[key]=fail;};
 for(const k of ['fetch','WebSocket','XMLHttpRequest'])set(globalThis,k);
 for(const [name,keys] of Object.entries({'node:http':['get','request'],'node:https':['get','request'],'node:net':['connect','createConnection'],'node:tls':['connect'],'node:dns':['lookup','resolve','resolve4','resolve6']})){const m=require(name);for(const k of keys)set(m,k);}
 set(require('node:net').Socket.prototype,'connect');
 const dns=require('node:dns');for(const o of [dns,dns.promises,dns.Resolver.prototype,dns.promises.Resolver.prototype])for(const k of Object.getOwnPropertyNames(o))if(/^(?:lookup|resolve|reverse)/.test(k)&&typeof o[k]==='function')set(o,k);
 syncBuiltinESMExports();
 return {attempts:()=>attempts,restore:()=>{for(const [o,k,v] of originals)o[k]=v;syncBuiltinESMExports();}};
}
