(()=>{
  'use strict';
  const root=globalThis;
  const VERSION='16.9.0-lab';
  const attempts=new WeakMap();

  function frameReady(video){return !!(video&&Number(video.videoWidth)>0&&Number(video.videoHeight)>0&&Number(video.readyState||0)>=2)}
  function streamLive(video){try{return !!video?.srcObject?.getVideoTracks?.().some(track=>track?.readyState==='live'&&track.enabled!==false)}catch{return false}}
  function stopVideoStream(video){if(video)attempts.set(video,(attempts.get(video)||0)+1);try{video?.srcObject?.getTracks?.().forEach(track=>track.stop())}catch{};try{if(video)video.srcObject=null}catch{}}
  function statePolicy(state){return{captureDisabled:state!=='camera-ready',startDisabled:state==='camera-starting',startLabel:state==='camera-ready'?'KAMERA BEREIT':state==='camera-starting'?'KAMERA STARTET …':'LIVE-KAMERA STARTEN'}}
  function waitForFrame(video,timeoutMs=6500){
    return new Promise(resolve=>{
      if(frameReady(video)){resolve(true);return}
      let finished=false,timer=0,raf=0;const events=['loadedmetadata','loadeddata','canplay','playing','resize'];
      const done=value=>{if(finished)return;finished=true;clearTimeout(timer);if(raf&&typeof cancelAnimationFrame==='function')cancelAnimationFrame(raf);events.forEach(name=>video?.removeEventListener?.(name,check));resolve(!!value)};
      const check=()=>{if(frameReady(video)){done(true);return}if(typeof requestAnimationFrame==='function')raf=requestAnimationFrame(check)};
      events.forEach(name=>video?.addEventListener?.(name,check,{passive:true}));timer=setTimeout(()=>done(frameReady(video)),Math.max(500,Number(timeoutMs)||6500));check();
    });
  }
  async function getCameraStream(timeoutMs=9000){
    if(!navigator?.mediaDevices?.getUserMedia)throw new Error('camera_api_unavailable');
    const request=navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1920},height:{ideal:1440},advanced:[{focusMode:'continuous'}]},audio:false});
    return await new Promise((resolve,reject)=>{let settled=false;const timer=setTimeout(()=>{if(settled)return;settled=true;reject(new Error('camera_start_timeout'))},Math.max(1500,Number(timeoutMs)||9000));request.then(stream=>{if(settled){try{stream?.getTracks?.().forEach(track=>track.stop())}catch{};return}settled=true;clearTimeout(timer);resolve(stream)}).catch(error=>{if(settled)return;settled=true;clearTimeout(timer);reject(error)})});
  }
  async function start(video,{timeoutMs=9000}={}){
    if(frameReady(video)&&streamLive(video))return video.srcObject;stopVideoStream(video);const token=attempts.get(video);let stream;
    try{stream=await getCameraStream(timeoutMs);if(attempts.get(video)!==token)throw new Error('camera_start_cancelled');video.srcObject=stream;video.playsInline=true;video.muted=true;try{const playing=video.play();if(playing?.catch)playing.catch(()=>{})}catch{};if(!await waitForFrame(video,6500))throw new Error('camera_frame_timeout');if(attempts.get(video)!==token)throw new Error('camera_start_cancelled');return stream}
    catch(error){try{stream?.getTracks?.().forEach(track=>track.stop())}catch{};if(attempts.get(video)===token)stopVideoStream(video);throw error}
  }
  function capture(video,{single=true,width=1600}={}){
    if(!frameReady(video)||!streamLive(video))throw new Error('Kamera ist noch nicht bereit.');
    const transform=geometry(video,{single});if(!transform)throw new Error('Videofläche ist noch nicht bereit.');
    const {x:sx,y:sy,w:sw,h:sh}=transform.source;
    const canvas=document.createElement('canvas');canvas.width=Math.min(Math.round(sw),Math.max(280,Number(width)||1600));canvas.height=Math.round(canvas.width*sh/sw);canvas.getContext('2d').drawImage(video,sx,sy,sw,sh,0,0,canvas.width,canvas.height);canvas.__v16Prepared=single;canvas.__v16CaptureGeometry=transform;return canvas;
  }
  function geometry(video,{single=true}={}){
    const box=video?.getBoundingClientRect?.();return root.DV_SCAN_V16_LIVE?.geometry({sourceWidth:video.videoWidth,sourceHeight:video.videoHeight,boxWidth:box?.width||video.clientWidth,boxHeight:box?.height||video.clientHeight,objectFit:typeof getComputedStyle==='function'?getComputedStyle(video).objectFit:'contain',single});
  }
  root.DV_SCAN_V16_CAMERA={version:VERSION,frameReady,streamLive,stopVideoStream,waitForFrame,getCameraStream,statePolicy,start,capture,geometry};
})();
