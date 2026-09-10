'use strict';
const {createPilotHandler}=require('./gemini-server.cjs');
const MODEL='ximilar-collectibles-v2-tcg-id';
const OPTIONS=Object.freeze({lang:true,rotate:true,slab_id:false,slab_grade:false,price_stats:false,analyze_all:false});
const fail=(status,code)=>Object.assign(new Error(code),{status,code});
const string=value=>typeof value==='string'?value:typeof value==='number'?String(value):null;
const tag=(object,key)=>object?._tags?.[key]?.[0]?.name||null;
const language=value=>({DE:'DE',DEU:'DE',GERMAN:'DE',DEUTSCH:'DE',EN:'EN',ENG:'EN',ENGLISH:'EN',JA:'JP',JP:'JP',JPN:'JP',JAPANESE:'JP'}[String(value||'').toUpperCase()]||string(value));
const tcgName=value=>({POKEMON:'pokemon','POKÉMON':'pokemon','ONE PIECE':'one_piece',ONE_PIECE:'one_piece'}[String(value||'').toUpperCase()]||'unknown');
function requestBody(image,tcg){
  return {...OPTIONS,records:[{_base64:image.toString('base64'),Subcategory:tcg==='one_piece'?'One Piece':'Pokemon'}]};
}
// Keep provider evidence, but never echo input photographs, tokens or unbounded output.
function sanitize(value,secret='',depth=0){
  if(depth>16)return null;
  if(typeof value==='string')return (secret?value.split(secret).join('[redacted]'):value).slice(0,16000);
  if(Array.isArray(value))return value.slice(0,200).map(v=>sanitize(v,secret,depth+1));
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([k])=>!/(?:base64|token|authorization|api.?key)/i.test(k)).map(([k,v])=>[k,sanitize(v,secret,depth+1)]));
  return value;
}
function parseResponse(data,selectedTcg){
  const record=data.records?.[0];
  if(!record||!Array.isArray(record._objects))throw fail(502,'invalid_provider_output');
  const cards=record._objects.filter(o=>o.name==='Card'&&o._identification);
  cards.sort((a,b)=>(b.area||0)-(a.area||0));
  const card=cards[0],identification=card?._identification,best=identification?.best_match;
  const tcg=tcgName(best?.subcategory||tag(card,'Subcategory'));
  let printedCode=string(best?.card_number);
  if(tcg==='pokemon'&&printedCode&&!printedCode.includes('/')&&best?.out_of!=null)printedCode+=`/${best.out_of}`;
  const validCode=!!printedCode&&(selectedTcg==='pokemon'?/^\d{1,3}\/\d{1,3}$/.test(printedCode):/^(?:(?:OP|ST|EB|PRB)\d{2}|P)-\d{3}$/.test(printedCode));
  const ocr=card?._ocr||record._ocr;
  const observed={tcg,printed_code:printedCode,name:string(best?.name),language:language(ocr?.lang||ocr?.lang_name||best?.lang||best?.language||tag(card,'Language')||tag(card,'Alphabet')),
    set_name:string(best?.set||best?.set_name),rarity:string(best?.rarity),variant:string(best?.variant||best?.version||best?.edition),confidence:null,needs_review:true,uncertainty:null};
  return {observed,status:!best?'catalog_no_match':tcg!==selectedTcg?'tcg_conflict':!validCode?'identifier_failure':'proposal',
    identifierFormatValid:validCode,catalogVerified:false,importable:false,confidenceMeaning:'distances_are_not_calibrated_probabilities',
    catalogCandidate:best||null,alternatives:identification?.alternatives||[],distances:identification?.distances||[],
    detectedFinish:tag(card,'Foil/Holo'),detectedObjects:record._objects.length};
}
const provider={model:MODEL,keyName:'XIMILAR_API_TOKEN',protocolVersion:'tcg-id-lang-rotate-v1',
  async call({image,tcg,env,fetchImpl,now}){
    const started=now(),secret=env.XIMILAR_API_TOKEN.trim();let response;
    try{response=await fetchImpl('https://api.ximilar.com/collectibles/v2/tcg_id',{method:'POST',redirect:'error',
      headers:{'Content-Type':'application/json',Authorization:`Token ${secret}`},body:JSON.stringify(requestBody(image,tcg)),signal:AbortSignal.timeout(45000)});
    }catch{throw fail(504,'provider_timeout_or_network')}
    if(!response.ok)throw fail(response.status===429?429:502,`provider_http_${response.status}`);
    let data;try{data=await response.json()}catch{throw fail(502,'invalid_provider_json')}
    for(const status of [data.status,data.records?.[0]?._status])if(status?.code>=400)throw fail(502,`provider_status_${Number(status.code)}`);
    const raw=sanitize(data,secret);
    if(JSON.stringify(raw).length>250000)throw fail(502,'provider_output_too_large');
    // Report only explicitly numeric credit metadata; absence must never be represented as zero.
    const credits=[data.statistics?.credits,data.statistics?.['credits used'],data.usage?.credits,data.credits].find(Number.isFinite)??null;
    return {...parseResponse(raw,tcg),raw,usage:{reportedCredits:credits},elapsedMs:Math.max(0,now()-started),model:MODEL,protocolVersion:provider.protocolVersion,options:OPTIONS};
  }};
function createXimilarHandler(options){return createPilotHandler({...options,provider})}
module.exports={createXimilarHandler,MODEL,OPTIONS,requestBody,parseResponse,sanitize};
