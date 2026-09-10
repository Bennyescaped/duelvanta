(()=>{
  'use strict';
  const root=globalThis;
  // Transport cache only. Never selects a card, invents OCR, or changes evidence.
  function createResolver(references=[]){
    const bySource=new Map();
    for(const row of references){
      if(!['pokemon','one_piece'].includes(row.tcg)||!/^https:\/\//.test(row.sourceUrl||''))continue;
      if(!/^[a-f0-9]{64}$/.test(row.sha256||''))continue;
      if(!new RegExp(`^scanner-v16-assets/references/${row.sha256}\\.(jpg|png|webp)$`).test(row.path||''))continue;
      bySource.set(`${row.tcg}\n${row.sourceUrl}`,row);
    }
    return{
      count:bySource.size,
      resolve(card,tcg){
        const row=bySource.get(`${tcg}\n${card.image}`);
        if(!row||card.tcg&&card.tcg!==tcg)return card;
        return{...card,image:`./${row.path}`,referenceImageSource:card.image,referenceImageSha256:row.sha256};
      }
    };
  }
  let resolver=createResolver(),state={status:'unloaded',count:0,completeCatalog:false};
  async function load(){
    const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),2000);
    try{
      const response=await root.fetch('scanner-v16-assets/references.json?v=16.12.1',{signal:abort.signal});
      if(!response.ok)throw new Error(`HTTP ${response.status}`);
      const manifest=await response.json();
      if(manifest.schema!==1||!Array.isArray(manifest.references))throw new Error('invalid_reference_manifest');
      resolver=createResolver(manifest.references);state={status:'ready',count:resolver.count,completeCatalog:false};
    }catch(error){state={status:'unavailable',count:0,completeCatalog:false,reason:error.name==='AbortError'?'timeout':String(error.message)}}
    finally{clearTimeout(timer)}
    return state;
  }
  root.DV_SCAN_V16_REFERENCES={createResolver,resolve:(card,tcg)=>resolver.resolve(card,tcg),state:()=>({...state}),ready:typeof document==='undefined'?Promise.resolve(state):load()};
})();
