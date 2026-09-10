(()=>{
  'use strict';
  const VERSION='16.12.0-lab';
  const CARD_RATIO=63/88;
  const MODES=new Set(['single','continuous','multi','binder']);

  const size=s=>({w:Number(s?.videoWidth||s?.naturalWidth||s?.width||0),h:Number(s?.videoHeight||s?.naturalHeight||s?.height||0)});
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function canvasFrom(source,rect=null,width=900){
    const {w,h}=size(source);if(!w||!h)throw new Error('Bildquelle ist nicht bereit.');
    const r=rect||{x:0,y:0,w,h};const out=document.createElement('canvas');out.width=Math.max(280,Math.round(width));out.height=Math.max(280,Math.round(out.width*r.h/r.w));out.getContext('2d').drawImage(source,r.x,r.y,r.w,r.h,0,0,out.width,out.height);return out;
  }
  function fitCenteredRect(source,ratio=CARD_RATIO,margin=.025){
    const {w,h}=size(source);let W=w*(1-margin*2),H=h*(1-margin*2),x=w*margin,y=h*margin;
    if(W/H>ratio){const nw=H*ratio;x+=(W-nw)/2;W=nw}else{const nh=W/ratio;y+=(H-nh)/2;H=nh}
    return{x,y,w:W,h:H};
  }
  function gridRegions(source,cols,rows,{outer=.025,gap=.018,fitCards=true}={}){
    const {w,h}=size(source);if(!w||!h)return[];const box={x:w*outer,y:h*outer,w:w*(1-outer*2),h:h*(1-outer*2)};
    const gx=box.w*gap,gy=box.h*gap,cw=(box.w-gx*(cols-1))/cols,ch=(box.h-gy*(rows-1))/rows,out=[];
    for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
      let r={x:box.x+col*(cw+gx),y:box.y+row*(ch+gy),w:cw,h:ch};
      if(fitCards){if(r.w/r.h>CARD_RATIO){const nw=r.h*CARD_RATIO;r.x+=(r.w-nw)/2;r.w=nw}else{const nh=r.w/CARD_RATIO;r.y+=(r.h-nh)/2;r.h=nh}}
      out.push({...r,index:out.length,slot:out.length+1,row:row+1,col:col+1});
    }return out;
  }
  function regionsFor(source,mode,layout='2x2'){
    if(mode==='single'||mode==='continuous')return[{...(source.__v16Prepared?{x:0,y:0,...sizeRect(source)}:fitCenteredRect(source)),index:0,slot:1,row:1,col:1}];
    if(mode==='binder')return gridRegions(source,3,3,{outer:.035,gap:.018,fitCards:true});
    const m=String(layout).match(/^(\d)x(\d)$/),cols=clamp(Number(m?.[1]||2),1,4),rows=clamp(Number(m?.[2]||2),1,3);
    return gridRegions(source,cols,rows,{outer:.035,gap:.025,fitCards:true});
  }

  function quality(card){
    try{
      const W=220,H=Math.max(280,Math.round(W*card.height/card.width)),c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(card,0,0,W,H);const d=x.getImageData(0,0,W,H).data,g=new Float32Array(W*H);let mean=0,glare=0,dark=0,centerGlare=0,centerN=0;
      for(let y=0;y<H;y++)for(let xx=0;xx<W;xx++){
        const j=y*W+xx,i=j*4,v=d[i]*.299+d[i+1]*.587+d[i+2]*.114;g[j]=v;mean+=v;if(v>246)glare++;if(v<18)dark++;
        if(xx>W*.18&&xx<W*.82&&y>H*.12&&y<H*.76){centerN++;if(v>246)centerGlare++}
      }
      mean/=g.length;
      let lap=0,lap2=0,n=0;for(let y=1;y<H-1;y++)for(let xx=1;xx<W-1;xx++){const i=y*W+xx,v=4*g[i]-g[i-1]-g[i+1]-g[i-W]-g[i+W];lap+=v;lap2+=v*v;n++}
      const variance=Math.max(0,lap2/n-(lap/n)**2),sharp=clamp(variance/900,0,1),light=clamp(1-Math.abs(mean-138)/125,0,1),glareRatio=glare/g.length,centerGlareRatio=centerN?centerGlare/centerN:0,glarePenalty=clamp(1-glareRatio/.12,0,1),darkPenalty=clamp(1-(dark/g.length)/.18,0,1),score=Math.round(100*(sharp*.52+light*.20+glarePenalty*.18+darkPenalty*.10)),reflectionRisk=glareRatio>.055||centerGlareRatio>.075;
      return{score,sharpness:Math.round(sharp*100),brightness:Math.round(mean),glare:Math.round(glareRatio*1000)/10,centerGlare:Math.round(centerGlareRatio*1000)/10,reflectionRisk};
    }catch{return{score:0,sharpness:0,brightness:0,glare:0,centerGlare:0,reflectionRisk:false}}
  }
  function prepRect(source,x0,y0,x1,y1,contrast=1.85){const out=document.createElement('canvas'),W=1800;out.width=W;out.height=Math.max(190,Math.round(W*(source.height*(y1-y0))/(source.width*(x1-x0))));const x=out.getContext('2d');x.filter=`grayscale(1) contrast(${contrast}) brightness(1.08)`;x.drawImage(source,source.width*x0,source.height*y0,source.width*(x1-x0),source.height*(y1-y0),0,0,out.width,out.height);return out}
  function footerCrop(source,tcg,pass){
    // Bounded still-image fallback, not live-frame OCR. Small outlined / gold
    // codes need a line-sized crop; full-width text blocks suppress those glyphs.
    const rect=tcg==='one_piece'?(pass?[.74,.92,.90,.975]:[.755,.935,.875,.965]):(pass?[.12,.93,.34,.98]:[.14,.935,.31,.975]);
    const [x0,y0,x1,y1]=rect,W=700,H=Math.round(W*source.height*(y1-y0)/source.width/(x1-x0)),out=document.createElement('canvas');out.width=W+40;out.height=H+40;
    const x=out.getContext('2d');x.fillStyle='white';x.fillRect(0,0,out.width,out.height);x.filter=tcg==='one_piece'?'grayscale(1) contrast(2)':pass?'grayscale(1) contrast(2)':'grayscale(1) invert(1)';
    x.drawImage(source,source.width*x0,source.height*y0,source.width*(x1-x0),source.height*(y1-y0),20,20,W,H);return out;
  }
  const fallbackPokemonText=s=>String(s||'').normalize('NFKC').replace(/[Oo]/g,'0').replace(/[Il|!]/g,'1').replace(/[\\／]/g,'/').toUpperCase();
  function pokemonIds(text){if(window.DV_SCAN_V16_TCG?.pokemonIds)return window.DV_SCAN_V16_TCG.pokemonIds(text);const out=[];for(const m of fallbackPokemonText(text).matchAll(/(?:^|\D)(\d{1,3})\s*[\/|]\s*(\d{2,3})(?:\D|$)/g)){const a=Number(m[1]),b=Number(m[2]);if(a>=1&&a<=999&&b>=10&&b<=999)out.push({local:m[1],den:m[2],code:`${m[1]}/${m[2]}`})}return out}
  function onePieceIds(text){if(window.DV_SCAN_V16_TCG?.onePieceIds)return window.DV_SCAN_V16_TCG.onePieceIds(text);const s=String(text||'').normalize('NFKC').toUpperCase().replace(/[—–−]/g,'-'),out=[];for(const m of s.matchAll(/\b(OP|ST|EB|PRB)\s*[- ]?\s*(\d{1,2})\s*[- ]\s*(\d{2,3})\b/g))out.push({code:`${m[1]}${m[2].padStart(2,'0')}-${m[3].padStart(3,'0')}`});for(const m of s.matchAll(/\bP\s*[- ]\s*(\d{2,3})\b/g))out.push({code:`P-${m[1].padStart(3,'0')}`});return out}
  async function ocr(c,psm='6'){try{if(window.DV_SCAN_V16_OCR)return await window.DV_SCAN_V16_OCR.read(c,psm);const r=await Tesseract.recognize(c,'eng',{tessedit_pageseg_mode:psm,preserve_interword_spaces:'1'});return String(r?.data?.text||'')}catch{return''}}
  function votePasses(texts,tcg){
    const parse=tcg==='pokemon'?pokemonIds:onePieceIds,key=id=>window.DV_SCAN_V16_TCG.idCode(id,tcg),votes=new Map();
    // One vote per independent crop. Never count joined text as a new pass.
    texts.forEach((text,pass)=>{for(const [code,id] of new Map(parse(text).map(id=>[key(id),id]))){const v=votes.get(code)||{...id,passes:[]};v.passes.push(pass);votes.set(code,v)}});
    return [...votes.values()].sort((a,b)=>b.passes.length-a.passes.length);
  }
  function observedLanguage(texts){
    const text=texts.join(' ').normalize('NFKC').toLowerCase();
    const score=words=>words.filter(word=>new RegExp('\\b'+word+'\\b','i').test(text)).length;
    const de=score(['deines','deine','deiner','dieser','dieses','karte','karten','kannst','wenn','während','wahrend','angriff','energien','gegner','pokemon-ausrustung']),en=score(['your','opponent','during','attach','attached','discard','shuffle','damage','draw','search']);
    return de>=2&&de>en?'DE':en>=2&&en>de?'EN':null;
  }
  async function identify(card,tcg,onEvidence=()=>{}){
    if(!window.Tesseract)return null;
    const crops=tcg==='pokemon'?[[prepRect(card,0,.84,.67,1,1.1),'6'],[prepRect(card,0,.88,1,1,1),'11'],[prepRect(card,0,.58,1,1,1.3),'6']]:[[prepRect(card,0,.48,1,1,1.3),'6'],[prepRect(card,0,.74,1,1,1.1),'6'],[prepRect(card,0,.88,1,1,1),'11']];
    const texts=await Promise.all(crops.map(([crop,psm])=>ocr(crop,psm))),initial=votePasses(texts,tcg);
    if(initial.length!==1||initial[0].passes.length<2)for(let pass=0;pass<2;pass++)texts.push(await ocr(footerCrop(card,tcg,pass),'7'));
    const votes=votePasses(texts,tcg),evidence={votes,observedLanguage:observedLanguage(texts),independentPasses:texts.length};onEvidence(evidence);return votes.length?{...votes[0],evidence}:null;
  }
  function hashRegion(source,x0=.06,y0=.06,x1=.94,y1=.94){try{const c=document.createElement('canvas');c.width=24;c.height=24;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(source,source.width*x0,source.height*y0,source.width*(x1-x0),source.height*(y1-y0),0,0,24,24);const d=x.getImageData(0,0,24,24).data,g=[];let sum=0;for(let i=0;i<d.length;i+=4){const v=d[i]*.299+d[i+1]*.587+d[i+2]*.114;g.push(v);sum+=v}const mean=sum/g.length;return g.map(v=>v>=mean?1:0)}catch{return null}}
  const hashSim=(a,b)=>{if(!a||!b||a.length!==b.length)return null;let n=0;for(let i=0;i<a.length;i++)if(a[i]===b[i])n++;return n/a.length};
  function colorGrid(source,x0=.06,y0=.06,x1=.94,y1=.94){try{const c=document.createElement('canvas');c.width=32;c.height=32;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(source,source.width*x0,source.height*y0,source.width*(x1-x0),source.height*(y1-y0),0,0,32,32);const d=x.getImageData(0,0,32,32).data,out=[];for(let gy=0;gy<4;gy++)for(let gx=0;gx<4;gx++){let r=0,g=0,b=0,n=0;for(let y=gy*8;y<(gy+1)*8;y++)for(let xx=gx*8;xx<(gx+1)*8;xx++){const i=(y*32+xx)*4;r+=d[i];g+=d[i+1];b+=d[i+2];n++}out.push([r/n,g/n,b/n])}return out}catch{return null}}
  function colorSim(a,b){if(!a||!b||a.length!==b.length)return null;let dist=0;for(let i=0;i<a.length;i++){const dr=a[i][0]-b[i][0],dg=a[i][1]-b[i][1],db=a[i][2]-b[i][2];dist+=Math.sqrt(dr*dr+dg*dg+db*db)/(441.7)}return clamp(1-dist/a.length,0,1)}
  const loadImage=(url,timeoutMs=8000)=>new Promise((resolve,reject)=>{const i=new Image();let settled=false;const done=(error)=>{if(settled)return;settled=true;clearTimeout(timer);i.onload=null;i.onerror=null;error?reject(error):resolve(i)},timer=setTimeout(()=>done(new Error('artwork_image_timeout')),Math.max(1000,Number(timeoutMs)||8000));i.crossOrigin='anonymous';i.onload=()=>done();i.onerror=()=>done(new Error('artwork_image_failed'));i.src=url});
  function highlightEvidence(card,ref){
    const W=110,H=154,read=source=>{const c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(source,0,0,W,H);return x.getImageData(0,0,W,H).data},a=read(card),b=read(ref),bright=(d,i)=>d[i]*.299+d[i+1]*.587+d[i+2]*.114>246;
    let white=0,extra=0,center=0,centerExtra=0;
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){
      const inCenter=x>W*.18&&x<W*.82&&y>H*.12&&y<H*.76;if(inCenter)center++;
      if(!bright(a,(y*W+x)*4))continue;white++;let printed=false;
      for(let yy=Math.max(0,y-1);yy<=Math.min(H-1,y+1)&&!printed;yy++)for(let xx=Math.max(0,x-1);xx<=Math.min(W-1,x+1);xx++)if(bright(b,(yy*W+xx)*4)){printed=true;break}
      if(!printed){extra++;if(inCenter)centerExtra++}
    }
    return{shared:white?(white-extra)/white:0,extraGlare:100*extra/(W*H),extraCenterGlare:100*centerExtra/Math.max(1,center)};
  }
  async function visualScore(card,url,tcg='pokemon',onReference=null){
    try{
      if(!url)return null;const ref=canvasFrom(await loadImage(url),null,card.width),regions=tcg==='one_piece'?[[.05,.08,.95,.74,.48],[.08,.16,.92,.66,.32],[.04,.04,.96,.96,.20]]:[[.07,.10,.93,.70,.46],[.10,.16,.90,.62,.34],[.04,.04,.96,.96,.20]];let total=0,weight=0;
      for(const [x0,y0,x1,y1,w] of regions){const hs=hashSim(hashRegion(card,x0,y0,x1,y1),hashRegion(ref,x0,y0,x1,y1)),cs=colorSim(colorGrid(card,x0,y0,x1,y1),colorGrid(ref,x0,y0,x1,y1));if(hs!=null||cs!=null){const s=(hs??cs)*.68+(cs??hs)*.32;total+=s*w;weight+=w}}
      if(onReference)onReference(ref);return weight?Math.round(total/weight*10000)/100:null;
    }catch{return null}
  }
  function sizeRect(source){const {w,h}=size(source);return{w,h}}
  async function recognizeRegion(card,tcg,{identifierOverride,onProgress=()=>{}}={}){
    const q=quality(card);let identifierEvidence=null,id=identifierOverride||await identify(card,tcg,evidence=>{identifierEvidence=evidence});
    const observedLanguage=identifierEvidence?.observedLanguage||null;
    if(!id)return{tcg,quality:q,id:null,identifierEvidence,observedLanguage,candidates:[],best:null,confidence:0,status:'review',failureType:'identifier_failure',variantConfidence:0,candidateGap:0};
    let cands=[],lookupInfo;
    onProgress({phase:'catalog',tcg,identifier:id.code});
    try{if(typeof catalogLookup==='function')cands=await catalogLookup(id,{tcg})||[];lookupInfo=cands.lookupInfo}
    catch(error){lookupInfo={tcg,identifier:id.code,errors:[{error:String(error.message)}]}}
    const api=window.DV_SCAN_V16_TCG;
    const sameLanguage=c=>!observedLanguage||window.DV_SCAN_V16_QUALITY?.languageOf(c)===observedLanguage;
    let rejectedCandidates=cands.filter(c=>!sameLanguage(c));
    cands=cands.filter(sameLanguage);
    // Resolve an OCR conflict only against codes actually read in a crop and
    // an independently observed language. A catalog hit cannot manufacture OCR.
    if(!cands.length&&observedLanguage&&identifierEvidence?.votes.length>1){
      for(const alternative of identifierEvidence.votes.slice(1,3)){
        const found=await catalogLookup(alternative,{tcg})||[];
        if(found.some(sameLanguage)){id={...alternative,evidence:identifierEvidence};cands=found.filter(sameLanguage);lookupInfo={...found.lookupInfo,resolution:'ocr_alternative_and_observed_language',initialIdentifier:identifierEvidence.votes[0].code};break}
      }
    }
    const languageConflict=!cands.length&&rejectedCandidates.length>0,identifierReliable=!!identifierOverride||!!(id.passes?.length>=2&&identifierEvidence?.votes.length===1);
    const top=(cands||[]).filter(c=>(!c.tcg||c.tcg===tcg)&&(!api||api.candidateCode(c,tcg)===api.idCode(id,tcg))).map(c=>({...c,tcg,catalogVerified:true}));
    onProgress({phase:'artwork',tcg,identifier:id.code});
    await Promise.all(top.map(async c=>{const vs=await visualScore(card,c.image,tcg,q.reflectionRisk?ref=>{c.v16Highlights=highlightEvidence(card,ref)}:null);if(vs!=null)c.v16Visual=vs}));
    const nearest=top.reduce((best,c)=>Number(c.v16Visual||0)>Number(best?.v16Visual||0)?c:best,null),h=nearest?.v16Highlights;
    // Printed white artwork is not photographic glare. Only discount highlights
    // with strong visual agreement and spatial agreement to the actual reference.
    // Novel white patches and unavailable reference images retain all guards.
    if(q.reflectionRisk&&nearest?.v16Visual>=90&&h?.shared>=.85&&h.extraGlare<1.5&&h.extraCenterGlare<2){q.printedHighlights={glare:q.glare,centerGlare:q.centerGlare};q.glare=Math.round(h.extraGlare*10)/10;q.centerGlare=Math.round(h.extraCenterGlare*10)/10;q.reflectionRisk=false}
    let ranked=top,gap=0,variantConfidence=0;
    if(window.DV_SCAN_V16_TCG?.rankCandidates){const r=window.DV_SCAN_V16_TCG.rankCandidates(top,{tcg,id,qualityScore:q.score,visualReliable:!q.reflectionRisk});ranked=r.rows;gap=r.gap;variantConfidence=r.variantConfidence}else ranked.sort((a,b)=>(Number(b.confidence||0)+Number(b.v16Visual||0)*.12)-(Number(a.confidence||0)+Number(a.v16Visual||0)*.12));
    const best=ranked[0]||null,base=Number(best?.v16Score||best?.confidence||best?.catalogConfidence||0),visual=Number(best?.v16Visual||0),confidence=best?clamp(Math.round(Math.min(99,base)*.90+q.score*.10),0,99):0,ambiguousVariant=tcg==='one_piece'&&ranked.length>1&&gap<5&&variantConfidence<62,status=best&&confidence>=84&&q.score>=42&&!ambiguousVariant?'ready':'review';
    return{tcg,quality:q,id,identifierSource:identifierOverride?'manual':'ocr',identifierEvidence,identifierReliable,observedLanguage,languageConflict,rejectedCandidates,lookupInfo,candidates:ranked,best,confidence,status,failureType:best?null:'catalog_no_match',variantConfidence,candidateGap:gap,recognitionReasons:best?.v16Reasons||[],visualConfidence:visual};
  }
  function detectedRegion(source){
    if(!window.DV_SCAN_V16_LIVE)return null;
    try{const sample=canvasFrom(source,null,280),s=size(source),scale=sample.width/s.w,e=fitCenteredRect(sample),frame=window.DV_SCAN_V16_LIVE.inspect(sample.getContext('2d',{willReadFrequently:true}).getImageData(0,0,sample.width,sample.height),e);return frame.presence&&frame.aligned?window.DV_SCAN_V16_LIVE.captureRect(frame.rect,scale,s.w,s.h):null}catch{return null}
  }
  async function analyze(source,{mode='single',tcg='pokemon',layout='2x2',onProgress,identifierOverride,sourcePrepared=false}={}){
    if(!MODES.has(mode))throw new Error('Unbekannter Scanmodus.');if(!['pokemon','one_piece'].includes(tcg))throw new Error('TCG wird in V16 noch nicht unterstützt.');
    const regions=sourcePrepared&&['single','continuous'].includes(mode)?[{x:0,y:0,...sizeRect(source),index:0,slot:1,row:1,col:1}]:regionsFor(source,mode,layout),results=[];
    if(!sourcePrepared&&['single','continuous'].includes(mode)){
      const s=size(source);
      // A tightly framed card already has its footer at the image edge. Do not
      // shave off 2.5% and discard secret-rare / One Piece codes at the bottom.
      if(Math.abs(s.w/s.h-CARD_RATIO)<.035)Object.assign(regions[0],{x:0,y:0,w:s.w,h:s.h});
      else{const detected=detectedRegion(source);if(detected)Object.assign(regions[0],detected)}
    }
    for(let i=0;i<regions.length;i++){
      onProgress?.({index:i,total:regions.length,phase:'recognize'});const crop=canvasFrom(source,regions[i],820),r=await recognizeRegion(crop,tcg,{identifierOverride,onProgress:p=>onProgress?.({index:i,total:regions.length,...p})});results.push({...r,index:i,slot:regions[i].slot,row:regions[i].row,col:regions[i].col,crop});onProgress?.({index:i+1,total:regions.length,phase:'done',result:results[results.length-1]});
    }
    return{version:VERSION,mode,tcg,layout,results,ready:results.filter(x=>x.status==='ready').length,review:results.filter(x=>x.status!=='ready'&&x.best).length,empty:results.filter(x=>!x.best).length};
  }
  async function blob(card,quality=.94){return await new Promise(resolve=>card.toBlob(resolve,'image/jpeg',quality))}
  window.DV_SCAN_V16_CORE={version:VERSION,CARD_RATIO,modes:[...MODES],canvasFrom,fitCenteredRect,gridRegions,regionsFor,quality,footerCrop,votePasses,observedLanguage,identify,detectedRegion,highlightEvidence,visualScore,recognizeRegion,analyze,blob};
})();
