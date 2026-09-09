(()=>{
  'use strict';
  const VERSION='16.1.0-lab';
  const CONFIG={enabled:false,provider:null,endpoint:null};
  function shouldEscalate(result){if(!result)return false;const q=Number(result.quality?.score||0),c=Number(result.confidence||0);return q>=32&&(!result.best||!result.id||c<84)}
  async function analyze(){return{enabled:false,configured:false,provider:null,reason:'provider_not_configured'} }
  function state(){return{...CONFIG,version:VERSION}}
  window.DV_SCAN_V16_VISION={version:VERSION,state,shouldEscalate,analyze};
})();