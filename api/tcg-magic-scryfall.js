'use strict';
const {printingInput,translatePrinting}=require('../tcg-magic-on-demand.js');
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
function createHandler({transport=createTransport(),now=Date.now}={}){
  let nextAllowed=0;
  return async(req,res)=>{
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
    if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({status:'error',error:'method_not_allowed'});}
    let input;try{input=queryInput(req);printingInput(input);}catch{return res.status(400).json({status:'error',error:'invalid_printing_query'});}
    if(now()<nextAllowed){res.setHeader('Retry-After',String(Math.max(1,Math.ceil((nextAllowed-now())/1000))));return res.status(429).json({status:'error',error:'provider_rate_limited'});}
    nextAllowed=now()+100;
    try{const {raw,retrieved_at}=await transport(input);let result;try{result=translatePrinting(raw,input,retrieved_at);}catch{throw new LookupError('provider_record_invalid',502);}return res.status(200).json(result);}
    catch(error){
      if(error.status===429){const value=error.retryAfter;const seconds=/^\d+$/.test(value||'')?Number(value):Math.ceil((Date.parse(value)-now())/1000);const delay=Number.isFinite(seconds)?Math.max(1,Math.min(86400,seconds)):60;nextAllowed=now()+delay*1000;res.setHeader('Retry-After',String(delay));}
      return res.status(error.status||502).json(error.status===404?{status:'no_match',candidate:null}:{status:'error',error:error instanceof LookupError?error.message:'provider_transport_error'});
    }
  };
}
module.exports=createHandler();Object.assign(module.exports,{createTransport,createHandler,queryInput,MAX_BYTES,TIMEOUT_MS,HEADERS,LookupError});
