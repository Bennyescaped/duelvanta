(()=>{
  'use strict';
  if(window.__DV_V16_LOADING)return;window.__DV_V16_LOADING=true;
  const VERSION='16.9.0';
  const modules=[
    'scanner-v16-tcg.js?v=16.2.0','scanner-v16-core.js?v=16.2.0','scanner-v16-quality.js?v=16.3.0','scanner-v16-geometry.js?v=16.1.0','scanner-v16-vision.js?v=16.1.0','scanner-v16-resilience.js?v=16.5.0','scanner-v16-binder.js?v=16.1.0','scanner-v16-market.js?v=16.1.0','scanner-v16-benchmark.js?v=16.5.0','scanner-v16-runtime.js?v=16.9.0','scanner-v16-camera.js?v=16.9.0','scanner-v16-native-camera.js?v=16.9.0','scanner-v16-ui.js?v=16.9.0','scanner-v16-explain.js?v=16.4.0','scanner-v16-guidance.js?v=16.5.0','scanner-v16-overlay.js?v=16.1.0','scanner-v16-freeform-ui.js?v=16.1.0','scanner-v16-benchmark-session.js?v=16.9.0'
  ];
  const add=src=>new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=src;script.async=false;script.onload=resolve;script.onerror=()=>reject(new Error(`V16 Modul konnte nicht geladen werden: ${src}`));document.body.appendChild(script)});
  const load=async()=>{try{if(!window.DV_SCAN_V16_STANDALONE&&!window.DV_SCAN_V15)await add('scanner-v15-loader.js?v=15.8');for(const module of modules)await add(module);window.__DV_V16_READY=true;document.dispatchEvent(new CustomEvent('dv:v16:ready',{detail:{version:VERSION}}))}catch(error){window.__DV_V16_LOAD_ERROR=error;console.error('Scanner V16 loader',error);document.dispatchEvent(new CustomEvent('dv:v16:error',{detail:{error}}))}};
  load();
})();
