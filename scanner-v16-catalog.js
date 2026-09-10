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
      const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),timeoutMs);
      try{const response=await request(url,{signal:abort.signal});if(response.status===404)return null;if(!response.ok)throw new Error(`HTTP ${response.status}`);const value=await response.json();cache.set(url,value);return value}
      catch(error){diagnostic.errors.push({url,error:error.name==='AbortError'?'timeout':String(error.message)});return null}
      finally{clearTimeout(timer)}
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
        return details.filter(card=>card&&numeric(card.localId)===local&&[card.set?.cardCount?.official,card.set?.cardCount?.total].some(n=>numeric(n)===den)).map(card=>({
          catalogId:card.id,tcg:'pokemon',name:card.name,set:card.set?.name||'',number:`${card.localId}/${id.den||den}`,
          language:lang==='ja'?'JP':lang==='ko'?'KR':lang.toUpperCase(),sourceLang:lang,variant:card.rarity||'',
          image:card.image?`${card.image}/high.webp`:null,catalogConfidence:88,confidence:88,catalogVerified:true,
          marketEur:null,priceSource:null
        }));
      });return packs.flat();
    }
    async function onePiece(id,diagnostic){
      const code=root.DV_SCAN_V16_TCG.normalizeOnePieceCode(id.code);
      const paths=code.startsWith('P-')?['promos']:code.startsWith('ST')?['decks','sets','promos']:['sets','decks','promos'],all=[];
      for(const path of paths){
        const data=await json(`https://optcgapi.com/api/${path}/card/${encodeURIComponent(code)}/`,diagnostic);
        const candidates=(Array.isArray(data)?data:data?[data]:[]).filter(card=>root.DV_SCAN_V16_TCG.normalizeOnePieceCode(card.card_set_id||card.card_id||card.card_number||'')===code).map(card=>({
          catalogId:card.card_image_id||card.card_set_id||card.card_id,tcg:'one_piece',name:card.card_name||card.name,
          set:card.set_name||'',number:code,language:'EN',rarity:card.rarity||card.card_rarity||'',variant:/winner/i.test(card.card_name||'')?'Tournament / Winner':/finalist/i.test(card.card_name||'')?'Tournament / Finalist':/participant/i.test(card.card_name||'')?'Tournament / Participant':/manga/i.test(card.card_name||'')?'Manga':/alternate art|parallel/i.test(card.card_name||'')?'Parallel / Alt Art':/wanted poster/i.test(card.card_name||'')?'Wanted Poster':/\(SP\)/i.test(card.card_name||'')?'Special':/reprint/i.test(card.card_name||'')?'Reprint':card.rarity||card.card_rarity||'',
          image:card.card_image||card.image||null,catalogConfidence:88,confidence:88,catalogVerified:true,marketEur:null,priceSource:null
        }));all.push(...candidates);
      }return [...new Map(all.map(card=>[[card.catalogId,card.image,card.name].join('|'),card])).values()];
    }
    async function lookup(id,{tcg}={}){
      if(!['pokemon','one_piece'].includes(tcg))throw new Error('Katalogsuche benötigt einen expliziten TCG-Modus.');
      const info={tcg,identifier:id.code,errors:[],strategy:tcg==='pokemon'?'denominator_sets_exact_local':'exact_one_piece_code'};
      const result=tcg==='pokemon'?await pokemon(id,info):await onePiece(id,info);
      result.lookupInfo={...info,candidates:result.length};return result;
    }
    return{lookup};
  }
  root.DV_SCAN_V16_CATALOG={numeric,createClient,...createClient()};
})();
