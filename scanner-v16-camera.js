(()=>{
  'use strict';
  const root=globalThis;
  const VERSION='16.7.0-lab';
  const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));

  function frameReady(video){
    return !!(video&&Number(video.videoWidth)>0&&Number(video.videoHeight)>0&&Number(video.readyState||0)>=2);
  }
  function streamLive(video){
    try{return !!video?.srcObject?.getVideoTracks?.().some(t=>t&&t.readyState==='live'&&t.enabled!==false)}catch{return false}
  }
  function stopVideoStream(video){
    try{video?.srcObject?.getTracks?.().forEach(t=>t.stop())}catch{}
    try{if(video)video.srcObject=null}catch{}
  }
  function waitForFrame(video,timeoutMs=6000){
    return new Promise(resolve=>{
      if(frameReady(video)){resolve(true);return}
      let done=false,timer=null,raf=null;
      const events=['loadedmetadata','loadeddata','canplay','playing','resize'];
      const finish=ok=>{if(done)return;done=true;if(timer)clearTimeout(timer);if(raf&&typeof cancelAnimationFrame==='function')cancelAnimationFrame(raf);for(const e of events)video?.removeEventListener?.(e,check);resolve(!!ok)};
      const check=()=>{if(frameReady(video)){finish(true);return}if(typeof requestAnimationFrame==='function')raf=requestAnimationFrame(check)};
      for(const e of events)video?.addEventListener?.(e,check,{passive:true});
      timer=setTimeout(()=>finish(frameReady(video)),Math.max(500,Number(timeoutMs)||6000));
      check();
    });
  }
  async function getCameraStream(timeoutMs=7500){
    if(!navigator?.mediaDevices?.getUserMedia)throw new Error('camera_api_unavailable');
    let settled=false;
    const request=navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1920},height:{ideal:1440}},audio:false});
    return await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{if(settled)return;settled=true;reject(new Error('camera_start_timeout'))},Math.max(1500,Number(timeoutMs)||7500));
      request.then(stream=>{if(settled){try{stream?.getTracks?.().forEach(t=>t.stop())}catch{};return}settled=true;clearTimeout(timer);resolve(stream)}).catch(err=>{if(settled)return;settled=true;clearTimeout(timer);reject(err)});
    });
  }
  function statePolicy(state){
    return {
      captureDisabled:state!=='ready',
      startDisabled:state==='starting',
      startLabel:state==='ready'?'KAMERA BEREIT':state==='starting'?'KAMERA STARTET …':'KAMERA STARTEN'
    };
  }

  function install(){
    if(typeof document==='undefined')return false;
    const video=document.getElementById('dvV16Video'),start=document.getElementById('dvV16Camera'),capture=document.getElementById('dvV16Capture'),choose=document.getElementById('dvV16Choose'),dialog=document.getElementById('dvV16Dialog'),status=document.getElementById('dvV16Status');
    if(!video||!start||!capture||!choose||!dialog)return false;
    if(start.dataset.v16CameraSafe==='1')return true;
    start.dataset.v16CameraSafe='1';
    const oldCapture=capture.onclick;
    let controllerStream=null,startPromise=null,epoch=0;

    const say=text=>{if(status)status.textContent=text};
    const setState=state=>{
      const p=statePolicy(state);
      capture.disabled=p.captureDisabled;
      start.disabled=p.startDisabled;
      start.textContent=p.startLabel;
      choose.disabled=false;
      capture.dataset.v16CameraState=state;
    };
    const stopController=()=>{try{controllerStream?.getTracks?.().forEach(t=>t.stop())}catch{};controllerStream=null};

    async function reuseExisting(waitMs=3500){
      if(!streamLive(video))return false;
      try{video.playsInline=true;video.muted=true;await video.play()}catch{}
      return await waitForFrame(video,waitMs);
    }
    async function restart(){
      if(startPromise)return startPromise;
      startPromise=(async()=>{
        setState('starting');say('Kamera wird neu verbunden … FOTO AUSWÄHLEN bleibt verfügbar.');
        stopController();stopVideoStream(video);
        await delay(320);
        try{
          const s=await getCameraStream(7500);controllerStream=s;video.srcObject=s;video.playsInline=true;video.muted=true;
          try{await video.play()}catch{}
          const ok=await waitForFrame(video,5000);
          if(!ok)throw new Error('camera_frame_timeout');
          setState('ready');say('Kamera bereit · Aufnahme möglich.');return true;
        }catch(err){
          console.warn('Scanner V16.7 camera recovery',err);stopController();stopVideoStream(video);setState('idle');
          say('Kamera konnte nicht sauber gestartet werden. Bitte KAMERA STARTEN erneut tippen oder FOTO AUSWÄHLEN nutzen.');return false;
        }
      })().finally(()=>{startPromise=null});
      return startPromise;
    }
    async function ensureReady(){
      if(frameReady(video)&&streamLive(video)){setState('ready');return true}
      setState('starting');
      if(await reuseExisting(3200)){setState('ready');say('Kamera bereit · Aufnahme möglich.');return true}
      return await restart();
    }
    async function monitorAutoStart(localEpoch){
      setState('starting');say('Kamera wird vorbereitet …');
      const ok=await waitForFrame(video,6500);
      if(localEpoch!==epoch||!dialog.open)return;
      if(ok&&streamLive(video)){setState('ready');say('Kamera bereit · Aufnahme möglich.');return}
      setState('idle');say('Kamera ist noch nicht bereit. Bitte KAMERA STARTEN tippen oder FOTO AUSWÄHLEN nutzen.');
    }

    start.onclick=async e=>{
      e?.preventDefault?.();
      if(frameReady(video)&&streamLive(video)){setState('ready');say('Kamera ist bereits bereit · kein Neustart nötig.');return}
      await ensureReady();
    };
    capture.onclick=async e=>{
      e?.preventDefault?.();
      if(capture.dataset.v16SafeCaptureBusy==='1')return;
      let ok=frameReady(video)&&streamLive(video);
      if(!ok){say('Warte auf den ersten Kameraframe …');ok=await ensureReady()}
      if(!ok)return;
      capture.dataset.v16SafeCaptureBusy='1';capture.disabled=true;
      try{await Promise.resolve(oldCapture?.call(capture,e))}
      finally{
        delete capture.dataset.v16SafeCaptureBusy;
        if(!dialog.open){setState('idle');return}
        const continuous=root.DV_SCAN_V16?.mode==='continuous';
        if(continuous){const local=++epoch;setState('starting');setTimeout(()=>monitorAutoStart(local),120)}
        else if(frameReady(video)&&streamLive(video))setState('ready');else setState('idle');
      }
    };

    const observer=new MutationObserver(()=>{
      if(dialog.open){const local=++epoch;setTimeout(()=>monitorAutoStart(local),0)}
      else{epoch++;stopController();setState('idle')}
    });
    observer.observe(dialog,{attributes:true,attributeFilter:['open']});
    dialog.addEventListener('close',()=>{epoch++;stopController();stopVideoStream(video);setState('idle')});
    video.addEventListener('loadedmetadata',()=>{if(dialog.open&&frameReady(video)&&streamLive(video)){setState('ready');say('Kamera bereit · Aufnahme möglich.')}});
    video.addEventListener('canplay',()=>{if(dialog.open&&frameReady(video)&&streamLive(video)){setState('ready')}});
    setState(dialog.open?'starting':'idle');
    root.DV_SCAN_V16_CAMERA={version:VERSION,frameReady,streamLive,stopVideoStream,waitForFrame,getCameraStream,statePolicy,install,ensureReady};
    return true;
  }

  root.DV_SCAN_V16_CAMERA={version:VERSION,frameReady,streamLive,stopVideoStream,waitForFrame,getCameraStream,statePolicy,install};
  if(typeof document!=='undefined'){let tries=0;const t=setInterval(()=>{tries++;if(install()||tries>180)clearInterval(t)},50)}
})();
