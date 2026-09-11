(()=>{
  'use strict';
  const button=document.getElementById('scanCard');
  if(!button||window.DV_SCAN_V16_COLLECT)return;
  window.DV_SCAN_V16_COLLECT=true;
  // Reuse COLLECT's session, collection state and selected binder.
  // The V16 pipeline needs its verified catalog and an explicit TCG context.
  window.catalogLookup=(id,context={})=>window.DV_SCAN_V16_CATALOG.lookup(id,{
    tcg:context.tcg||(typeof selectedScanTcg==='string'?selectedScanTcg:'pokemon')
  });
  const status=document.createElement('span');
  status.id='dvV16EntryStatus';
  status.setAttribute('role','status');
  status.style.cssText='font-size:12px;color:#c7a45d';
  button.insertAdjacentElement('afterend',status);
  let pending=false;
  const finish=()=>{pending=false;button.removeAttribute('aria-busy')};
  const open=async()=>{
    finish();status.textContent='';
    try{await window.DV_SCAN_V16.open()}
    catch{status.textContent='Scanner konnte nicht geöffnet werden. Bitte die Seite neu laden.'}
  };
  const failed=()=>{
    finish();
    status.textContent='Scanner konnte nicht geladen werden. Bitte die Seite neu laden.';
  };
  button.onclick=()=>{
    if(window.__DV_V16_READY)return void open();
    if(window.__DV_V16_LOAD_ERROR)return failed();
    pending=true;button.setAttribute('aria-busy','true');
    status.textContent='Scanner wird geladen …';
  };
  document.addEventListener('dv:v16:ready',()=>{if(pending)void open()});
  document.addEventListener('dv:v16:error',failed);
  const script=document.createElement('script');
  script.src='scanner-v16-loader.js?v=16.26.0';
  script.onerror=()=>{window.__DV_V16_LOAD_ERROR=new Error('Scanner loader unavailable');failed()};
  document.body.appendChild(script);
  if(new URLSearchParams(location.search).get('scan')==='1'){
    window.DV_COLLECT_READY?.then(()=>{if(typeof currentUser!=='undefined'&&currentUser)button.onclick()});
  }
})();
