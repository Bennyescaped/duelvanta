/* Native algorithm diagnostic, NOT a browser/iPhone acceptance or latency benchmark.
 * Loads repository recognition code unchanged. Canvas, image transport, OCR backend
 * and minimal DOM sinks are explicit adapters. No Auth, collection or import code.
 * Usage: node native-probe.cjs MANIFEST PHOTO_DIR OUTPUT_DIR TESSDATA [development|holdout]
 */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {execFile}=require('node:child_process'),{promisify}=require('node:util'),crypto=require('node:crypto');
const exec=promisify(execFile),canvas=require('@napi-rs/canvas');
const [manifestPath,photoDir,outDir,tessdata,split='development']=process.argv.slice(2);
if(!tessdata)throw new Error('Expected manifest, photos, output, tessdata, optional split');
const repo=path.resolve(__dirname,'../..'),manifest=JSON.parse(fs.readFileSync(manifestPath));
fs.mkdirSync(outDir,{recursive:true});
const cache=path.join(outDir,'transport'),pending=new Map();
let active=0;const waiting=[];
async function bytes(url){
  if(pending.has(url))return pending.get(url);
  const job=(async()=>{
    if(process.env.PILOT_NETWORK==='offline'){
      const file=path.join(cache,crypto.createHash('sha256').update(url).digest('hex')+'.json');
      if(!fs.existsSync(file))return{url,status:0,error:'offline_catalog_response_missing',body:Buffer.alloc(0)};
      const m=JSON.parse(fs.readFileSync(file));return{...m,body:fs.readFileSync(m.bodyFile)};
    }
    if(active>=4)await new Promise(r=>waiting.push(r));active++;
    try{const {stdout}=await exec('python3',[path.join(__dirname,'fetch-public.py'),url,cache],{maxBuffer:1024*1024});const m=JSON.parse(stdout);return {...m,body:fs.readFileSync(m.bodyFile)}}
    finally{active--;waiting.shift()?.()}
  })();pending.set(url,job);return job;
}
async function request(url){const m=await bytes(url);if(!m.status)throw new Error(m.error||'transport_error');return{ok:m.status>=200&&m.status<300,status:m.status,json:async()=>JSON.parse(m.body),arrayBuffer:async()=>m.body}}
class RemoteImage extends canvas.Image{
  set src(value){if(typeof value==='string'&&value.startsWith('https:'))bytes(value).then(m=>{if(m.status!==200)throw new Error('image_http_'+m.status);super.src=m.body}).catch(e=>this.onerror?.(e));else super.src=value}
  get src(){return super.src}
}
function makeCanvas(){const c=canvas.createCanvas(1,1);c.toBlob=(callback,type='image/png',quality)=>callback(new Blob([c.toBuffer(type)],{type}));return c}
let caseId,engine,passes=[];
async function recognize(c,lang='eng',opts={}){
  const n=passes.length,file=path.join(outDir,`${caseId}-${engine}-ocr-${n}.png`),record={pass:n,language:lang,psm:String(opts.tessedit_pageseg_mode||6)};passes.push(record);
  fs.writeFileSync(file,c.toBuffer('image/png'));
  const started=Date.now();try{const {stdout}=await exec('tesseract',[file,'stdout','--tessdata-dir',tessdata,'-l',lang,'--psm',record.psm],{env:{...process.env,OMP_THREAD_LIMIT:'1'},timeout:30000,maxBuffer:2*1024*1024});record.text=stdout;return{data:{text:stdout}}}
  catch(e){record.error=e.message;throw e}finally{record.elapsedMs=Date.now()-started}
}
function context(){
  const nodes=new Map(),intervals=[];let captured=[];
  const node=id=>{if(!nodes.has(id))nodes.set(id,{id,value:'',src:'',complete:false,classList:{add(){},remove(){}},style:{},dataset:{},textContent:'',innerHTML:'',disabled:false});return nodes.get(id)};
  const document={createElement:tag=>tag==='canvas'?makeCanvas():new RemoteImage(),getElementById:node,querySelector:()=>null,querySelectorAll:()=>[]};
  const ctx={console,document,Image:RemoteImage,Blob,URL,AbortController,fetch:request,setTimeout,clearTimeout,performance,Uint8ClampedArray,Float32Array,Uint8Array,Map,Set,Date,Math,
    setInterval:fn=>{intervals.push(fn);return intervals.length},clearInterval(){},Tesseract:{recognize},$:node,esc:s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'),money:{format:()=>''},selectedScanTcg:'pokemon',pendingScanBlob:null,
    showLookupInput:message=>{captured.push({message})},showCandidates:async(id,candidates)=>{captured.push({id,candidates})},useCandidate(){},usdToEur:async()=>null,pokemonPrice:()=>null};
  ctx.window=ctx;ctx.globalThis=ctx;vm.createContext(ctx);
  const load=file=>{vm.runInContext(fs.readFileSync(path.join(repo,file),'utf8'),ctx,{filename:file});for(const fn of intervals.splice(0))fn()};
  return{ctx,load,node,captured};
}
function loadV15(){
  const env=context(),html=fs.readFileSync(path.join(repo,'collect.html'),'utf8');
  const fragment=(start,end)=>{const a=html.indexOf(start),b=html.indexOf(end,a+start.length);if(a<0||b<0)throw new Error('Missing V15 source boundary '+start);vm.runInContext(html.slice(a,b),env.ctx)};
  fragment('function prepCrop(', '\nlet usdEurRateCache');
  fragment('async function lookupPokemon(', '\nfunction showLookupInput(');
  fragment('async function recognizeImage(', '\nasync function captureCurrent(');
  for(const f of ['scanner-v15.js','scanner-v15-hotfix.js','scanner-v15-catalogfix.js','scanner-v15-ranking.js','scanner-v15-crop.js'])env.load(f);
  return env;
}
function loadV16(){const env=context();for(const f of ['scanner-v16-tcg.js','scanner-v16-catalog.js','scanner-v16-live.js','scanner-v16-ocr.js','scanner-v16-core.js','scanner-v16-quality.js','scanner-v16-geometry.js','scanner-v16-resilience.js'])env.load(f);env.ctx.catalogLookup=(id,o)=>env.ctx.DV_SCAN_V16_CATALOG.lookup(id,o);return env}
const observations=[];
(async()=>{
  for(const card of manifest.cards.filter(c=>c.split===split))for(const shot of card.shots){
    if(!shot.file)continue;caseId=shot.id;
    for(engine of ['V15.8','V16']){
      const resultFile=path.join(outDir,`${caseId}-${engine}.json`);if(fs.existsSync(resultFile)){observations.push(JSON.parse(fs.readFileSync(resultFile)));continue}
      passes=[];const env=engine==='V16'?loadV16():loadV15(),im=await canvas.loadImage(path.join(photoDir,shot.file)),started=Date.now();let raw,error;
      try{if(engine==='V16'){
        raw=await env.ctx.DV_SCAN_V16_CORE.analyze(im,{tcg:card.tcg,mode:'single'});
        for(const r of raw.results){fs.writeFileSync(path.join(outDir,`${caseId}-V16-crop.png`),r.crop.toBuffer('image/png'));r.cropSize=[r.crop.width,r.crop.height];delete r.crop}
      }else{
        env.ctx.selectedScanTcg=card.tcg;const preview=env.node('scanPreview');Object.assign(preview,{src:im.src,complete:true,naturalWidth:im.width,naturalHeight:im.height});
        // Image object rather than a DOM stub lets V15's original preview reranker draw it.
        const get=env.ctx.document.getElementById;env.ctx.document.getElementById=id=>id==='scanPreview'?im:get(id);
        await env.ctx.recognizeImage('',im);raw={captured:env.captured,status:env.node('scanStatus').textContent,rendered:env.node('scanResult').innerHTML};
      }}catch(e){error=e.stack}
      const row={caseId,engine,sourceCommit:process.env.PILOT_SOURCE_LABEL||manifest.baselineCommit,inputSha256:shot.sha256,tcg:card.tcg,split,environment:'native Tesseract 5.3.4 + napi Canvas; not Safari or browser E2E',networkMode:process.env.PILOT_NETWORK||'public_catalog',phase:'initial',elapsedDiagnosticMs:Date.now()-started,ocrPasses:passes,raw,error};
      fs.writeFileSync(resultFile,JSON.stringify(row,null,2));observations.push(row);
      console.log(JSON.stringify({caseId,engine,code:raw?.results?.[0]?.id?.code,best:raw?.results?.[0]?.best?.name,status:raw?.results?.[0]?.status,v15Status:raw?.status,passes:passes.length,error}));
    }
  }
  fs.writeFileSync(path.join(outDir,`observations-${split}.json`),JSON.stringify(observations,null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
