// Operator-only acquisition. No automatic execution on import. Node built-ins only.
import {createHash,randomUUID} from 'node:crypto';
import {createReadStream,createWriteStream} from 'node:fs';
import {mkdir,readFile,writeFile,rename,rm,readdir,lstat,realpath,open} from 'node:fs/promises';
import {resolve,join,dirname,parse as parsePath} from 'node:path';
import {Readable,Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {createGunzip} from 'node:zlib';
import {performance} from 'node:perf_hooks';
import {parseProviderJSON,canonicalJSON,sha256} from './tcg-catalog-evidence-v1.mjs';
import {validateManifest} from './tcg-catalog-persistence-v1.mjs';
export const LIMITS=Object.freeze({compressed:1073741824,decompressed:17179869184,lines:5000000,line:1048576,sets:67108864,manifest:65536});
export const SETS_FRAMING='ScryfallSetsPages/1';
export const DAY=86400000,RETENTION=7*DAY;
const fail=code=>{throw new TypeError('TCG source: '+code);};
const safeErrorCodes=new Set(["accessor", "acquisition_already_finished", "acquisition_attempts_exhausted", "acquisition_stream", "api_origin", "array_limit", "array_shape", "bom", "bulk_manifest", "bulk_origin", "cache_corrupt", "clock", "clock_rate", "compressed_size", "compressed_size_mismatch", "cycle", "daily_snapshot_limit", "decompressed_size", "depth_limit", "duplicate_key", "empty_line", "empty_snapshot", "gzip_integrity", "http_status", "json_syntax", "json_type_invalid", "jsonl_object", "limit_override", "line_count", "manifest_list", "nonenumerable", "number_invalid", "one_all_cards", "operator_busy", "operator_temp_directory", "prototype", "record_size", "redirect", "repository_provider_data", "response_body", "response_size", "retention_receipt", "sets_next_page", "sets_page", "sets_pagination_cycle", "sets_size", "size_limit", "source_configuration", "source_origin", "sparse_array", "symbol_key", "temp_shape", "temp_symlink", "unicode_nul", "unpaired_surrogate", "unsafe_key", "utc_time", "utf8", "uuid"]);
class Retryable extends Error {constructor(delay=0){super('TCG source: acquisition_transport');this.delay=delay;}}
export function boundedLimits(overrides={}){
 const out={...LIMITS};for(const [k,v] of Object.entries(overrides)){if(!Object.hasOwn(out,k)||!Number.isSafeInteger(v)||v<1||v>out[k])fail('limit_override');out[k]=v;}return Object.freeze(out);
}
export function validateSourceURL(value,kind){
 if(typeof value!=='string'||value.length>500)fail('source_origin');let u;try{u=new URL(value);}catch{fail('source_origin');}
 if(u.protocol!=='https:'||u.username||u.password||u.port||u.search||u.hash||u.href!==value)fail('source_origin');
 if(kind==='bulk'){if(u.origin!=='https://data.scryfall.io'||!/^\/all-cards\/all-cards-\d{14}\.jsonl\.gz$/.test(u.pathname))fail('bulk_origin');}
 else if(u.origin!=='https://api.scryfall.com'||!(kind==='manifest'?u.pathname==='/bulk-data':kind==='sets'&&/^\/sets(?:\/[a-zA-Z0-9_-]+)*$/.test(u.pathname)))fail('api_origin');
 return value;
}
export function selectManifest(bytes){
 const list=parseProviderJSON(bytes,LIMITS.manifest);if(list.object!=='list'||list.has_more!==false||!Array.isArray(list.data))fail('manifest_list');
 const matches=list.data.filter(r=>r.type==='all_cards');if(matches.length!==1)fail('one_all_cards');return validateManifest(matches[0]);
}
export function parseSetsPage(bytes){
 // The aggregate list's data array is not a provider RECORD array. Keep the
 // 1000-element/depth/1MiB guards on each unmodified set, not on page cardinality.
 const b=Buffer.from(bytes);if(b.length>LIMITS.sets)fail('sets_size');let text;
 try{text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(b);}catch{fail('utf8');}
 if(text.charCodeAt(0)===0xfeff)fail('bom');let i=0;const fields=[],data=[];
 const ws=()=>{while(/[\t\r\n ]/.test(text[i]??'!'))i++;};
 const stringEnd=()=>{if(text[i++]!=='"')fail('json_syntax');while(i<text.length){const c=text[i++];if(c==='"')return;if(c==='\\')i++;}fail('json_syntax');};
 const valueEnd=()=>{
  ws();if(text[i]==='"'){stringEnd();return;}
  if(text[i]==='{'||text[i]==='['){const stack=[text[i++]];while(stack.length){if(i>=text.length)fail('json_syntax');const c=text[i];if(c==='"'){stringEnd();continue;}i++;if(c==='{'||c==='['){stack.push(c);if(stack.length>22)fail('depth_limit');}else if(c==='}'||c===']'){if(stack.pop()!==(c==='}'?'{':'['))fail('json_syntax');}}return;}
  const start=i;while(i<text.length&&!/[\s,\]}]/.test(text[i]))i++;if(i===start)fail('json_syntax');
 };
 ws();if(text[i++]!=='{')fail('sets_page');ws();if(text[i]==='}')fail('sets_page');
 for(;;){ws();const keyStart=i;stringEnd();const keyRaw=text.slice(keyStart,i),key=parseProviderJSON(keyRaw);ws();if(text[i++]!==':')fail('json_syntax');ws();const start=i;
  if(key==='data'){
   if(text[i++]!=='[')fail('sets_page');ws();if(text[i]!==']')for(;;){const start=i;valueEnd();const r=parseProviderJSON(text.slice(start,i));if(!r||Array.isArray(r)||r.object!=='set')fail('sets_page');data.push(r);ws();if(text[i]===']')break;if(text[i++]!==',')fail('json_syntax');ws();}
   i++;fields.push(keyRaw+':[]');
  }else{valueEnd();fields.push(keyRaw+':'+text.slice(start,i));}
  ws();if(text[i]==='}'){i++;break;}if(text[i++]!==',')fail('json_syntax');
 }
 ws();if(i!==text.length)fail('json_syntax');const header=parseProviderJSON('{'+fields.join(',')+'}',LIMITS.sets);
 if(header.object!=='list'||typeof header.has_more!=='boolean'||!Array.isArray(header.data))fail('sets_page');return {...header,data};
}
// Exact framing: UTF-8 "ScryfallSetsPages/1\0", then for each page in order:
// uint32be ordinal (1-based), uint32be URL-byte-length, UTF-8 actual URL,
// uint64be raw-byte-length, raw response bytes; final uint32be page-count.
// Framing binds boundaries, order, URLs and bytes; never synthesizes set records.
export function setsPageFraming(pages){
 const hash=createHash('sha256').update(SETS_FRAMING+'\0');let order=0;
 for(const {url,bytes} of pages){validateSourceURL(url,'sets');const b=Buffer.from(bytes),u=Buffer.from(url);const h=Buffer.alloc(8),n=Buffer.alloc(8);h.writeUInt32BE(++order);h.writeUInt32BE(u.length,4);n.writeBigUInt64BE(BigInt(b.length));hash.update(h).update(u).update(n).update(b);}
 const end=Buffer.alloc(4);end.writeUInt32BE(order);return hash.update(end).digest('hex');
}
export async function operatorDirectory(input){
 if(typeof input!=='string'||!input.length)fail('operator_temp_directory');const path=resolve(input);
 // Reject any directory inside a Git worktree, including another checkout.
 let current=path;
 for(;;){try{if((await lstat(join(current,'.git'))).isDirectory()||(await lstat(join(current,'.git'))).isFile())fail('repository_provider_data');}catch(e){if(e.code!=='ENOENT')throw e;}
  if(current===parsePath(current).root)break;current=dirname(current);}
 await mkdir(path,{recursive:true,mode:0o700});const actual=await realpath(path);if(actual!==path)fail('temp_symlink');return path;
}
async function atomicJSON(path,value){const tmp=path+'.'+randomUUID()+'.tmp';await writeFile(tmp,JSON.stringify(value)+'\n',{mode:0o600,flag:'wx'});await rename(tmp,path);}
async function optionalJSON(path){try{return JSON.parse(await readFile(path,'utf8'));}catch(e){if(e.code==='ENOENT')return null;fail('cache_corrupt');}}
export async function cleanupTemporary(tempDir,{clock=()=>Date.now()}={}){
 const root=join(await operatorDirectory(tempDir),'dv-scryfall-source-v1');await mkdir(root,{recursive:true,mode:0o700});const removed=[];
 const receipts=join(root,'receipts');await mkdir(receipts,{recursive:true,mode:0o700});
 const cache=await optionalJSON(join(root,'metadata-cache.json'));
 if(cache&&clock()-cache.cached_at>RETENTION){
  await atomicJSON(join(receipts,'metadata-'+cache.cached_at+'.json'),{cached_at:cache.cached_at,manifest:cache.manifest,manifest_raw_sha256:cache.manifest_raw_sha256,pages:cache.pages.map(({url,bytes,raw_sha256})=>({url,bytes,raw_sha256}))});
  await rm(join(root,'metadata-cache.json'));
 }
 for(const name of await readdir(root)){if(!/^acq-[0-9a-f-]{36}$/.test(name))continue;const path=join(root,name),s=await lstat(path);if(!s.isDirectory()||s.isSymbolicLink())fail('temp_shape');
  const receipt=await optionalJSON(join(path,'retention.json'));if(!receipt||!Number.isFinite(receipt.started_at))fail('retention_receipt');
  if(clock()-receipt.started_at>RETENTION){
   const durable={retention:receipt,envelope:await optionalJSON(join(path,'acquisition-envelope.json')),reject:await optionalJSON(join(path,'reject-report.json')),preparations:[],raw_files_retained:false};
   for(const child of await readdir(path))if(/^prepared-[0-9a-f-]{36}$/.test(child)){
    const p=join(path,child),s=await lstat(p);if(!s.isDirectory()||s.isSymbolicLink())fail('temp_shape');
    const report=await optionalJSON(join(p,'preparation-report.json')),reject=await optionalJSON(join(p,'reject-report.json'));durable.preparations.push({...(report??{}),reject});
   }
   await atomicJSON(join(receipts,name+'.json'),durable);await rm(path,{recursive:true});removed.push(name);
  }}
 return removed;
}
const bodyOf=response=>{if(!response.body)fail('response_body');return typeof response.body.getReader==='function'?Readable.fromWeb(response.body):Readable.from(response.body);};
async function bytesOf(response,max){const chunks=[];let count=0;for await(const chunk of bodyOf(response)){const b=Buffer.from(chunk);count+=b.length;if(count>max)fail('response_size');chunks.push(b);}return Buffer.concat(chunks,count);}
function utc(clock){const n=clock();if(!Number.isFinite(n))fail('clock');return new Date(n).toISOString();}
export async function* jsonlRecords(path,{limits={}}={}){
 const max=boundedLimits(limits);let carry=Buffer.alloc(0),lines=0,bytes=0;
 for await(const chunk of createReadStream(path,{highWaterMark:65536})){
  bytes+=chunk.length;if(bytes>max.decompressed)fail('decompressed_size');const b=Buffer.concat([carry,chunk]);let start=0,index;
  while((index=b.indexOf(10,start))!==-1){let line=b.subarray(start,index);start=index+1;if(line.length>max.line)fail('record_size');if(line.at(-1)===13)line=line.subarray(0,-1);if(!line.length)fail('empty_line');if(++lines>max.lines)fail('line_count');const r=parseProviderJSON(line,max.line);if(!r||Array.isArray(r)||r.object!=='card')fail('jsonl_object');yield r;}
  carry=Buffer.from(b.subarray(start));if(carry.length>max.line)fail('record_size');
 }
 if(carry.length){if(++lines>max.lines)fail('line_count');if(carry.at(-1)===13)carry=carry.subarray(0,-1);if(!carry.length)fail('empty_line');const r=parseProviderJSON(carry,max.line);if(!r||Array.isArray(r)||r.object!=='card')fail('jsonl_object');yield r;}
 if(!lines)fail('empty_snapshot');
}
async function streamBulk(response,dir,manifest,max){
 let compressed=0,decompressed=0;const ch=createHash('sha256'),jh=createHash('sha256');const gzip=join(dir,'bulk.jsonl.gz'),jsonl=join(dir,'bulk.jsonl');
 const compressedCounter=new Transform({transform(chunk,encoding,done){compressed+=chunk.length;if(compressed>max.compressed||compressed>manifest.compressed_size)return done(new TypeError('TCG source: compressed_size'));ch.update(chunk);done(null,chunk);}});
 await pipeline(bodyOf(response),compressedCounter,createWriteStream(gzip,{flags:'wx',mode:0o600}));if(compressed!==manifest.compressed_size)fail('compressed_size_mismatch');
 const decompressedCounter=new Transform({transform(chunk,encoding,done){decompressed+=chunk.length;if(decompressed>max.decompressed)return done(new TypeError('TCG source: decompressed_size'));jh.update(chunk);done(null,chunk);}});
 try{await pipeline(createReadStream(gzip),createGunzip(),decompressedCounter,createWriteStream(jsonl,{flags:'wx',mode:0o600}));}catch(e){if(e.message==='TCG source: decompressed_size')throw e;fail('gzip_integrity');}
 let record_count=0;for await(const record of jsonlRecords(jsonl,{limits:max})){void record;record_count++;}
 return {compressed_size:compressed,decompressed_size:decompressed,compressed_sha256:ch.digest('hex'),jsonl_sha256:jh.digest('hex'),record_count,gzip_file:gzip,jsonl_file:jsonl};
}
export function createScryfallSource({transport=(url,options)=>globalThis.fetch(url,options),clock,rateClock,sleep=ms=>new Promise(r=>setTimeout(r,ms)),userAgent='DUELVANTA/TCG-I3-Source-v1 (operator-controlled catalog acquisition)',limits={}}={}){
 const injectedClock=clock;clock=clock===undefined?()=>Date.now():clock;
 // Explicit legacy clock injection remains deterministic unless rateClock is supplied.
 rateClock=rateClock===undefined?(injectedClock===undefined?()=>performance.now():clock):rateClock;
 const max=boundedLimits(limits);if(typeof transport!=='function'||typeof clock!=='function'||typeof rateClock!=='function'||typeof sleep!=='function'||typeof userAgent!=='string'||!/^DUELVANTA\/[\x20-\x7e]{8,200}$/.test(userAgent))fail('source_configuration');
 let lastRate=null,nextAPI=null;
 const rateTime=()=>{const now=rateClock();if(!Number.isFinite(now)||lastRate!==null&&now<lastRate)fail('clock_rate');lastRate=now;return now;};
 async function request(url,kind,requests){validateSourceURL(url,kind);if(kind!=='bulk'){
   let now=rateTime();
   while(nextAPI!==null&&now<nextAPI){const before=now;await sleep(nextAPI-now);now=rateTime();if(now<=before)fail('clock_rate');}
   nextAPI=now+1000;if(!Number.isFinite(nextAPI))fail('clock_rate');
  }
  const started_at=utc(clock);let response;try{response=await transport(url,{method:'GET',redirect:'manual',credentials:'omit',headers:{'User-Agent':userAgent,Accept:kind==='bulk'?'application/x-gzip':'application/json'},signal:AbortSignal.timeout(120000)});}catch{throw new Retryable();}
  requests.push({url,started_at,received_at:utc(clock),status:response.status});
  if(response.status!==200||response.redirected||response.url&&response.url!==url){if(typeof response.body?.cancel==='function')await response.body.cancel();else response.body?.destroy?.();}
  if(response.redirected||response.status>=300&&response.status<400||response.url&&response.url!==url)fail('redirect');
  if(response.status===429){const ra=response.headers?.get?.('retry-after');let delay=30000;if(ra){const n=/^\d+(?:\.\d+)?$/.test(ra)?Number(ra)*1000:Date.parse(ra)-clock();if(Number.isFinite(n))delay=Math.max(delay,n);}throw new Retryable(delay);}
  if(response.status>=500)throw new Retryable();if(response.status!==200)fail('http_status');return response;
 }
 async function acquire({tempDir}){
  const root=join(await operatorDirectory(tempDir),'dv-scryfall-source-v1');await mkdir(root,{recursive:true,mode:0o700});await cleanupTemporary(tempDir,{clock});
  // Operator directory is also the cross-process acquisition/publication lease.
  let lease;try{lease=await open(join(root,'operator.lock'),'wx',0o600);}catch(e){if(e.code==='EEXIST')fail('operator_busy');throw e;}
  const requests=[];let released=false;const release=async()=>{if(!released){released=true;await lease.close();await rm(join(root,'operator.lock'));}};
  try{
   const success=await optionalJSON(join(root,'last-success.json'));if(success&&clock()-success.completed_at<DAY)fail('daily_snapshot_limit');
   for(let attempt=1;attempt<=3;attempt++){
    const dir=join(root,'acq-'+randomUUID());await mkdir(dir,{mode:0o700});await atomicJSON(join(dir,'retention.json'),{started_at:clock(),attempt,state:'acquiring'});
    try{
     let metadata=await optionalJSON(join(root,'metadata-cache.json'));let cache_hit=false;
     if(metadata&&clock()>=metadata.cached_at&&clock()-metadata.cached_at<DAY){cache_hit=true;metadata.manifest=validateManifest(metadata.manifest);}
     else{
      const manifestURL='https://api.scryfall.com/bulk-data',manifestBytes=await bytesOf(await request(manifestURL,'manifest',requests),max.manifest),manifest=selectManifest(manifestBytes);
      const pages=[],seen=new Set();let url='https://api.scryfall.com/sets',total=0;
      for(;;){if(seen.has(url))fail('sets_pagination_cycle');seen.add(url);const bytes=await bytesOf(await request(url,'sets',requests),max.sets-total);total+=bytes.length;
       const page=parseSetsPage(bytes);
       pages.push({url,base64:bytes.toString('base64'),bytes:bytes.length,raw_sha256:sha256(bytes)});
       if(!page.has_more){if(page.next_page!==undefined&&page.next_page!==null)fail('sets_next_page');break;}url=validateSourceURL(page.next_page,'sets');}
      metadata={cached_at:clock(),manifest,manifest_url:manifestURL,manifest_raw_sha256:sha256(manifestBytes),manifest_raw_base64:manifestBytes.toString('base64'),pages};await atomicJSON(join(root,'metadata-cache.json'),metadata);
     }
     const manifest=validateManifest(metadata.manifest);if(manifest.compressed_size>max.compressed)fail('compressed_size');
     const pages=metadata.pages.map(p=>({url:validateSourceURL(p.url,'sets'),bytes:Buffer.from(p.base64,'base64')}));let total=0;
     for(const p of pages){total+=p.bytes.length;if(total>max.sets)fail('sets_size');}
     if(!pages.length)fail('sets_page');
     const manifestFile=join(dir,'manifest.json');await writeFile(manifestFile,Buffer.from(metadata.manifest_raw_base64,'base64'),{mode:0o600,flag:'wx'});
     const pageEvidence=[];for(let i=0;i<pages.length;i++){const p=pages[i],file=join(dir,'sets-'+(i+1)+'.json');await writeFile(file,p.bytes,{mode:0o600,flag:'wx'});pageEvidence.push({order:i+1,url:p.url,bytes:p.bytes.length,raw_sha256:sha256(p.bytes),file});}
     const bulkStarted=utc(clock),bulk=await streamBulk(await request(manifest.jsonl_download_uri,'bulk',requests),dir,manifest,max);
     const envelope={contract:'ScryfallAcquisitionEnvelope',version:'1',origin:'bulk_snapshot',attempt,cache_hit,metadata_acquired_at:new Date(metadata.cached_at).toISOString(),started_at:bulkStarted,completed_at:utc(clock),manifest_url:metadata.manifest_url,manifest_raw_sha256:metadata.manifest_raw_sha256,manifest_sha256:sha256(Buffer.from(canonicalJSON(manifest,65536))),manifest,manifest_file:manifestFile,pages:pageEvidence,sets_framing:SETS_FRAMING,sets_response_sha256:setsPageFraming(pages),bulk_url:manifest.jsonl_download_uri,...bulk,requests:[...requests]};
     await atomicJSON(join(dir,'acquisition-envelope.json'),envelope);await atomicJSON(join(dir,'retention.json'),{started_at:Date.parse(bulkStarted),state:'acquired'});
     let finished=false;
     return {envelope,async finish({published=false,snapshot_id=null,reused=false}={}){if(finished)fail('acquisition_already_finished');finished=true;try{if(published&&!reused)await atomicJSON(join(root,'last-success.json'),{completed_at:clock(),snapshot_id,compressed_sha256:bulk.compressed_sha256});await atomicJSON(join(dir,'retention.json'),{started_at:Date.parse(bulkStarted),state:published?'published':'aborted'});}finally{await release();}}};
    }catch(error){
     // Injected/network stream errors can contain request credentials. Expose
     // only our fixed contract codes, never arbitrary transport error text.
     const code=error.message?.match(/^TCG (?:source|evidence|persistence): ([a-z0-9_]+)$/)?.[1];
     const e=error instanceof Retryable?error:new TypeError('TCG source: '+(safeErrorCodes.has(code)?code:'acquisition_stream'));
     await atomicJSON(join(dir,'reject-report.json'),{attempt,code:e instanceof Retryable?'acquisition_transport':e.message.split(': ').at(-1),at:utc(clock)});
     if(!(e instanceof Retryable))throw e;if(e.delay)await sleep(e.delay);if(attempt===3)fail('acquisition_attempts_exhausted');
    }
   }
  }catch(e){await release();throw e;}
 }
 return Object.freeze({acquire,cleanup:tempDir=>cleanupTemporary(tempDir,{clock})});
}
