import assert from 'node:assert/strict';
import {generateKeyPairSync,sign,createHash} from 'node:crypto';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import pilot from '../benchmark/scanner-pilot/ximilar-server.cjs';
const {createXimilarHandler,MODEL,parseResponse,sanitize}=pilot;
const {publicKey,privateKey}=generateKeyPairSync('ed25519');
const image=Buffer.from([255,216,255,1,2,3]),sha256=createHash('sha256').update(image).digest('hex');
const now=Date.now(),config={enabled:true,dataset:'unit',expiresAt:new Date(now+3600000).toISOString(),publicKey:publicKey.export({type:'spki',format:'pem'}),photos:{[sha256]:'pokemon'}};
const env={VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'scanner-v16',XIMILAR_API_TOKEN:'unit-key-not-live'};
const ticket=JSON.stringify({dataset:config.dataset,model:MODEL,expiresAt:config.expiresAt,sha256,tcg:'pokemon'});
const body={ticket,signature:sign(null,Buffer.from(ticket),privateKey).toString('base64url'),imageBase64:image.toString('base64')};
const sample={status:{code:200},records:[{_status:{code:200},_base64:body.imageBase64,_objects:[{name:'Card',area:0.7,_ocr:{lang:'de'},_tags:{'Foil/Holo':[{name:'Non-Foil'}]},_identification:{best_match:{name:'Retourorden',card_number:'074',out_of:'084',subcategory:'Pokemon',set:'Dunkelnacht'},alternatives:[],distances:[0.12]}}]}],statistics:{credits:10}};
let calls=0;
const fetchImpl=async(url,options)=>{calls++;assert.equal(url,'https://api.ximilar.com/collectibles/v2/tcg_id');assert.equal(options.headers.Authorization,`Token ${env.XIMILAR_API_TOKEN}`);assert.equal(options.redirect,'error');const d=JSON.parse(options.body);assert.equal(d.records[0]._base64,body.imageBase64);assert.equal(d.records[0].Subcategory,'Pokemon');assert.equal(d.lang,true);assert.equal(d.rotate,true);for(const k of ['price_stats','slab_id','slab_grade','analyze_all'])assert.equal(d[k],false);assert.ok(!options.body.includes('074'));return{ok:true,json:async()=>sample}};
const make=(overrides={})=>createXimilarHandler({env,config,now:()=>now,fetchImpl,...overrides});
async function invoke(handler,req={}){const res={setHeader(){},status(v){this.code=v;return this},json(v){this.value=v;return this}};await handler({method:'POST',headers:{'content-type':'application/json'},body,...req},res);return res}
assert.equal((await invoke(make(),{method:'GET'})).value.model,MODEL);
assert.equal((await invoke(make({env:{...env,VERCEL_ENV:'production'}}))).code,404);
assert.equal((await invoke(make({env:{...env,VERCEL_GIT_COMMIT_REF:'main'}}))).code,404);
assert.equal((await invoke(make({env:{...env,XIMILAR_API_TOKEN:''}}))).value.error,'ximilar_key_missing');
assert.equal((await invoke(make({config:{...config,enabled:false}}))).value.error,'pilot_closed');
assert.equal((await invoke(make({now:()=>now+7200000}))).value.error,'pilot_closed');
assert.equal((await invoke(make(),{body:{...body,prompt:'074/084'}})).code,400);
assert.equal((await invoke(make(),{body:{...body,imageBase64:Buffer.from([255,216,255,9]).toString('base64')}})).code,403);
const other=ticket.replace(MODEL,'gemini-3.5-flash-lite');assert.equal((await invoke(make(),{body:{...body,ticket:other,signature:sign(null,Buffer.from(other),privateKey).toString('base64url')}})).value.error,'photo_not_authorized');assert.equal(calls,0);
const handler=make(),results=await Promise.all([invoke(handler),invoke(handler)]);assert.equal(calls,1);const result=results[0].value;
assert.equal(result.observed.printed_code,'074/084');assert.equal(result.observed.language,'DE');assert.equal(result.importable,false);assert.equal(result.observed.confidence,null);assert.equal(result.usage.reportedCredits,10);assert.ok(!JSON.stringify(result.raw).includes('base64'));
let denied=0;const access=make({fetchImpl:async()=>{denied++;return{ok:false,status:403}}});assert.equal((await invoke(access)).value.error,'provider_http_403');await invoke(access);assert.equal(denied,1);
let unauthorized=0;const auth=make({fetchImpl:async()=>{unauthorized++;return{ok:false,status:401}}});assert.equal((await invoke(auth)).value.error,'provider_http_401');await invoke(auth);assert.equal(unauthorized,1);
const invalid=await invoke(make({fetchImpl:async()=>({ok:false,status:401,json:async()=>({detail:`Invalid token. ${env.XIMILAR_API_TOKEN}`})})}));assert.equal(invalid.value.providerReason,'invalid_token');assert.ok(!JSON.stringify(invalid).includes(env.XIMILAR_API_TOKEN));
const entitlement=await invoke(make({fetchImpl:async()=>({ok:false,status:403,json:async()=>({detail:'Your subscription does not include this service.'})})}));assert.equal(entitlement.value.providerReason,'account_or_service_access');
assert.equal((await invoke(make({fetchImpl:async()=>({ok:true,json:async()=>({status:{code:402}})})}))).value.error,'provider_status_402');
assert.equal((await invoke(make({fetchImpl:async()=>{throw Error(env.XIMILAR_API_TOKEN)}}))).value.error,'provider_timeout_or_network');
const op=structuredClone(sample);const c=op.records[0]._objects[0];c._ocr.lang='en';c._identification.best_match={name:'Ganzui',card_number:'OP17-043',subcategory:'One Piece'};
assert.equal(parseResponse(op,'one_piece').observed.printed_code,'OP17-043');assert.equal(parseResponse(op,'one_piece').observed.language,'EN');assert.equal(parseResponse(op,'pokemon').status,'tcg_conflict');
assert.equal(parseResponse({records:[{_objects:[]}]},'pokemon').status,'catalog_no_match');
assert.deepEqual(sanitize({token:'secret',_base64:'photo',text:'secret'},'secret'),{text:'[redacted]'});
// A second click, including after a reload, must not advance past an authentication failure.
const uiSource=await readFile(new URL('../scanner-v16-ai-pilot.js',import.meta.url),'utf8');
const storage=new Map();let posts=0;
async function page(){
  const nodes=new Map(),element=()=>({textContent:'',handlers:{},addEventListener(k,f){this.handlers[k]=f},append(){},replaceChildren(){}});
  const $=id=>{if(!nodes.has(id))nodes.set(id,element());return nodes.get(id)};
  vm.runInNewContext(uiSource,{URLSearchParams,location:{search:'?provider=ximilar'},document:{getElementById:$,createElement:element},AbortSignal,
    localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},fetch:async(_,options={})=>options.method==='POST'?(posts++,{ok:false,json:async()=>({error:'provider_http_401'})}):{ok:true,json:async()=>({model:MODEL,configured:true,active:true})}});
  await new Promise(resolve=>setImmediate(resolve));
  const photos=[{photoId:'first',...body},{photoId:'second',...body,ticket:ticket.replace(sha256,'other')}];
  await $('bundle').handlers.change({target:{files:[{size:100,text:async()=>JSON.stringify({schema:'duelvanta.signed-photo-pilot.v1',photos})}]}});
  return $;
}
const ui=await page();await ui('start').handlers.click();assert.equal(posts,1);assert.equal(ui('start').disabled,true);await ui('start').handlers.click();assert.equal(posts,1);
const reloaded=await page();assert.equal(reloaded('start').disabled,true);await reloaded('start').handlers.click();assert.equal(posts,1);assert.equal(storage.has('duelvanta_gemini_pilot_v1'),false);
console.log('Ximilar pilot: signed provider isolation, safe options, exact originals, candidates, language, credit metadata and no-repeat errors verified.');
