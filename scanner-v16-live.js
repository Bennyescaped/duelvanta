(()=>{
  'use strict';
  const root=globalThis,ratio=63/88;
  // Object-position is explicitly 50% 50% in the UI. Coordinates below are in
  // CSS pixels until inverse-mapped into the original video pixels.
  function geometry({sourceWidth,sourceHeight,boxWidth,boxHeight,objectFit='contain',single=true}){
    if(![sourceWidth,sourceHeight,boxWidth,boxHeight].every(n=>Number.isFinite(n)&&n>0))return null;
    const scale=(objectFit==='cover'?Math.max:Math.min)(boxWidth/sourceWidth,boxHeight/sourceHeight);
    const content={x:(boxWidth-sourceWidth*scale)/2,y:(boxHeight-sourceHeight*scale)/2,w:sourceWidth*scale,h:sourceHeight*scale};
    const visible={x:Math.max(0,content.x),y:Math.max(0,content.y),w:Math.min(boxWidth,content.w),h:Math.min(boxHeight,content.h)};
    let w=visible.w,h=visible.h;if(single){w=Math.min(visible.w*.88,visible.h*.88*ratio);h=w/ratio}
    const overlay={x:visible.x+(visible.w-w)/2,y:visible.y+(visible.h-h)/2,w,h};
    const source={x:(overlay.x-content.x)/scale,y:(overlay.y-content.y)/scale,w:w/scale,h:h/scale};
    return{content,visible,overlay,source,scale};
  }
  // Bounded edge-profile contour detector. Four supported outside edges must
  // enclose an approximately card-shaped rectangle near the guide; printed
  // artwork edges alone, blur and blank backgrounds do not arm capture.
  function inspect({data,width,height},expected){
    const g=new Float32Array(width*height);
    for(let i=0;i<g.length;i++)g[i]=data[i*4]*.299+data[i*4+1]*.587+data[i*4+2]*.114;
    const e=expected,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
    function edge(vertical,center,start,end,radius){
      let best={at:center,strength:0,coverage:0};
      for(let p=Math.max(2,Math.floor(center-radius));p<=Math.min((vertical?width:height)-3,center+radius);p++){
        let sum=0,hits=0,n=0;
        for(let v=Math.max(2,Math.floor(start));v<Math.min((vertical?height:width)-2,end);v++){
          const i=vertical?v*width+p:p*width+v,delta=Math.abs(g[i+(vertical?2:width*2)]-g[i-(vertical?2:width*2)]);
          sum+=delta;hits+=delta>24?1:0;n++;
        }
        const strength=sum/Math.max(n,1),coverage=hits/Math.max(n,1);
        if(strength*coverage>best.strength*best.coverage)best={at:p,strength,coverage};
      }return best;
    }
    const edges=[edge(true,e.x,e.y+e.h*.1,e.y+e.h*.9,e.w*.22),edge(true,e.x+e.w,e.y+e.h*.1,e.y+e.h*.9,e.w*.22),edge(false,e.y,e.x+e.w*.1,e.x+e.w*.9,e.h*.16),edge(false,e.y+e.h,e.x+e.w*.1,e.x+e.w*.9,e.h*.16)];
    const rect={x:edges[0].at,y:edges[2].at,w:edges[1].at-edges[0].at,h:edges[3].at-edges[2].at};
    const presence=edges.every(edge=>edge.coverage>=.54&&edge.strength>=24)&&Math.abs(rect.w/rect.h-ratio)<.13;
    const alignment=Math.max(Math.abs(rect.x-e.x)/e.w,Math.abs(rect.y-e.y)/e.h,Math.abs(rect.w-e.w)/e.w,Math.abs(rect.h-e.h)/e.h);
    let glare=0,brightness=0,n=0,lap=0;
    for(let y=Math.max(2,Math.ceil(e.y));y<Math.min(height-2,e.y+e.h);y++)for(let x=Math.max(2,Math.ceil(e.x));x<Math.min(width-2,e.x+e.w);x++){
      const i=y*width+x,v=g[i];brightness+=v;glare+=v>246?1:0;lap+=(4*v-g[i-1]-g[i+1]-g[i-width]-g[i+width])**2;n++;
    }
    const sample=[];for(let y=0;y<12;y++)for(let x=0;x<9;x++)sample.push(g[clamp(Math.floor(e.y+(y+.5)*e.h/12),0,height-1)*width+clamp(Math.floor(e.x+(x+.5)*e.w/9),0,width-1)]);
    return{presence,aligned:presence&&alignment<.10,alignment,rect,edges,sharpness:clamp(Math.round(lap/Math.max(1,n)/9),0,100),glare:glare/Math.max(1,n),brightness:brightness/Math.max(1,n),sample};
  }
  function createGate({holdMs=1400,minFrames=6}={}){
    let previous=null,since=null,count=0,latched=false,lastTime=0;
    return{reset(){previous=null;since=null;count=0;latched=false;lastTime=0},update(frame,now=Date.now()){
      const movement=previous?.sample?.length===frame.sample.length?frame.sample.reduce((sum,v,i)=>sum+Math.abs(v-previous.sample[i]),0)/frame.sample.length:Infinity;
      const continuous=lastTime&&now-lastTime<600;lastTime=now;previous=frame;
      let status=!frame.presence?'Karte ausrichten':!frame.aligned?'Karte an den Rahmen anpassen':frame.glare>.075?'Reflexion reduzieren':frame.brightness<65?'Mehr Licht':frame.sharpness<42?'Schärfe abwarten':movement>5||!continuous?'Ruhig halten':'Bereit';
      const good=status==='Bereit';if(!good){since=null;count=0}else{if(since===null)since=now;count++}
      const stable=good&&count>=minFrames&&now-since>=holdMs,autoCapture=stable&&!latched;
      if(autoCapture)latched=true;
      if(good&&!stable)status='Ruhig halten';
      return{...frame,status,stable,movement,progress:good?Math.min(1,(now-since)/holdMs):0,autoCapture};
    }};
  }
  root.DV_SCAN_V16_LIVE={geometry,inspect,createGate};
})();
