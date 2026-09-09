(()=>{
  'use strict';
  const VERSION='16.0.0-lab';
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
    if(mode==='single'||mode==='continuous')return[{...fitCenteredRect(source),index:0,slot:1,row:1,col:1}];
    if(mode==='binder')return gridRegions(source,3,3,{outer:.035,gap:.018,fitCards:true});
    const m=String(layout).match(/^(\d)x(\d)$/),cols=clamp(Number(m?.[1]||2),1,4),rows=clamp(Number(m?.[2]||2),1,3);
    return gridRegions(source,cols,rows,{outer:.035,gap:.025,fitCards:true});
  }

  function quality(card){
    try{
      const W=220,H=Math.max(280,Math.round(W*card.height/card.width)),c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(card,0,0,W,H);const d=x.getImageData(0,0,W,H).data,g=new Float32Array(W*H);let mean=0,glare=0,dark=0;
      for(let i=0,j=0;i<d.length;i+=4,j++){const v=d[i]*.299+d[i+1]*.587+d[i+2]*.114;g[j]=v;mean+=v;if(v>246)glare++;if(v<18)dark++}mean/=g.length;
      let lap=0,lap2=0,n=0;for(let y=1;y<H-1;y++)for(let xx=1;xx<W-1;xx++){const i=y*W+xx,v=4*g[i]-g[i-1]-g[i+1]-g[i-W]-g[i+W];lap+=v;lap2+=v*v;n++}
      const variance=Math.max(0,lap2/n-(lap/n)**2),sharp=clamp(variance/900,0,1),light=clamp(1-Math.abs(mean-138)/125,0,1),glarePenalty=clamp(1-(glare/g.length)/.12,0,1),darkPenalty=clamp(1-(dark/g.length)/.18,0,1),score=Math.round(100*(sharp*.52+light*.20+glarePenalty*.18+darkPenalty*.10));
      return{score,sharpness:Math.round(sharp*100),brightness:Math.round(mean),glare:Math.round(glare/g.length*1000)/10};
    }catch{return{score:0,sharpness:0,brightness:0,glare:0}}
  }
  function prepRect(source,x0,y0,x1,y1,contrast=1.85){const out=document.createElement('canvas'),W=1800;out.width=W;out.height=Math.max(190,Math.round(W*(source.height*(y1-y0))/(source.width*(x1-x0))));const x=out.getContext('2d');x.filter=`grayscale(1) contrast(${contrast}) brightness(1.08)`;x.drawImage(source,source.width*x0,source.height*y0,source.width*(x1-x0),source.height*(y1-y0),0,0,out.width,out.height);return out}
  const cleanOcr=s=>String(s||'').normalize('NFKC').replace(/[Oo]/g,'0').replace(/[Il|]/g,'1').replace(/[\\]/g,'/').toUpperCase();
  function pokemonIds(text){const out=[];for(const m of cleanOcr(text).matchAll(/(?:^|\D)(\d{1,3})\s*[\/／]\s*(\d{2,3})(?:\D|$)/g)){const a=Number(m[1]),b=Number(m[2]);if(a>=1&&b>=10&&a<=b&&b<=999)out.push({local:m[1],den:m[2],code:`${m[1]}/${m[2]}`})}return out}
  function onePieceIds(text){const s=cleanOcr(text).replace(/\s+/g,' '),out=[];for(const m of s.matchAll(/\b((?:OP|ST|EB|PRB|P)\s*[- ]?\s*\d{1,2})\s*[- ]\s*(\d{2,3})\b/g)){const set=m[1].replace(/\s/g,'').replace('-','');out.push({code:`${set}-${m[2]}`})}return out}
  async function ocr(c,psm='6'){try{const r=await Tesseract.recognize(c,'eng',{tessedit_pageseg_mode:psm,preserve_interword_spaces:'1'});return String(r?.data?.text||'')}catch{return''}}
  async function identify(card,tcg){
    if(!window.Tesseract)return null;
    if(tcg==='pokemon'){
      const crops=[prepRect(card,0,.68,.82,1,2.0),prepRect(card,0,.56,1,1,1.75),prepRect(card,0,.76,1,1,2.1)],texts=await Promise.all([ocr(crops[0],'6'),ocr(crops[1],'6'),ocr(crops[2],'7')]),hits=texts.flatMap(pokemonIds);if(!hits.length)return null;const freq=new Map();for(const h of hits){const k=`${Number(h.local)}/${Number(h.den)}`;freq.set(k,(freq.get(k)||0)+1)}hits.sort((a,b)=>(freq.get(`${Number(b.local)}/${Number(b.den)}`)||0)-(freq.get(`${Number(a.local)}/${Number(a.den)}`)||0));return hits[0];
    }
    const crops=[prepRect(card,0,.52,1,1,1.8),prepRect(card,0,.68,1,1,2.05)],texts=await Promise.all([ocr(crops[0],'6'),ocr(crops[1],'7')]),hits=texts.flatMap(onePieceIds);return hits[0]||null;
  }
  function hashRegion(source,x0=.06,y0=.06,x1=.94,y1=.94){try{const c=document.createElement('canvas');c.width=22;c.height=22;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(source,source.width*x0,source.height*y0,source.width*(x1-x0),source.height*(y1-y0),0,0,22,22);const d=x.getImageData(0,0,22,22).data,g=[];let sum=0;for(let i=0;i<d.length;i+=4){const v=d[i]*.299+d[i+1]*.587+d[i+2]*.114;g.push(v);sum+=v}const mean=sum/g.length;return g.map(v=>v>=mean?1:0)}catch{return null}}
  const hashSim=(a,b)=>{if(!a||!b||a.length!==b.length)return null;let n=0;for(let i=0;i<a.length;i++)if(a[i]===b[i])n++;return n/a.length};
  const loadImage=url=>new Promise((resolve,reject)=>{const i=new Image();i.crossOrigin='anonymous';i.onload=()=>resolve(i);i.onerror=reject;i.src=url});
  async function visualScore(card,url){try{if(!url)return null;const ref=await loadImage(url),a=hashRegion(card),b=hashRegion(ref);const s=hashSim(a,b);return s==null?null:Math.round(s*100)}catch{return null}}
  async function recognizeRegion(card,tcg){
    const q=quality(card),id=await identify(card,tcg);if(!id)return{quality:q,id:null,candidates:[],best:null,confidence:0,status:'review'};
    let cands=[],priorTcg=null,hasPrior=false;
    try{
      if(typeof selectedScanTcg!=='undefined'){priorTcg=selectedScanTcg;selectedScanTcg=tcg;hasPrior=true}
      if(typeof catalogLookup==='function')cands=await catalogLookup(id)||[];
    }catch{}finally{if(hasPrior)selectedScanTcg=priorTcg}
    const top=(cands||[]).slice(0,6);await Promise.all(top.slice(0,4).map(async c=>{const vs=await visualScore(card,c.image);if(vs!=null)c.v16Visual=vs}));
    top.sort((a,b)=>{const sa=Number(a.confidence||a.catalogConfidence||0)+(Number(a.v16Visual||0)>=68?8:0),sb=Number(b.confidence||b.catalogConfidence||0)+(Number(b.v16Visual||0)>=68?8:0);return sb-sa});
    const best=top[0]||null,base=Number(best?.confidence||best?.catalogConfidence||0),visual=Number(best?.v16Visual||0),confidence=best?clamp(Math.round(base*.80+q.score*.12+visual*.08),0,99):0,status=best&&confidence>=84&&q.score>=45?'ready':'review';
    return{quality:q,id,candidates:top,best,confidence,status};
  }
  async function analyze(source,{mode='single',tcg='pokemon',layout='2x2',onProgress}={}){
    if(!MODES.has(mode))throw new Error('Unbekannter Scanmodus.');if(!['pokemon','one_piece'].includes(tcg))throw new Error('TCG wird in V16 noch nicht unterstützt.');
    const regions=regionsFor(source,mode,layout),results=[];
    for(let i=0;i<regions.length;i++){
      onProgress?.({index:i,total:regions.length,phase:'recognize'});const crop=canvasFrom(source,regions[i],820),r=await recognizeRegion(crop,tcg);results.push({...r,index:i,slot:regions[i].slot,row:regions[i].row,col:regions[i].col,crop});onProgress?.({index:i+1,total:regions.length,phase:'done',result:results[results.length-1]});
    }
    return{version:VERSION,mode,tcg,layout,results,ready:results.filter(x=>x.status==='ready').length,review:results.filter(x=>x.status!=='ready'&&x.best).length,empty:results.filter(x=>!x.best).length};
  }
  async function blob(card,quality=.94){return await new Promise(resolve=>card.toBlob(resolve,'image/jpeg',quality))}
  window.DV_SCAN_V16_CORE={version:VERSION,CARD_RATIO,modes:[...MODES],canvasFrom,fitCenteredRect,gridRegions,regionsFor,quality,identify,recognizeRegion,analyze,blob};
})();
