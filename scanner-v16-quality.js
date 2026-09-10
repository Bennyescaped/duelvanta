(()=>{
  'use strict';
  const root=globalThis;
  const VERSION='16.3.0-lab';
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const norm=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[._-]+/g,' ').replace(/\s+/g,' ').trim();

  function languageOf(c){
    const raw=norm(c?.sourceLang||c?.language||'');
    if(!raw)return null;
    if(raw==='de'||raw==='ger'||raw==='deu'||raw.includes('german')||raw.includes('deutsch'))return'DE';
    if(raw==='en'||raw==='eng'||raw.includes('english'))return'EN';
    if(raw==='ja'||raw==='jp'||raw==='jpn'||raw.includes('japanese'))return'JP';
    if(raw==='ko'||raw==='kr'||raw==='kor'||raw.includes('korean'))return'KR';
    if(raw.startsWith('zh')||raw==='cn'||raw.includes('chinese'))return'CN';
    if(raw==='fr'||raw==='fra'||raw.includes('french'))return'FR';
    if(raw==='it'||raw==='ita'||raw.includes('italian'))return'IT';
    if(raw==='es'||raw==='spa'||raw.includes('spanish'))return'ES';
    return String(c?.language||c?.sourceLang||'').toUpperCase().slice(0,8)||null;
  }

  function variantFamily(c,tcg){
    const s=norm([c?.variant,c?.rarity,c?.name,c?.set].filter(Boolean).join(' '));
    if(!s)return'standard';
    if(tcg==='one_piece'){
      if(/\bmanga\b/.test(s))return'manga';
      if(/treasure rare|\btr\b/.test(s))return'treasure';
      if(/signed|signature/.test(s))return'signed';
      if(/winner|championship|tournament|regional|nationals/.test(s))return'tournament';
      if(/parallel|alternate art|alt art|\baa\b/.test(s))return'parallel';
      if(/special rare|special card|\bsp\b/.test(s))return'special';
      if(/promo|promotion/.test(s))return'promo';
      return'standard';
    }
    if(/special illustration rare|\bsir\b/.test(s))return'special_illustration';
    if(/illustration rare|\bir\b/.test(s))return'illustration';
    if(/shiny ultra rare|\bsur\b/.test(s))return'shiny_ultra';
    if(/shiny rare/.test(s))return'shiny';
    if(/hyper rare|\bhr\b|gold rare/.test(s))return'hyper';
    if(/secret rare|\bsar\b|\bsr\b/.test(s))return'secret';
    if(/rainbow/.test(s))return'rainbow';
    if(/reverse holo|reverse foil/.test(s))return'reverse_holo';
    if(/holo|foil/.test(s))return'holo';
    if(/promo|promotion/.test(s))return'promo';
    return'standard';
  }

  const imgKey=c=>String(c?.image||c?.image_url||'').split('?')[0];
  function codeOf(c,tcg,tcgApi){return tcgApi?.candidateCode?tcgApi.candidateCode(c,tcg):String(c?.number||c?.card_number||'').toUpperCase()}
  function idOf(id,tcg,tcgApi){return tcgApi?.idCode?tcgApi.idCode(id,tcg):String(id?.code||'').toUpperCase()}

  function decision(result,tcg,tcgApi=root.DV_SCAN_V16_TCG){
    const rows=result?.candidates||[],top=rows[0]||result?.best||null,q=result?.quality||{},reasons=[];
    if(!top)return{forceReview:true,reasons:['no_candidate'],variantAmbiguity:false,languageAmbiguity:false,visualGap:0,evidenceConfidence:0};
    const target=idOf(result?.id,tcg,tcgApi),topCode=codeOf(top,tcg,tcgApi),peer=rows.slice(1).find(c=>codeOf(c,tcg,tcgApi)===topCode&&(!target||topCode===target))||null;
    const v1=Number(top?.v16Visual||result?.visualConfidence||0),v2=Number(peer?.v16Visual||0),visualGap=peer?Math.max(0,v1-v2):v1;
    const topLang=languageOf(top),peerLang=languageOf(peer),languageAmbiguity=!!(peer&&topLang&&peerLang&&topLang!==peerLang);
    const topVariant=variantFamily(top,tcg),peerVariant=variantFamily(peer,tcg),familyDiff=!!(peer&&topVariant!==peerVariant);
    const imageDiff=!!(peer&&imgKey(top)&&imgKey(peer)&&imgKey(top)!==imgKey(peer));
    const variantAmbiguity=!!(peer&&familyDiff)||(tcg==='one_piece'&&!!peer&&imageDiff&&!languageAmbiguity);
    const reflection=!!q.reflectionRisk,quality=Number(q.score||0),glare=Math.max(Number(q.glare||0),Number(q.centerGlare||0));
    let forceReview=false,cap=99;

    if(quality<36){forceReview=true;cap=Math.min(cap,74);reasons.push('low_image_quality')}
    if(reflection&&v1<86){forceReview=true;cap=Math.min(cap,79);reasons.push('reflection_guard')}
    if(glare>=14){forceReview=true;cap=Math.min(cap,76);reasons.push('heavy_glare')}
    if(v1<55){forceReview=true;cap=Math.min(cap,79);reasons.push(v1>0?'artwork_ambiguity':'top_candidate_unverifiable')}

    if(tcg==='one_piece'&&variantAmbiguity){
      const ok=reflection?(v1>=88&&visualGap>=14):(v1>=78&&visualGap>=9);
      if(!ok){forceReview=true;cap=Math.min(cap,83);reasons.push('variant_ambiguity')}
      else reasons.push('variant_art_separated');
    }
    if(tcg==='pokemon'&&familyDiff){
      const ok=reflection?(v1>=86&&visualGap>=12):(v1>=75&&visualGap>=7);
      if(!ok){forceReview=true;cap=Math.min(cap,83);reasons.push('variant_ambiguity')}
      else reasons.push('variant_art_separated');
    }
    if(tcg==='pokemon'&&languageAmbiguity){
      const ok=!reflection&&v1>=78&&visualGap>=8;
      if(!ok){forceReview=true;cap=Math.min(cap,82);reasons.push('language_ambiguity')}
      else reasons.push('language_visual_separated');
    }
    if(peer&&!imgKey(top)&&imgKey(peer)){forceReview=true;cap=Math.min(cap,80);reasons.push('top_candidate_unverifiable')}

    const raw=Number(result?.confidence||top?.v16Score||top?.confidence||top?.catalogConfidence||0),evidenceConfidence=clamp(Math.round(Math.min(raw,cap)),0,99);
    return{forceReview,reasons,variantAmbiguity,languageAmbiguity,visualGap,topLanguage:topLang,peerLanguage:peerLang,topVariant,peerVariant,evidenceConfidence};
  }

  function install(){
    const tcg=root.DV_SCAN_V16_TCG,core=root.DV_SCAN_V16_CORE;if(!tcg||!core||!tcg.rankCandidates||!core.analyze)return false;
    if(tcg.__v163QualityInstalled)return true;
    const oldRank=tcg.rankCandidates.bind(tcg),oldAnalyze=core.analyze.bind(core);
    tcg.rankCandidates=function(candidates,ctx={}){
      const base=oldRank(candidates,ctx),rows=(base.rows||[]).map(c=>({...c,v16VariantFamily:variantFamily(c,ctx.tcg),v16Language:languageOf(c)}));
      const target=idOf(ctx.id,ctx.tcg,tcg),same=rows.filter(c=>!target||codeOf(c,ctx.tcg,tcg)===target),visuals=same.filter(c=>Number(c.v16Visual)>0).sort((a,b)=>Number(b.v16Visual)-Number(a.v16Visual));
      if(ctx.visualReliable!==false&&visuals.length>1){
        const leader=visuals[0],gap=Math.max(0,Number(leader.v16Visual)-Number(visuals[1].v16Visual)),bonus=Math.min(ctx.tcg==='one_piece'?12:8,Math.max(0,Math.round((gap-3)*1.15)));
        if(bonus>0){leader.v16Score=Number(leader.v16Score||0)+bonus;leader.v16Reasons=[...(leader.v16Reasons||[]),'art_leader_gap']}
      }
      const withImages=same.filter(c=>imgKey(c)).length;if(withImages>0&&same.length>1)for(const c of rows)if(codeOf(c,ctx.tcg,tcg)===target&&!imgKey(c)){c.v16Score=Math.max(0,Number(c.v16Score||0)-8);c.v16Reasons=[...(c.v16Reasons||[]),'missing_variant_image']}
      rows.sort((a,b)=>Number(b.v16Score||0)-Number(a.v16Score||0)||Number(b.v16Visual||0)-Number(a.v16Visual||0));
      const scoreGap=rows.length>1?Number(rows[0].v16Score||0)-Number(rows[1].v16Score||0):rows.length?Number(rows[0].v16Score||0):0,visualGap=rows.length>1?Math.max(0,Number(rows[0].v16Visual||0)-Number(rows[1].v16Visual||0)):Number(rows[0]?.v16Visual||0),languageSpread=new Set(rows.slice(0,4).map(languageOf).filter(Boolean)).size;
      return{...base,rows,gap:Math.max(0,Math.round(scoreGap)),visualGap:Math.round(visualGap),languageSpread,variantConfidence:rows.length?clamp(Math.round(Number(rows[0].v16Visual||0)*.68+Math.min(31,Math.max(0,scoreGap)*2.2)),0,99):0};
    };
    core.analyze=async function(...args){
      const out=await oldAnalyze(...args),tcgName=out?.tcg||args?.[1]?.tcg||'pokemon';
      out.results=(out.results||[]).map(r=>{const d=decision(r,tcgName,tcg);const status=d.forceReview?'review':r.status,confidence=Math.min(Number(r.confidence||0),d.evidenceConfidence||99);return{...r,status,confidence,qualityDecision:d,reviewReasons:d.reasons,variantAmbiguity:d.variantAmbiguity,languageAmbiguity:d.languageAmbiguity,visualGap:d.visualGap}});
      out.ready=out.results.filter(r=>r.status==='ready'&&r.best).length;out.review=out.results.filter(r=>r.status!=='ready'&&r.best).length;out.empty=out.results.filter(r=>!r.best).length;out.qualityPolicy='v16.3_evidence_gates';return out;
    };
    tcg.__v163QualityInstalled=true;root.DV_SCAN_V16_QUALITY={version:VERSION,languageOf,variantFamily,decision,installed:true};return true;
  }

  root.DV_SCAN_V16_QUALITY={version:VERSION,languageOf,variantFamily,decision,install,installed:false};
  if(typeof document==='undefined')install();else{let tries=0;const t=setInterval(()=>{tries++;if(install()||tries>120)clearInterval(t)},50)}
})();
