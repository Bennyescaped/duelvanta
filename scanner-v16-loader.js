(()=>{
  'use strict';
  const add=(src,onload)=>{const s=document.createElement('script');s.src=src;s.defer=true;if(onload)s.onload=onload;document.body.appendChild(s)};
  const modules=[
    'scanner-v16-tcg.js?v=16.2.0',
    'scanner-v16-core.js?v=16.2.0',
    'scanner-v16-quality.js?v=16.3.0',
    'scanner-v16-geometry.js?v=16.1.0',
    'scanner-v16-vision.js?v=16.1.0',
    'scanner-v16-resilience.js?v=16.5.0',
    'scanner-v16-binder.js?v=16.1.0',
    'scanner-v16-market.js?v=16.1.0',
    'scanner-v16-benchmark.js?v=16.5.0',
    'scanner-v16-ui.js?v=16.1.0',
    'scanner-v16-explain.js?v=16.4.0',
    'scanner-v16-guidance.js?v=16.5.0',
    'scanner-v16-overlay.js?v=16.1.0',
    'scanner-v16-freeform-ui.js?v=16.1.0'
  ];
  const chain=(list,i=0)=>{if(i>=list.length)return;add(list[i],()=>chain(list,i+1))};
  const loadV16=()=>chain(modules);
  if(window.DV_SCAN_V15)loadV16();
  else add('scanner-v15-loader.js?v=15.8',loadV16);
})();
