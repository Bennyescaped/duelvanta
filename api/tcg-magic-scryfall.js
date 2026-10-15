'use strict';
const {printingInput,translatePrinting}=require('../tcg-magic-on-demand.js');
const {randomUUID}=require('node:crypto');
const MAX_BYTES=1048576,TIMEOUT_MS=8000;
const HEADERS=Object.freeze({Accept:'application/json','User-Agent':'DUELVANTA/TCG-I3-Source-v1 (operator-controlled catalog acquisition)'});
class LookupError extends Error{constructor(code,status,retryAfter=null){super(code);this.status=status;this.retryAfter=retryAfter;}}
function createTransport({fetch:transport=(url,options)=>globalThis.fetch(url,options),clock=()=>new Date().toISOString(),timeoutMs=TIMEOUT_MS,maxBytes=MAX_BYTES}={}){
  if(typeof transport!=='function'||typeof clock!=='function'||!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>TIMEOUT_MS||!Number.isInteger(maxBytes)||maxBytes<1||maxBytes>MAX_BYTES)throw new TypeError('magic_transport_configuration');
  return async input=>{
    const q=printingInput(input),url='https://api.scryfall.com/'+q.source_path.slice(4),controller=new AbortController();let timer,reader;
    const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new LookupError('provider_timeout',504));},timeoutMs);});
    try{return await Promise.race([timeout,(async()=>{
      const response=await transport(url,{method:'GET',redirect:'manual',credentials:'omit',headers:HEADERS,signal:controller.signal});
      const retrieved_at=clock();if(!Number.isFinite(Date.parse(retrieved_at)))throw new LookupError('provider_clock',502);
      if(response.redirected||response.status>=300&&response.status<400||response.url&&response.url!==url)throw new LookupError('provider_redirect',502);
      if(response.status===404)throw new LookupError('no_match',404);
      if(response.status===429)throw new LookupError('provider_rate_limited',429,response.headers.get('retry-after'));
      if(response.status>=500)throw new LookupError('provider_unavailable',502);
      if(response.status!==200)throw new LookupError('provider_http_error',502);
      if(!/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type')||''))throw new LookupError('provider_content_type',502);
      const length=response.headers.get('content-length');if(length!==null&&(!/^\d+$/.test(length)||Number(length)>maxBytes))throw new LookupError('provider_size_limit',502);
      if(!response.body||typeof response.body.getReader!=='function')throw new LookupError('provider_body',502);
      reader=response.body.getReader();const chunks=[];let size=0;
      for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes)throw new LookupError('provider_size_limit',502);chunks.push(Buffer.from(value));}
      let raw;try{raw=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));}catch{throw new LookupError('provider_json_invalid',502);}
      return {raw,retrieved_at,query:q};
    })()]);}catch(error){if(error instanceof LookupError||error instanceof TypeError&&error.message.startsWith('magic_'))throw error;throw new LookupError('provider_transport_error',502);}
    finally{clearTimeout(timer);controller.abort();if(reader)void reader.cancel().catch(()=>{});}
  };
}
function queryInput(req){
  const url=new URL(req.url,'https://duelvanta.invalid'),allowed=['set_code','collector_number','language'];
  if(url.pathname!=='/api/tcg-magic-scryfall'||[...url.searchParams.keys()].some(k=>!allowed.includes(k))||allowed.some(k=>url.searchParams.getAll(k).length!==1))throw new TypeError('magic_query');
  return Object.fromEntries(allowed.map(k=>[k,url.searchParams.get(k)]));
}
// Caller authentication uses Supabase Auth's verified /user result and a caller-
// scoped RPC with the identical bearer. No service role and no user_metadata.
const CONTRACT='magic-on-demand-collect-beta/1';
function bearer(req){
 const value=req.headers?.authorization;
 if(typeof value!=='string'||value.length>8192||!/^Bearer [A-Za-z0-9_.-]+$/.test(value))return null;
 return value.slice(7);
}
function createAuthorizer({url,publishableKey,fetch:authFetch=(...args)=>globalThis.fetch(...args),now=Date.now}={}){
 return async token=>{
  let origin;try{origin=new URL(url);}catch{return null;}
  if(origin.protocol!=='https:'||origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash
    ||typeof publishableKey!=='string'||!/^sb_publishable_[A-Za-z0-9_-]+$/.test(publishableKey))return null;
  const headers={apikey:publishableKey,Authorization:'Bearer '+token,Accept:'application/json'};
  const request=async(path,options={})=>{
   const r=await authFetch(origin.origin+path,{...options,headers:{...headers,...options.headers},redirect:'error',signal:AbortSignal.timeout(5000)});
   if(r.status!==200||r.redirected)throw Error('authorization_unavailable');
   return r.json();
  };
  try{
   const user=await request('/auth/v1/user');
   if(!user||typeof user.id!=='string'||!user.email_confirmed_at||user.is_anonymous===true)return null;
   const receipt=await request('/rest/v1/rpc/get_magic_on_demand_collection_beta_v1',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
   if(receipt?.contract!==CONTRACT||receipt.user_id!==user.id||receipt.magic_on_demand_collection_beta!==true
     ||!Number.isFinite(Date.parse(receipt.checked_at))||Math.abs(now()-Date.parse(receipt.checked_at))>10000)return null;
   return {userId:user.id};
  }catch{return null;}
 };
}
const defaultAuthorize=token=>createAuthorizer({url:process.env.SUPABASE_URL,publishableKey:process.env.SUPABASE_PUBLISHABLE_KEY})(token);
const TRANSPORT_CONTRACT='magic-collect-transport/1';
function createBudgetReserver({url,publishableKey,fetch:budgetFetch=(...args)=>globalThis.fetch(...args)}={}){
 return async(token,id)=>{
  let origin;try{origin=new URL(url);}catch{return null;}
  if(origin.protocol!=='https:'||origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash
   ||typeof publishableKey!=='string'||!/^sb_publishable_[A-Za-z0-9_-]+$/.test(publishableKey))return null;
  try{const r=await budgetFetch(origin.origin+'/rest/v1/rpc/reserve_my_magic_transport_v1',{
   method:'POST',redirect:'error',signal:AbortSignal.timeout(5000),
   headers:{apikey:publishableKey,Authorization:'Bearer '+token,'Content-Type':'application/json',Accept:'application/json'},
   body:JSON.stringify({p_request_id:id})});
   return r.status===200&&!r.redirected?await r.json():null;
  }catch{return null;}
 };
}
const defaultReserve=(token,id)=>createBudgetReserver({url:process.env.SUPABASE_URL,publishableKey:process.env.SUPABASE_PUBLISHABLE_KEY})(token,id);
// Explicit server approval AND private DB gate AND atomic reservation; default OFF.
function createHandler(options={}){return gatedHandler(options,false);}
function createMockHandler(options){
 if(typeof options?.transport!=='function'||typeof options?.authorize!=='function')throw new TypeError('explicit_mock_dependencies_required');
 return gatedHandler(options,true);
}

function createOperationalMockHandler(options){
 if(typeof options?.transport!=='function'||typeof options?.authorize!=='function'||typeof options?.reserve!=='function')throw new TypeError('explicit_mock_dependencies_required');
 return gatedHandler({...options,liveApproved:()=>options.serverApproved===true},false);
}
function gatedHandler({transport=createTransport(),now=Date.now,authorize=defaultAuthorize,reserve=defaultReserve,
 liveApproved=()=>process.env.DUELVANTA_MAGIC_PROVIDER_LIVE_APPROVAL===TRANSPORT_CONTRACT}={},mockOnly=false){
  let nextAllowed=0;
  return async(req,res)=>{
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
    if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({status:'error',error:'method_not_allowed'});}
    let input;try{input=queryInput(req);printingInput(input);}catch{return res.status(400).json({status:'error',error:'invalid_printing_query'});}
    const token=bearer(req);if(!token)return res.status(401).json({status:'error',error:'access_unavailable'});
    let identity;try{identity=await authorize(token);}catch{return res.status(403).json({status:'error',error:'access_unavailable'});}
    if(!identity?.userId)return res.status(403).json({status:'error',error:'access_unavailable'});
    if(!mockOnly){
      let approved=false;try{approved=liveApproved()===true;}catch{}
      if(!approved)return res.status(503).json({status:'error',error:'provider_unavailable'});
      const id=randomUUID();let receipt;try{receipt=await reserve(token,id);}catch{}
      if(receipt?.contract!==TRANSPORT_CONTRACT||receipt.reserved!==true||receipt.request_id!==id
       ||receipt.user_id!==identity.userId||!Number.isFinite(Date.parse(receipt.reserved_at))
       ||Math.abs(now()-Date.parse(receipt.reserved_at))>5000)
       return res.status(503).json({status:'error',error:'provider_unavailable'});
    }
    if(now()<nextAllowed){res.setHeader('Retry-After',String(Math.max(1,Math.ceil((nextAllowed-now())/1000))));return res.status(429).json({status:'error',error:'provider_rate_limited'});}
    nextAllowed=now()+100;
    try{const {raw,retrieved_at}=await transport(input);let result;try{result=translatePrinting(raw,input,retrieved_at);}catch{throw new LookupError('provider_record_invalid',502);}return res.status(200).json(result);}
    catch(error){
      if(error.status===429){const value=error.retryAfter;const seconds=/^\d+$/.test(value||'')?Number(value):Math.ceil((Date.parse(value)-now())/1000);const delay=Number.isFinite(seconds)?Math.max(1,Math.min(86400,seconds)):60;nextAllowed=now()+delay*1000;res.setHeader('Retry-After',String(delay));}
      return res.status(error.status||502).json(error.status===404?{status:'no_match',candidate:null}:{status:'error',error:error instanceof LookupError?error.message:'provider_transport_error'});
    }
  };
}
module.exports=createHandler();Object.assign(module.exports,{createTransport,createHandler,createMockHandler,createOperationalMockHandler,createAuthorizer,createBudgetReserver,queryInput,MAX_BYTES,TIMEOUT_MS,HEADERS,LookupError});
