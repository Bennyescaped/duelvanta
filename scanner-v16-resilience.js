(()=>{
  'use strict';
  const root=globalThis;
  const VERSION='16.5.0-lab';
  const recent=[];
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const unique=a=>[...new Set((a||[]).filter(Boolean))];

  function guidanceFor(result,{geometry=null,repeat=false}={}){
    const q=result?.quality||{},actions=[];
    const failure=classifyFailure(result);
    if(!repeat&&failure==='catalog_unavailable')return{code:failure,failureType:failure,title:'KATALOG GERADE NICHT ERREICHBAR',text:`Die Nummer ${result.id.code} wurde gelesen. Mindestens eine Katalogabfrage ist fehlgeschlagen; die Karte bleibt zur Prüfung erhalten.`,actions:['Katalogsuche bei stabiler Verbindung ohne neues Foto wiederholen.']};
    if(!repeat&&result?.languageConflict)return{code:'language_ambiguity',failureType:'language_ambiguity',title:'SPRACHE WIDERSPRICHT KATALOG',text:`Der Kartentext wurde als ${result.observedLanguage} erkannt. Die Katalogsprache passt nicht; der Kandidat wird nicht als Treffer angeboten.`,actions:['Gelesene Nummer prüfen und gegebenenfalls korrigieren.']};
    if(!repeat&&result?.id&&result.identifierReliable===false)return{code:'identifier_failure',failureType:'identifier_failure',title:'NUMMER NOCH NICHT BESTÄTIGT',text:'Die OCR-Durchläufe stimmen nicht ausreichend überein. Der angezeigte Katalogkandidat ist ein Vorschlag.',actions:['Gedruckte Nummer mit den OCR-Lesungen vergleichen und den passenden Kandidaten ausdrücklich bestätigen.']};
    if(!repeat&&!failure&&result?.best)return{code:'matched',failureType:null,title:'KARTE ERKANNT',text:'Nummer und Katalogkandidat sind konsistent. Prüfe die Karte und erfasse den Benchmark.',actions:[]};
    if(!repeat&&failure==='catalog_no_match')return{code:'catalog_no_match',failureType:failure,title:'NUMMER ERKANNT · KATALOG PRÜFEN',text:`Die Nummer ${result.id.code} wurde gelesen. Der Katalog liefert keinen passenden Eintrag; das ist kein OCR- oder Bildqualitätsfehler.`,actions:['Nummer korrigieren oder die Katalogsuche ohne neues Foto wiederholen.','Bei korrekter Nummer kann die Karte oder Sprache im Katalog fehlen.']};
    if(!repeat&&['variant_ambiguity','language_ambiguity','artwork_ambiguity'].includes(failure))return{code:failure,failureType:failure,title:{variant_ambiguity:'VARIANTE PRÜFEN',language_ambiguity:'SPRACHE PRÜFEN',artwork_ambiguity:'ARTWORK PRÜFEN'}[failure],text:'Die Nummer ist erkannt. Vergleiche die Katalogkandidaten und bestätige die passende Karte.',actions:['Artwork, Sprache und Variante in der Kandidatenliste vergleichen.']};
    let code='review',title='ERNEUT SCANNEN',text='Für einen belastbaren Treffer braucht DUELVANTA ein etwas besseres Bild.';
    if(repeat){
      return{code:'repeat_capture',title:'MÖGLICHE DOPPELAUFNAHME',text:'Diese Aufnahme ist einem unmittelbar zuvor gescannten Frame sehr ähnlich. Prüfe, ob es wirklich eine neue physische Karte ist.',actions:['Wenn es dieselbe Karte ist: diesen Treffer nicht importieren.','Wenn es eine zweite identische Karte ist: kurz neu ausrichten und erneut aufnehmen.']};
    }
    if(q.reflectionRisk||Number(q.centerGlare||0)>=8||Number(q.glare||0)>=9){
      code='reflection';title='REFLEXION REDUZIEREN';text='Foil- oder Folienreflexion verdeckt Teile des Artworks und kann Varianten verwechseln.';
      actions.push('Karte oder Binderseite etwa 10–15° kippen.','Lichtquelle seitlich statt direkt über der Kamera platzieren.');
    }
    if(Number(q.sharpness||0)<42){
      if(code==='review'){code='sharpness';title='SCHÄRFER AUFNEHMEN';text='Feine Kartendetails und der Setcode sind noch nicht scharf genug.'}
      actions.push('Kamera kurz ruhig halten und etwas näher an die Karte gehen.');
    }
    const b=Number(q.brightness||0);
    if(b>0&&b<78){
      if(code==='review'){code='dark';title='MEHR LICHT';text='Das Bild ist zu dunkel für einen zuverlässigen Code- und Artwork-Abgleich.'}
      actions.push('Umgebungslicht erhöhen, Blitz möglichst vermeiden.');
    }else if(b>205){
      if(code==='review'){code='bright';title='DIREKTES LICHT REDUZIEREN';text='Helle Bereiche verlieren Details und erschweren den Artwork-Abgleich.'}
      actions.push('Karte aus dem direkten Licht drehen oder Belichtung leicht reduzieren.');
    }
    if(!result?.id){
      if(code==='review'){code='card_code';title='KARTENCODE SCHÄRFER ZEIGEN';text='Die Kartenkennung konnte auch nach mehreren Bildvarianten nicht sicher gelesen werden.'}
      actions.push('Unteren Kartenbereich vollständig im Bild lassen.');
    }
    if(geometry?.binderPerspective&&geometry?.corrected===false){
      if(code==='review'){code='binder_angle';title='BINDER GERADER FOTOGRAFIEREN';text='Die Binderseite konnte nicht sicher perspektivisch entzerrt werden.'}
      actions.push('Handy möglichst parallel zur Binderseite halten und alle vier Seitenecken sichtbar lassen.');
    }
    if(geometry?.freeform&&geometry?.fallback){
      if(code==='review'){code='multi_spacing';title='KARTEN KLARER TRENNEN';text='Die freie Mehrkartenerkennung musste auf ein festes Raster zurückfallen.'}
      actions.push('Zwischen den Karten etwas mehr Abstand lassen und einen ruhigen, kontrastreichen Untergrund verwenden.');
    }
    return{code,failureType:failure,title,text,actions:unique(actions).slice(0,4)};
  }

  function classifyFailure(result){
    const q=result?.quality||{};
    if(q.reflectionRisk||Number(q.score||0)<42||Number(q.sharpness??100)<42)return'image_quality_failure';
    if(!result?.id)return'identifier_failure';
    if(result.languageConflict)return'language_ambiguity';
    if(result.identifierReliable===false)return'identifier_failure';
    if(!result.best&&result.lookupInfo?.errors?.length)return'catalog_unavailable';
    if(!result.best)return'catalog_no_match';
    if(result.status==='ready')return null;
    if(result.languageAmbiguity)return'language_ambiguity';
    if(result.variantAmbiguity)return'variant_ambiguity';
    if(result.status!=='ready')return'artwork_ambiguity';
    return null;
  }

  function shouldRetry(result){
    if(!result)return false;
    const q=Number(result?.quality?.score||0);
    if(q<24)return false;
    if(!result.id)return true;
    return false;
  }

  function voteIdentifiers(hits,tcg,tcgApi=root.DV_SCAN_V16_TCG){
    const rows=(hits||[]).filter(Boolean),map=new Map();
    const key=h=>tcg==='one_piece'
      ?(tcgApi?.normalizeOnePieceCode?.(h.code)||String(h.code||'').toUpperCase())
      :(tcgApi?.normalizePokemonCode?.(h.code||`${h.local||''}/${h.den||''}`)||String(h.code||''));
    for(const h of rows){const k=key(h);if(!k)continue;const e=map.get(k)||{key:k,id:h,votes:0};e.votes++;map.set(k,e)}
    return [...map.values()].sort((a,b)=>b.votes-a.votes||String(a.key).localeCompare(String(b.key)))[0]||null;
  }

  function bitSimilarity(a,b){
    if(!a||!b||a.length!==b.length)return 0;
    let same=0;for(let i=0;i<a.length;i++)if(a[i]===b[i])same++;
    return same/a.length;
  }
  function isLikelyRepeat(prev,next,{maxAgeMs=3500,minSimilarity=.965}={}){
    if(!prev||!next)return false;
    if(String(prev.tcg||'')!==String(next.tcg||''))return false;
    if(String(prev.number||'')!==String(next.number||''))return false;
    if(Math.abs(Number(next.at||0)-Number(prev.at||0))>maxAgeMs)return false;
    return bitSimilarity(prev.signature,next.signature)>=minSimilarity;
  }

  function signature(canvas){
    try{
      const W=18,H=24,c=document.createElement('canvas');c.width=W;c.height=H;
      const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(canvas,0,0,W,H);
      const d=x.getImageData(0,0,W,H).data,g=[];let mean=0;
      for(let i=0;i<d.length;i+=4){const v=d[i]*.299+d[i+1]*.587+d[i+2]*.114;g.push(v);mean+=v}
      mean/=g.length;return g.map(v=>v>=mean?'1':'0').join('');
    }catch{return null}
  }

  function prep(source,y0,style='contrast'){
    const out=document.createElement('canvas'),W=1700;
    out.width=W;out.height=Math.max(190,Math.round(W*(source.height*(1-y0))/source.width));
    const x=out.getContext('2d',{willReadFrequently:true});
    x.filter=style==='soft'?'grayscale(1) contrast(1.42) brightness(1.10)':'grayscale(1) contrast(2.05) brightness(1.08)';
    x.drawImage(source,0,source.height*y0,source.width,source.height*(1-y0),0,0,out.width,out.height);
    if(style==='binary'){
      const im=x.getImageData(0,0,out.width,out.height),d=im.data;let sum=0,n=0;
      for(let i=0;i<d.length;i+=16){sum+=d[i];n++}
      const th=clamp((sum/Math.max(1,n))*0.96,92,190);
      for(let i=0;i<d.length;i+=4){const v=d[i]>=th?255:0;d[i]=d[i+1]=d[i+2]=v}
      x.putImageData(im,0,0);
    }
    return out;
  }

  async function readText(canvas,psm='6'){
    try{
      if(root.DV_SCAN_V16_OCR)return await root.DV_SCAN_V16_OCR.read(canvas,psm);
      const r=await root.Tesseract.recognize(canvas,'eng',{tessedit_pageseg_mode:psm,preserve_interword_spaces:'1'});
      return String(r?.data?.text||'');
    }catch{return''}
  }
  function parseText(text,tcg){
    const api=root.DV_SCAN_V16_TCG;
    return tcg==='one_piece'?(api?.onePieceIds?.(text)||[]):(api?.pokemonIds?.(text)||[]);
  }
  async function lookup(id,tcg){
    if(typeof catalogLookup!=='function')return[];
    try{
      return await catalogLookup(id,{tcg})||[];
    }catch{return[]}
  }

  function applyEvidence(result,tcg){
    const d=root.DV_SCAN_V16_QUALITY?.decision?.(result,tcg,root.DV_SCAN_V16_TCG);
    if(!d)return result;
    const reasons=unique([...(result.reviewReasons||[]),...(d.reasons||[])]);
    return{...result,status:d.forceReview?'review':result.status,confidence:Math.min(Number(result.confidence||0),Number(d.evidenceConfidence||99)),qualityDecision:d,reviewReasons:reasons,variantAmbiguity:d.variantAmbiguity,languageAmbiguity:d.languageAmbiguity,visualGap:d.visualGap};
  }

  async function recover(result,tcg,core){
    if(!root.Tesseract||!result?.crop)return result;
    const specs=tcg==='one_piece'
      ?[[.43,'contrast','6'],[.66,'binary','7']]
      :[[.53,'contrast','6'],[.70,'binary','7']];
    const texts=await Promise.all(specs.map(async([y,style,psm])=>readText(prep(result.crop,y,style),psm)));
    const votes=core.votePasses(texts,tcg),vote=votes.length?{id:votes[0],votes:votes[0].passes.length,key:votes[0].code}:null;
    if(!vote?.id)return{...result,recovery:{attempted:true,success:false,identifierSuccess:!!result.id,catalogMatched:!!result.best,passes:specs.length,votes:0}};
    const found=await lookup(vote.id,tcg),api=root.DV_SCAN_V16_TCG;
    const observedLanguage=result.observedLanguage||core.observedLanguage(texts),sameLanguage=c=>!observedLanguage||root.DV_SCAN_V16_QUALITY?.languageOf(c)===observedLanguage;
    const cands=found.filter(c=>sameLanguage(c)&&(!c.tcg||c.tcg===tcg)&&api.candidateCode(c,tcg)===api.idCode(vote.id,tcg)).map(c=>({...c,tcg,catalogVerified:true}));
    await Promise.all(cands.map(async c=>{const v=await core.visualScore?.(result.crop,c.image,tcg);if(v!=null)c.v16Visual=v}));
    let ranked=cands,gap=0,variantConfidence=0;
    if(root.DV_SCAN_V16_TCG?.rankCandidates){
      const rr=root.DV_SCAN_V16_TCG.rankCandidates(cands,{tcg,id:vote.id,qualityScore:Number(result?.quality?.score||0),visualReliable:!result?.quality?.reflectionRisk});
      ranked=rr.rows||cands;gap=Number(rr.gap||0);variantConfidence=Number(rr.variantConfidence||0);
    }
    const best=ranked[0]||null,base=Number(best?.v16Score||best?.confidence||best?.catalogConfidence||0),q=Number(result?.quality?.score||0);
    const confidence=best?clamp(Math.round(Math.min(96,base)*.86+q*.14),0,96):0;
    let out={...result,id:vote.id,candidates:ranked,best,confidence,status:best&&confidence>=84&&q>=42?'ready':'review',variantConfidence,candidateGap:gap,visualConfidence:Number(best?.v16Visual||0),recognitionReasons:unique([...(best?.v16Reasons||[]),'multi_pass_ocr']),recovery:{attempted:true,success:!!best,passes:specs.length,votes:vote.votes,identifier:vote.key}};
    out={...out,tcg,observedLanguage,languageConflict:!cands.length&&found.some(c=>!sameLanguage(c)),identifierReliable:votes.length===1&&vote.votes>=2,identifierEvidence:{votes,observedLanguage,independentPasses:specs.length},lookupInfo:found.lookupInfo,recovery:{...out.recovery,identifierSuccess:true,catalogMatched:!!best}};
    out=applyEvidence(out,tcg);
    return out;
  }

  function repeatGuard(result,tcg){
    if(!result?.best||!result?.crop)return result;
    const sig=signature(result.crop);if(!sig)return result;
    const number=String(result.best?.number||result.id?.code||''),now=Date.now(),next={tcg,number,signature:sig,at:now};
    for(let i=recent.length-1;i>=0;i--){
      if(now-recent[i].at>9000){recent.splice(i,1);continue}
      if(isLikelyRepeat(recent[i],next)){
        return{...result,status:'review',confidence:Math.min(Number(result.confidence||0),78),repeatCapture:true,reviewReasons:unique([...(result.reviewReasons||[]),'possible_repeat_capture'])};
      }
    }
    recent.push(next);while(recent.length>12)recent.shift();return result;
  }

  const session={results:[],lastMode:null};
  function resetSession(){session.results=[];recent.splice(0,recent.length)}
  function install(){
    const core=root.DV_SCAN_V16_CORE;if(!core?.analyze||core.__v165ResilienceInstalled)return !!core?.__v165ResilienceInstalled;
    const old=core.analyze.bind(core);
    core.analyze=async function(source,opts={}){
      const out=await old(source,opts),tcg=out?.tcg||opts.tcg||'pokemon',mode=out?.mode||opts.mode||'single',rows=[];
      for(const initial of (out?.results||[])){
        let r=applyEvidence(initial,tcg);
        if(!opts.identifierOverride&&shouldRetry(r))r=await recover(r,tcg,core);
        if(mode==='continuous')r=repeatGuard(r,tcg);
        r.tcg=tcg;r.failureType=classifyFailure(r);r.captureGuidance=guidanceFor(r,{geometry:out?.geometry||null,repeat:!!r.repeatCapture});
        rows.push(r);
      }
      out.results=rows;out.ready=rows.filter(r=>r.status==='ready'&&r.best).length;out.review=rows.filter(r=>r.status!=='ready'&&r.best).length;out.empty=rows.filter(r=>!r.best).length;out.resiliencePolicy='v16.5_multi_pass_and_capture_guidance';
      if(mode==='continuous')session.results.push(...rows);else session.results=[...rows];session.lastMode=mode;
      return out;
    };
    core.__v165ResilienceInstalled=true;
    root.DV_SCAN_V16_RESILIENCE={...root.DV_SCAN_V16_RESILIENCE,installed:true};
    return true;
  }

  root.DV_SCAN_V16_RESILIENCE={version:VERSION,guidanceFor,classifyFailure,shouldRetry,voteIdentifiers,bitSimilarity,isLikelyRepeat,applyEvidence,install,session,resetSession,installed:false};
  if(typeof document!=='undefined'){let tries=0;const t=setInterval(()=>{tries++;if(install()||tries>140)clearInterval(t)},50)}
})();
