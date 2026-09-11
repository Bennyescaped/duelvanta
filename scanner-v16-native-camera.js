(()=>{
  'use strict';
  const root=globalThis;
  const VERSION='16.9.0-lab';
  function isAppleMobile(nav=(typeof navigator!=='undefined'?navigator:null)){if(!nav)return false;const ua=String(nav.userAgent||''),platform=String(nav.platform||'');return /iPad|iPhone|iPod/i.test(ua)||(platform==='MacIntel'&&Number(nav.maxTouchPoints||0)>1)}
  function inputPolicy(kind='camera'){return kind==='gallery'?{accept:'image/*',capture:null}:{accept:'image/*',capture:'environment'}}
  function configure(input,kind='camera'){if(!input)return null;const policy=inputPolicy(kind);input.accept=policy.accept;if(policy.capture)input.setAttribute('capture',policy.capture);else input.removeAttribute('capture');return policy}
  function open(input,kind='camera'){if(!input)throw new Error('Foto-Input fehlt.');configure(input,kind);input.value='';input.click();return true}
  function stopAnyVideo(video){try{video?.srcObject?.getTracks?.().forEach(track=>track.stop())}catch{};try{if(video)video.srcObject=null}catch{}}
  root.DV_SCAN_V16_NATIVE_CAMERA={version:VERSION,isAppleMobile,inputPolicy,configure,open,stopAnyVideo};
})();
