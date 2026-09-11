(()=>{
  'use strict';
  const VERSION='16.20.0-lab',CARD_RATIO=63/88;
  let installed=false;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const size=s=>({w:Number(s?.videoWidth||s?.naturalWidth||s?.width||0),h:Number(s?.videoHeight||s?.naturalHeight||s?.height||0)});

  function raster(source,maxW=520){
    const {w,h}=size(source);if(!w||!h)return null;
    const W=Math.min(maxW,w),H=Math.max(240,Math.round(W*h/w)),c=document.createElement('canvas');c.width=W;c.height=H;
    const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(source,0,0,W,H);
    const d=x.getImageData(0,0,W,H).data,g=new Float32Array(W*H);for(let i=0,j=0;i<d.length;i+=4,j++)g[j]=d[i]*.299+d[i+1]*.587+d[i+2]*.114;
    return{c,g,W,H,sx:w/W,sy:h/H};
  }
  function smooth(a,r=2){const out=new Float32Array(a.length);for(let i=0;i<a.length;i++){let s=0,n=0;for(let k=Math.max(0,i-r);k<=Math.min(a.length-1,i+r);k++){s+=a[k];n++}out[i]=s/n}return out}
  function edgeData(source,maxW=520){
    const r=raster(source,maxW);if(!r)return null;const {g,W,H}=r,v=new Float32Array(W),h=new Float32Array(H),mag=new Float32Array(W*H);let vals=[];
    for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){const i=y*W+x,gx=Math.abs(g[i+1]-g[i-1]),gy=Math.abs(g[i+W]-g[i-W]),m=gx+gy;mag[i]=m;v[x]+=gx;h[y]+=gy;if((x+y)%7===0)vals.push(m)}
    vals.sort((a,b)=>a-b);const threshold=vals[Math.floor(vals.length*.90)]||18;
    return{...r,v:smooth(v,2),h:smooth(h,2),mag,threshold};
  }
  function median(a){const x=Array.from(a).sort((p,q)=>p-q);return x[Math.floor(x.length/2)]||0}
  function peaks(a,{max=22,gap=9,start=3,end=a.length-3}={}){
    const cand=[];for(let i=Math.max(2,start);i<Math.min(a.length-2,end);i++)if(a[i]>=a[i-1]&&a[i]>=a[i+1])cand.push({p:i,v:a[i]});cand.sort((x,y)=>y.v-x.v);
    const out=[];for(const p of cand){if(out.every(q=>Math.abs(q.p-p.p)>=gap)){out.push(p);if(out.length>=max)break}}return out.sort((x,y)=>x.p-y.p)
  }
  function iou(a,b){const x1=Math.max(a.x,b.x),y1=Math.max(a.y,b.y),x2=Math.min(a.x+a.w,b.x+b.w),y2=Math.min(a.y+a.h,b.y+b.h),inter=Math.max(0,x2-x1)*Math.max(0,y2-y1);return inter/Math.max(1,a.w*a.h+b.w*b.h-inter)}
  function fitRatio(r,ratio=63/88){let {x,y,w,h}=r;if(w/h>ratio){const nw=h*ratio;x+=(w-nw)/2;w=nw}else{const nh=w/ratio;y+=(h-nh)/2;h=nh}return{x,y,w,h}}
  function detectCardRects(source,{maxCards=12}={}){
    const e=edgeData(source,560);if(!e)return[];const {W,H,v,h,sx,sy}=e,px=peaks(v,{max:22,gap:Math.max(6,Math.round(W*.012))}),py=peaks(h,{max:24,gap:Math.max(6,Math.round(H*.012))}),mv=median(v),mh=median(h),xp=[],yp=[];
    for(let i=0;i<px.length;i++)for(let j=i+1;j<px.length;j++){const w=px[j].p-px[i].p;if(w<W*.105||w>W*.58)continue;xp.push({a:px[i],b:px[j],w,score:(px[i].v+px[j].v)/(mv+1)})}
    for(let i=0;i<py.length;i++)for(let j=i+1;j<py.length;j++){const hh=py[j].p-py[i].p;if(hh<H*.16||hh>H*.88)continue;yp.push({a:py[i],b:py[j],h:hh,score:(py[i].v+py[j].v)/(mh+1)})}
    const candidates=[];for(const x of xp)for(const y of yp){const ratio=x.w/y.h;if(ratio<.59||ratio>.84)continue;const area=x.w*y.h/(W*H);if(area<.035||area>.52)continue;const ratioPenalty=Math.abs(ratio-63/88)/(63/88),score=x.score+y.score-ratioPenalty*13+Math.min(4,area*20);if(score<7.5)continue;const rr=fitRatio({x:x.a.p,y:y.a.p,w:x.w,h:y.h});candidates.push({...rr,score})}
    candidates.sort((a,b)=>b.score-a.score);const chosen=[];for(const c of candidates){if(chosen.some(x=>iou(c,x)>.32))continue;chosen.push(c);if(chosen.length>=maxCards)break}
    const mapped=chosen.map(r=>({x:clamp(r.x*sx,0,size(source).w-1),y:clamp(r.y*sy,0,size(source).h-1),w:Math.min(r.w*sx,size(source).w-r.x*sx),h:Math.min(r.h*sy,size(source).h-r.y*sy),score:r.score}));
    mapped.sort((a,b)=>Math.abs(a.y-b.y)>Math.min(a.h,b.h)*.35?a.y-b.y:a.x-b.x);return mapped.map((r,i)=>({...r,index:i,slot:i+1,row:null,col:null}));
  }

  function fitLine(points,kind){
    if(points.length<18)return null;let pts=points;
    for(let pass=0;pass<2;pass++){
      let sx=0,sy=0,sxx=0,sxy=0,n=0;for(const p of pts){const X=kind==='xByY'?p.y:p.x,Y=kind==='xByY'?p.x:p.y;sx+=X;sy+=Y;sxx+=X*X;sxy+=X*Y;n++}const den=n*sxx-sx*sx;if(Math.abs(den)<1e-6)return null;const a=(n*sxy-sx*sy)/den,b=(sy-a*sx)/n,res=pts.map(p=>Math.abs((kind==='xByY'?p.x:p.y)-(a*(kind==='xByY'?p.y:p.x)+b))).sort((p,q)=>p-q),cut=res[Math.floor(res.length*.72)]||12;pts=pts.filter(p=>Math.abs((kind==='xByY'?p.x:p.y)-(a*(kind==='xByY'?p.y:p.x)+b))<=Math.max(5,cut));if(pass===1)return{a,b,n:pts.length}
    }return null
  }
  function intersect(xByY,yByX){const den=1-xByY.a*yByX.a;if(Math.abs(den)<.05)return null;const x=(xByY.a*yByX.b+xByY.b)/den,y=yByX.a*x+yByX.b;return{x,y}}
  function polygonArea(p){let s=0;for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length];s+=a.x*b.y-b.x*a.y}return Math.abs(s)/2}
  function detectBinderQuad(source){
    const e=edgeData(source,480);if(!e)return null;const {W,H,mag,threshold,sx,sy}=e,left=[],right=[],top=[],bottom=[];
    for(let y=Math.floor(H*.04);y<H*.96;y+=2){let l=-1,r=-1;for(let x=Math.floor(W*.03);x<W*.43;x++){if(mag[y*W+x]>=threshold){l=x;break}}for(let x=Math.ceil(W*.97);x>W*.57;x--){if(mag[y*W+x]>=threshold){r=x;break}}if(l>=0)left.push({x:l,y});if(r>=0)right.push({x:r,y})}
    for(let x=Math.floor(W*.04);x<W*.96;x+=2){let t=-1,b=-1;for(let y=Math.floor(H*.03);y<H*.43;y++){if(mag[y*W+x]>=threshold){t=y;break}}for(let y=Math.ceil(H*.97);y>H*.57;y--){if(mag[y*W+x]>=threshold){b=y;break}}if(t>=0)top.push({x,y:t});if(b>=0)bottom.push({x,y:b})}
    const L=fitLine(left,'xByY'),R=fitLine(right,'xByY'),T=fitLine(top,'yByX'),B=fitLine(bottom,'yByX');if(!L||!R||!T||!B)return null;
    const q=[intersect(L,T),intersect(R,T),intersect(R,B),intersect(L,B)];if(q.some(p=>!p||p.x<-W*.12||p.x>W*1.12||p.y<-H*.12||p.y>H*1.12))return null;const area=polygonArea(q)/(W*H);if(area<.30||area>1.08)return null;
    const tw=Math.hypot(q[1].x-q[0].x,q[1].y-q[0].y),bw=Math.hypot(q[2].x-q[3].x,q[2].y-q[3].y),lh=Math.hypot(q[3].x-q[0].x,q[3].y-q[0].y),rh=Math.hypot(q[2].x-q[1].x,q[2].y-q[1].y),ratio=((tw+bw)/2)/Math.max(1,(lh+rh)/2);if(ratio<.48||ratio>1.02)return null;
    const confidence=clamp(.35+area*.35+Math.min(1,(L.n+R.n+T.n+B.n)/220)*.3,0,1);return{quad:q.map(p=>({x:p.x*sx,y:p.y*sy})),confidence,area,ratio};
  }
  function warpQuad(source,quad,width=820,targetRatio=null){
    const {w,h}=size(source),src=document.createElement('canvas');src.width=w;src.height=h;const sx=src.getContext('2d',{willReadFrequently:true});sx.drawImage(source,0,0,w,h);const s= sx.getImageData(0,0,w,h),q=quad,top=Math.hypot(q[1].x-q[0].x,q[1].y-q[0].y),bottom=Math.hypot(q[2].x-q[3].x,q[2].y-q[3].y),left=Math.hypot(q[3].x-q[0].x,q[3].y-q[0].y),right=Math.hypot(q[2].x-q[1].x,q[2].y-q[1].y),measured=((top+bottom)/2)/Math.max(1,(left+right)/2),ratio=Number(targetRatio)||measured,W=Math.max(420,Math.round(width)),H=Math.max(520,Math.round(W/clamp(ratio,.48,.90))),out=document.createElement('canvas');out.width=W;out.height=H;const ox=out.getContext('2d'),od=ox.createImageData(W,H);
    for(let yy=0;yy<H;yy++){const v=yy/(H-1);for(let xx=0;xx<W;xx++){const u=xx/(W-1),a=(1-u)*(1-v),b=u*(1-v),c=u*v,d=(1-u)*v,px=clamp(Math.round(a*q[0].x+b*q[1].x+c*q[2].x+d*q[3].x),0,w-1),py=clamp(Math.round(a*q[0].y+b*q[1].y+c*q[2].y+d*q[3].y),0,h-1),si=(py*w+px)*4,di=(yy*W+xx)*4;od.data[di]=s.data[si];od.data[di+1]=s.data[si+1];od.data[di+2]=s.data[si+2];od.data[di+3]=255}}
    ox.putImageData(od,0,0);return out
  }
  function correctBinder(source){const d=detectBinderQuad(source);if(!d||d.confidence<.52)return{source,corrected:false,confidence:d?.confidence||0,quad:d?.quad||null};try{return{source:warpQuad(source,d.quad),corrected:true,confidence:d.confidence,quad:d.quad}}catch{return{source,corrected:false,confidence:d.confidence,quad:d.quad}}}
  function suppliedQuad(source,corners){
    const s=size(source);if(!Array.isArray(corners)||corners.length!==4||!s.w||!s.h)return null;const quad=corners.map(p=>({x:Number(p?.x)*s.w,y:Number(p?.y)*s.h}));if(quad.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<0||p.x>s.w||p.y<0||p.y>s.h))return null;const area=polygonArea(quad)/(s.w*s.h),center=quad.reduce((a,p)=>({x:a.x+p.x/4,y:a.y+p.y/4}),{x:0,y:0}),top=Math.hypot(quad[1].x-quad[0].x,quad[1].y-quad[0].y),bottom=Math.hypot(quad[2].x-quad[3].x,quad[2].y-quad[3].y),left=Math.hypot(quad[3].x-quad[0].x,quad[3].y-quad[0].y),right=Math.hypot(quad[2].x-quad[1].x,quad[2].y-quad[1].y),ratio=((top+bottom)/2)/Math.max(1,(left+right)/2);return area>=.24&&area<=.98&&ratio>=.45&&ratio<=1&&Math.abs(center.x-s.w/2)<s.w*.28&&Math.abs(center.y-s.h/2)<s.h*.28?quad:null
  }
  function normalizeCard(source,{width=900,inset=0,corners=null}={}){
    const s=size(source);if(!s.w||!s.h)return source;const observed=suppliedQuad(source,corners);if(observed)try{return warpQuad(source,observed,width,CARD_RATIO)}catch{}const d=detectBinderQuad(source),center=d?.quad?d.quad.reduce((a,p)=>({x:a.x+p.x/4,y:a.y+p.y/4}),{x:0,y:0}):null,centered=center&&Math.abs(center.x-s.w/2)<s.w*.14&&Math.abs(center.y-s.h/2)<s.h*.14,cardLike=d&&d.area>=.64&&d.ratio>=.60&&d.ratio<=.82&&centered;
    if(cardLike)try{return warpQuad(source,d.quad,width,CARD_RATIO)}catch{}
    const out=document.createElement('canvas'),W=Math.max(420,Math.round(width)),H=Math.round(W/CARD_RATIO),margin=clamp(Number(inset)||0,0,.08);out.width=W;out.height=H;let x=s.w*margin,y=s.h*margin,w=s.w*(1-margin*2),h=s.h*(1-margin*2),sourceRatio=w/h;
    if(sourceRatio>CARD_RATIO){const next=h*CARD_RATIO;x+=(w-next)/2;w=next}else if(sourceRatio<CARD_RATIO){const next=w/CARD_RATIO;y+=(h-next)/2;h=next}
    out.getContext('2d').drawImage(source,x,y,w,h,0,0,W,H);return out
  }

  function install(){
    const core=window.DV_SCAN_V16_CORE;if(!core||installed)return !!core;installed=true;const base=core.analyze.bind(core);
    core.analyze=async function(source,opts={}){
      const mode=opts.mode||'single';
      if(opts.providerObservation&&!['single','continuous'].includes(mode))throw new Error('Eine KI-Antwort gilt für genau eine Karte.');
      if(opts.geometryPrepared){const out=await base(source,opts);out.geometry=opts.geometryInfo||{prepared:true};for(const r of out.results||[])r.visionRecommended=!!window.DV_SCAN_V16_VISION?.shouldEscalate?.(r);return out}
      if(mode==='multi'&&opts.layout==='auto'){
        const regions=detectCardRects(source,{maxCards:12});if(regions.length>=2){const out=await base(source,{...opts,regionsOverride:regions});out.layout='auto';out.geometry={freeform:true,detected:regions.length};for(const r of out.results||[])r.visionRecommended=!!window.DV_SCAN_V16_VISION?.shouldEscalate?.(r);return out}
        const fallback=await base(source,{...opts,layout:'2x2'});fallback.geometry={freeform:true,detected:regions.length,fallback:'2x2'};for(const r of fallback.results||[])r.visionRecommended=!!window.DV_SCAN_V16_VISION?.shouldEscalate?.(r);return fallback;
      }
      if(mode==='binder'){
        const corrected=correctBinder(source),out=await base(corrected.source,opts);out.geometry={binderPerspective:true,corrected:corrected.corrected,confidence:corrected.confidence};for(const r of out.results||[])r.visionRecommended=!!window.DV_SCAN_V16_VISION?.shouldEscalate?.(r);return out;
      }
      const out=await base(source,opts);for(const r of out.results||[])r.visionRecommended=!!window.DV_SCAN_V16_VISION?.shouldEscalate?.(r);return out;
    };
    core.version=VERSION;window.DV_SCAN_V16_GEOMETRY={version:VERSION,detectCardRects,detectBinderQuad,warpQuad,correctBinder,suppliedQuad,normalizeCard};return true
  }
  let tries=0;const t=setInterval(()=>{tries++;if(install()||tries>120)clearInterval(t)},50);
})();
