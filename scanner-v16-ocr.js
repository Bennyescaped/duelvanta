(()=>{
  'use strict';
  const root=globalThis;
  // One reusable worker, serialized passes: no three simultaneous WASM engines
  // on an iPhone and no OCR at all in the live geometry loop.
  function create({assets={},timeoutMs=30000}={}){
    let worker=null,queue=Promise.resolve();
    async function reset(){const old=worker;worker=null;if(old)try{(await old).terminate()}catch{}}
    function read(canvas,psm='6'){
      const job=queue.catch(()=>{}).then(async()=>{
        if(!root.Tesseract)throw new Error('OCR-Modul fehlt.');
        if(!root.Tesseract.createWorker)return String((await root.Tesseract.recognize(canvas,'eng',{tessedit_pageseg_mode:psm}))?.data?.text||'');
        let timer;
        try{
          const operation=(async()=>{
            if(!worker)worker=root.Tesseract.createWorker('eng',1,assets);
            const current=await worker;
            await current.setParameters({tessedit_pageseg_mode:String(psm),preserve_interword_spaces:'1'});
            return String((await current.recognize(canvas))?.data?.text||'');
          })();
          return await Promise.race([operation,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('ocr_timeout')),timeoutMs)})]);
        }catch(error){void reset();throw error}finally{clearTimeout(timer)}
      });queue=job;return job;
    }
    return{read,reset};
  }
  const assets=root.DV_V16_E2E?{workerPath:'/node_modules/tesseract.js/dist/worker.min.js',corePath:'/node_modules/tesseract.js-core',langPath:'/node_modules/@tesseract.js-data/eng/4.0.0_best_int',workerBlobURL:false}:{};
  root.DV_SCAN_V16_OCR={create,...create({assets})};
})();
