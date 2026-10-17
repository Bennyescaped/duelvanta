(()=>{
  'use strict';
  const root=globalThis;
  // Printed zero padding is evidence/display data, never a numeric set key.
  const numeric=value=>/^\d+$/.test(String(value??''))?String(Number(value)):null;
  const rows=value=>Array.isArray(value)?value:[];
  async function mapLimit(input,fn,limit=4){
    const out=new Array(input.length);let at=0;
    await Promise.all(Array.from({length:Math.min(limit,input.length)},async()=>{while(at<input.length){const i=at++;out[i]=await fn(input[i])}}));return out;
  }
  function createClient({fetch:request=(...args)=>root.fetch(...args),languages=['de','en','ja','ko'],timeoutMs=7000}={}){
    const cache=new Map();
    async function json(url,diagnostic){
      if(cache.has(url))return cache.get(url);
      for(let attempt=1;attempt<=2;attempt++){
        const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),timeoutMs);let retryable=true;
        try{const response=await request(attempt===2?(root.DV_SCAN_V16_REFERENCES?.transport?.(url)||url):url,{signal:abort.signal});if(response.status===404)return null;if(!response.ok){retryable=response.status===429||response.status>=500;throw new Error(`HTTP ${response.status}`)}const value=await response.json();cache.set(url,value);return value}
        catch(error){if(!retryable||attempt===2){diagnostic.errors.push({url,error:error.name==='AbortError'?'timeout':String(error.message),attempts:attempt});return null}}
        finally{clearTimeout(timer)}
      }
    }
    async function pokemon(id,diagnostic){
      const local=numeric(id.local||String(id.code).split('/')[0]),den=numeric(id.den||String(id.code).split('/')[1]);
      if(!local||!den)return[];
      const packs=await mapLimit(languages,async lang=>{
        const base=`https://api.tcgdex.net/v2/${lang}`,sets=await json(`${base}/sets`,diagnostic);
        // Resolve the denominator BEFORE enumerating cards. No arbitrary first-N
        // prefix of a contains-search (which previously included 174 for 74).
        const matching=rows(sets).filter(set=>[set.cardCount?.official,set.cardCount?.total].some(n=>numeric(n)===den));
        let briefs=[];
        if(Array.isArray(sets)){
          const details=await mapLimit(matching,set=>json(`${base}/sets/${encodeURIComponent(set.id)}`,diagnostic));
          briefs=details.flatMap(set=>rows(set?.cards)).filter(card=>numeric(card.localId)===local);
        }else{
          const forms=[local,local.padStart(3,'0')];
          const found=await json(`${base}/cards?localId=${encodeURIComponent('eq:'+forms.join('|'))}`,diagnostic);
          briefs=rows(found).filter(card=>numeric(card.localId)===local);
        }
        const details=await mapLimit([...new Map(briefs.map(card=>[card.id,card])).values()],card=>json(`${base}/cards/${encodeURIComponent(card.id)}`,diagnostic));
        return details.filter(card=>card&&numeric(card.localId)===local&&[card.set?.cardCount?.official,card.set?.cardCount?.total].some(n=>numeric(n)===den)).flatMap(card=>root.DV_TCG_V1_CONSUMERS.translate(card,diagnostic.tcg,{locale:lang,collector:{text:id.code||`${id.local}/${id.den}`,source:'ocr'},source_path:'cards',retrieved_at:null}).records.map(record=>({...record.legacy})));
      });return packs.flat();
    }
    async function onePiece(id,diagnostic){
      const code=root.DV_SCAN_V16_TCG.normalizeOnePieceCode(id.code);
      const paths=code.startsWith('P-')?['promos']:code.startsWith('ST')?['decks','sets','promos']:['sets','decks','promos'],all=[];
      for(const path of paths){
        const data=await json(`https://optcgapi.com/api/${path}/card/${encodeURIComponent(code)}/`,diagnostic);
        const candidates=(Array.isArray(data)?data:data?[data]:[]).flatMap(card=>root.DV_TCG_V1_CONSUMERS.translate(card,diagnostic.tcg,{locale:'en',collector:{text:code,source:'ocr'},source_path:path,retrieved_at:null}).records.map(record=>({...record.legacy})));all.push(...candidates);
      }return [...new Map(all.map(card=>[[card.catalogId,card.image,card.name].join('|'),card])).values()];
    }
    async function lookup(id,{tcg}={}){
      let provider;try{provider=root.DV_TCG_V1_CONSUMERS.binding(tcg)}catch{throw new Error('Katalogsuche benötigt einen expliziten TCG-Modus.')}
      const transports={tcgdex:{lookup:pokemon,strategy:'denominator_sets_exact_local'},optcg:{lookup:onePiece,strategy:'exact_one_piece_code'}},transport=transports[provider.provider_key];
      if(!transport)throw new Error('Catalog transport unavailable');
      const info={tcg,identifier:id.code,errors:[],strategy:transport.strategy};
      let result=await transport.lookup(id,info);
      const references=root.DV_SCAN_V16_REFERENCES;
      if(references){await references.ready;result=references.resolveCandidates(result,tcg)}
      result.lookupInfo={...info,candidates:result.length,localReferenceImages:result.filter(card=>card.referenceImageSource).length};return result;
    }
    return{lookup};
  }
  root.DV_SCAN_V16_CATALOG={numeric,createClient,...createClient()};
})();
