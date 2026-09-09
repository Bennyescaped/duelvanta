(()=>{
  'use strict';
  const add=(src,onload)=>{const s=document.createElement('script');s.src=src;s.defer=true;if(onload)s.onload=onload;document.body.appendChild(s)};
  const loadV16=()=>add('scanner-v16-core.js?v=16.1.0',()=>add('scanner-v16-geometry.js?v=16.1.0',()=>add('scanner-v16-vision.js?v=16.1.0',()=>add('scanner-v16-binder.js?v=16.1.0',()=>add('scanner-v16-market.js?v=16.1.0',()=>add('scanner-v16-benchmark.js?v=16.1.0',()=>add('scanner-v16-ui.js?v=16.1.0',()=>add('scanner-v16-overlay.js?v=16.1.0',()=>add('scanner-v16-freeform-ui.js?v=16.1.0')))))))));
  if(window.DV_SCAN_V15)loadV16();
  else add('scanner-v15-loader.js?v=15.8',loadV16);
})();
