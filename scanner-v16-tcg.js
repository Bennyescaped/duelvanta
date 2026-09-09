(()=>{
  'use strict';
  const root=globalThis;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const plain=s=>String(s||'').normalize('NFKC').toUpperCase().replace(/[—–−]/g,'-').replace(/[\\／]/g,'/');

  function pokemonText(text){return plain(text).replace(/[Oo]/g,'0').replace(/[Il|!]/g,'1')}
  function pokemonIds(text){
    const out=[];for(const m of pokemonText(text).matchAll(/(?:^|\D)(\d{1,3})\s*[\/|]\s*(\d{2,3})(?:\D|$)/g)){
      const a=Number(m[1]),b=Number(m[2]);if(a>=1&&b>=10&&a<=b&&b<=999)out.push({local:m[1],den:m[2],code:`${m[1]}/${m[2]}`});
    }return out;
  }
  function onePieceText(text){
    return plain(text)
      .replace(/\s+/g,' ')
      .replace(/\b0P(?=\s*[- ]?\s*\d)/g,'OP')
      .replace(/\b5T(?=\s*[- ]?\s*\d)/g,'ST')
      .replace(/\bE8(?=\s*[- ]?\s*\d)/g,'EB')
      .replace(/\bPR8(?=\s*[- ]?\s*\d)/g,'PRB');
  }
  function canonicalOnePiece(prefix,setNo,cardNo){
    prefix=String(prefix||'').toUpperCase();cardNo=String(cardNo||'').replace(/\D/g,'');
    if(prefix==='P')return cardNo?`P-${cardNo.padStart(3,'0')}`:null;
    const sn=String(setNo||'').replace(/\D/g,'');if(!sn||!cardNo)return null;
    return `${prefix}${sn.padStart(2,'0')}-${cardNo.padStart(3,'0')}`;
  }
  function onePieceIds(text){
    const s=onePieceText(text),out=[],seen=new Set();
    const add=code=>{if(code&&!seen.has(code)){seen.add(code);out.push({code})}};
    for(const m of s.matchAll(/\b(OP|ST|EB|PRB)\s*[- ]?\s*([0-9OIl|]{1,2})\s*[- ]\s*([0-9OIl|]{2,3})\b/g)){
      const setNo=m[2].replace(/[Oo]/g,'0').replace(/[Il|]/g,'1'),card=m[3].replace(/[Oo]/g,'0').replace(/[Il|]/g,'1');add(canonicalOnePiece(m[1],setNo,card));
    }
    for(const m of s.matchAll(/\b(OP|ST|EB|PRB)\s*([0-9OIl|]{1,2})\s+([0-9OIl|]{2,3})\b/g)){
      const setNo=m[2].replace(/[Oo]/g,'0').replace(/[Il|]/g,'1'),card=m[3].replace(/[Oo]/g,'0').replace(/[Il|]/g,'1');add(canonicalOnePiece(m[1],setNo,card));
    }
    for(const m of s.matchAll(/\bP\s*[- ]\s*([0-9OIl|]{2,3})\b/g))add(canonicalOnePiece('P',null,m[1].replace(/[Oo]/g,'0').replace(/[Il|]/g,'1')));
    return out;
  }
  function normalizePokemonCode(code){const m=String(code||'').match(/(\d{1,3})\s*\/\s*(\d{2,3})/);return m?`${Number(m[1])}/${Number(m[2])}`:String(code||'').trim().toUpperCase()}
  function normalizeOnePieceCode(code){const hits=onePieceIds(String(code||''));return hits[0]?.code||String(code||'').replace(/\s/g,'').toUpperCase()}
  function candidateCode(c,tcg){return tcg==='one_piece'?normalizeOnePieceCode(c?.number||c?.card_number||''):normalizePokemonCode(c?.number||c?.card_number||'')}
  function idCode(id,tcg){return tcg==='one_piece'?normalizeOnePieceCode(id?.code||''):normalizePokemonCode(id?.code||`${id?.local||''}/${id?.den||''}`)}

  function scoreCandidate(c,{tcg,id,qualityScore=0,visualScore=0,visualReliable=true}={}){
    let score=Number(c?.confidence||c?.catalogConfidence||0),reasons=[];
    const exact=candidateCode(c,tcg)===idCode(id,tcg);if(exact){score+=tcg==='one_piece'?16:11;reasons.push('exact_id')}
    const visual=Number(visualScore||0);
    if(visualReliable&&visual>0){
      if(tcg==='one_piece'){
        if(visual>=84){score+=22;reasons.push('art_strong')}else if(visual>=74){score+=15;reasons.push('art_good')}else if(visual>=64){score+=8;reasons.push('art_match')}else if(visual<48){score-=8;reasons.push('art_weak')}
      }else{
        if(visual>=82){score+=15;reasons.push('art_strong')}else if(visual>=70){score+=9;reasons.push('art_good')}else if(visual>=60){score+=4;reasons.push('art_match')}
      }
    }
    if(Number(qualityScore)>=70)score+=3;else if(Number(qualityScore)<40)score-=5;
    return{score:clamp(Math.round(score),0,125),reasons,exact};
  }
  function rankCandidates(candidates,ctx={}){
    const rows=(candidates||[]).map(c=>{const visual=Number(c?.v16Visual||0),s=scoreCandidate(c,{...ctx,visualScore:visual});return{...c,v16Score:s.score,v16Reasons:s.reasons,v16ExactId:s.exact}});
    rows.sort((a,b)=>b.v16Score-a.v16Score||Number(b.v16Visual||0)-Number(a.v16Visual||0));
    const gap=rows.length>1?rows[0].v16Score-rows[1].v16Score:rows.length?rows[0].v16Score:0;
    return{rows,gap,variantConfidence:rows.length?clamp(Math.round((Number(rows[0].v16Visual||0)*.72)+Math.min(28,gap*2)),0,99):0};
  }

  root.DV_SCAN_V16_TCG={version:'16.2.0-lab',pokemonText,pokemonIds,onePieceText,onePieceIds,canonicalOnePiece,normalizePokemonCode,normalizeOnePieceCode,candidateCode,idCode,scoreCandidate,rankCandidates};
})();
