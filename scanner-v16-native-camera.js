(()=>{
  'use strict';
  const root=globalThis;
  const VERSION='16.8.0-lab';

  function isAppleMobile(nav=(typeof navigator!=='undefined'?navigator:null)){
    if(!nav)return false;
    const ua=String(nav.userAgent||'');
    const platform=String(nav.platform||'');
    return /iPad|iPhone|iPod/i.test(ua)||(platform==='MacIntel'&&Number(nav.maxTouchPoints||0)>1);
  }
  function inputPolicy(kind='camera'){
    return kind==='gallery'?{accept:'image/*',capture:null}:{accept:'image/*',capture:'environment'};
  }
  function stopAnyVideo(video){
    try{video?.srcObject?.getTracks?.().forEach(t=>t.stop())}catch{}
    try{if(video)video.srcObject=null}catch{}
  }
  function clearLegacyStream(){
    const video=typeof document!=='undefined'?document.getElementById('dvV16Video'):null;
    stopAnyVideo(video);
  }

  function install(){
    if(typeof document==='undefined'||!isAppleMobile())return false;
    const launch=document.getElementById('dvV16Launch'),dialog=document.getElementById('dvV16Dialog'),video=document.getElementById('dvV16Video'),photo=document.getElementById('dvV16Photo'),capture=document.getElementById('dvV16Capture'),choose=document.getElementById('dvV16Choose'),start=document.getElementById('dvV16Camera'),file=document.getElementById('dvV16File'),status=document.getElementById('dvV16Status'),stage=document.querySelector('.dvV16Stage');
    if(!launch||!dialog||!capture||!choose||!file||!stage)return false;
    if(launch.dataset.v16NativePhoto==='1')return true;
    launch.dataset.v16NativePhoto='1';

    let placeholder=document.getElementById('dvV16NativePhotoStage');
    if(!placeholder){
      placeholder=document.createElement('div');
      placeholder.id='dvV16NativePhotoStage';
      placeholder.style.cssText='padding:34px 22px;text-align:center;color:#9ca5b0;font-size:10px;line-height:1.6;max-width:360px;';
      placeholder.innerHTML='<div style="color:#efd18c;font-size:12px;letter-spacing:.08em;margin-bottom:8px">iPHONE FOTO-MODUS</div><div>Für maximale Schärfe verwendet V16 auf iPhone/iPad jetzt die native Fotokamera statt eines Web-Videostreams.</div>';
      stage.appendChild(placeholder);
    }

    const say=text=>{if(status)status.textContent=text};
    const showIdle=()=>{
      clearLegacyStream();
      if(video)video.classList.add('dvV16Hidden');
      if(photo)photo.classList.add('dvV16Hidden');
      placeholder.classList.remove('dvV16Hidden');
      capture.disabled=false;
      capture.textContent='FOTO AUFNEHMEN';
      choose.disabled=false;
      choose.textContent='FOTO AUSWÄHLEN';
      if(start){start.disabled=true;start.style.display='none'}
      const hint=document.getElementById('dvV16StageHint');
      if(hint)hint.textContent='Native iPhone-Fotokamera · Karte vollständig und möglichst ohne Spiegelung aufnehmen.';
      say('iPhone Foto-Modus bereit · FOTO AUFNEHMEN öffnet die native Kamera.');
    };
    const configureInput=kind=>{
      const p=inputPolicy(kind);file.setAttribute('accept',p.accept);
      if(p.capture)file.setAttribute('capture',p.capture);else file.removeAttribute('capture');
      file.value='';
      return p;
    };
    const openPicker=kind=>{
      clearLegacyStream();
      configureInput(kind);
      say(kind==='gallery'?'Mediathek wird geöffnet …':'Native Fotokamera wird geöffnet …');
      try{file.click()}catch(e){console.warn('Scanner V16.8 native photo picker',e);say('Fotoauswahl konnte nicht geöffnet werden. Bitte erneut tippen.')}
    };
    const populateFolders=()=>{
      const sel=document.getElementById('dvV16Folder');if(!sel)return;
      let fs=[];try{if(typeof folders!=='undefined'&&Array.isArray(folders))fs=folders}catch{}
      let current='';try{if(typeof activeFolder!=='undefined')current=activeFolder||''}catch{}
      sel.replaceChildren();
      const none=document.createElement('option');none.value='';none.textContent='Ohne Binder';sel.appendChild(none);
      for(const f of fs){const o=document.createElement('option');o.value=f.id;o.textContent=f.name||'Binder';sel.appendChild(o)}
      sel.value=current||'';
    };
    const openNative=()=>{
      populateFolders();
      const tcg=document.getElementById('dvV16Tcg');
      try{if(tcg&&typeof selectedScanTcg!=='undefined')tcg.value=selectedScanTcg==='one_piece'?'one_piece':'pokemon'}catch{}
      clearLegacyStream();
      if(!dialog.open)dialog.showModal();
      try{root.DV_SCAN_V16?.setMode?.(root.DV_SCAN_V16?.mode||'single')}catch{}
      showIdle();
    };

    launch.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();openNative()},true);
    capture.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();openPicker('camera')},true);
    choose.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();openPicker('gallery')},true);
    file.addEventListener('change',()=>{
      const selected=!!file.files?.[0];
      if(selected){placeholder.classList.add('dvV16Hidden');say('Foto übernommen · V16 analysiert die Aufnahme …')}
      setTimeout(()=>file.setAttribute('capture','environment'),0);
    });
    dialog.addEventListener('close',()=>{clearLegacyStream();showIdle()});

    const api=root.DV_SCAN_V16;if(api)api.open=openNative;
    showIdle();
    root.DV_SCAN_V16_NATIVE_CAMERA={version:VERSION,isAppleMobile,inputPolicy,stopAnyVideo,install,openNative};
    return true;
  }

  root.DV_SCAN_V16_NATIVE_CAMERA={version:VERSION,isAppleMobile,inputPolicy,stopAnyVideo,install};
  if(typeof document!=='undefined'){let tries=0;const t=setInterval(()=>{tries++;if(install()||tries>180)clearInterval(t)},50)}
})();
