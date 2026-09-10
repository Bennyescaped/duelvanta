(()=>{
  'use strict';
  const root=globalThis;
  const VERSION='16.9.0-lab';
  const STATES=new Set(['idle','camera-starting','camera-ready','decoding','preview','analyzing','result','error']);

  const errorOf=(value,fallback='Unbekannter Scannerfehler.')=>value instanceof Error?value:new Error(String(value||fallback));
  const nextFrame=()=>new Promise(resolve=>typeof requestAnimationFrame==='function'?requestAnimationFrame(()=>resolve()):setTimeout(resolve,0));

  function withTimeout(promise,timeoutMs,label='operation_timeout'){
    let timer;
    const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(label)),Math.max(250,Number(timeoutMs)||30000))});
    return Promise.race([Promise.resolve(promise),timeout]).finally(()=>clearTimeout(timer));
  }

  async function decodeFile(file,{timeoutMs=15000}={}){
    if(!file)throw new Error('Kein Foto ausgewählt.');
    if(file.type&&!String(file.type).startsWith('image/'))throw new Error('Die ausgewählte Datei ist kein Bild.');
    if(typeof createImageBitmap==='function'){
      try{return await withTimeout(createImageBitmap(file,{imageOrientation:'from-image'}),timeoutMs,'Bild konnte nicht rechtzeitig dekodiert werden.')}
      catch(error){if(typeof document==='undefined')throw error}
    }
    if(typeof document==='undefined')throw new Error('Bilddekodierung ist in dieser Umgebung nicht verfügbar.');
    const url=URL.createObjectURL(file),image=new Image();
    try{
      image.decoding='async';
      image.src=url;
      if(typeof image.decode==='function')await withTimeout(image.decode(),timeoutMs,'Bild konnte nicht rechtzeitig dekodiert werden.');
      else await withTimeout(new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error('Foto konnte nicht geöffnet werden.'))}),timeoutMs,'Bild konnte nicht rechtzeitig dekodiert werden.');
      if(!image.naturalWidth||!image.naturalHeight)throw new Error('Das Foto enthält keine lesbaren Bilddaten.');
      return image;
    }finally{URL.revokeObjectURL(url)}
  }

  function bindOnce(target,type,key,listener,options){
    if(!target?.addEventListener)return false;
    const token=`v16Bound${String(key).replace(/[^a-z0-9]/gi,'')}`;
    if(target.dataset?.[token]==='1')return false;
    if(target.dataset)target.dataset[token]='1';
    target.addEventListener(type,listener,options);
    return true;
  }

  function createController({analyze,decode=decodeFile,timeoutMs=120000,onState=()=>{},onResult=()=>{},onError=()=>{}}={}){
    if(typeof analyze!=='function')throw new Error('V16 analyze callback fehlt.');
    let state='idle',runId=0,active=null;
    const transition=(next,detail={})=>{
      if(!STATES.has(next))throw new Error(`Unbekannter Scanner-State: ${next}`);
      state=next;
      try{onState({state,runId,...detail})}catch{}
      return state;
    };
    const run=async(input,options={})=>{
      if(active)throw new Error('Eine Analyse läuft bereits.');
      const id=++runId;
      let job;
      job=(async()=>{
        let source=input,decoded=false;
        try{
          if(typeof File!=='undefined'&&input instanceof File||typeof Blob!=='undefined'&&input instanceof Blob){
            transition('decoding',{message:'Foto wird übernommen …'});
            source=await decode(input,{timeoutMs:15000});decoded=true;
          }
          transition('preview',{source,message:'Bild übernommen · Vorbereitung läuft …'});
          await nextFrame();
          transition('analyzing',{source,message:'OCR, Katalog und Artwork werden geprüft …'});
          const result=await withTimeout(analyze(source,options),timeoutMs,'Die Analyse hat das Zeitlimit überschritten. Bitte erneut versuchen.');
          if(id!==runId)throw new Error('Analyse wurde verworfen.');
          transition('result',{result,message:'Analyse abgeschlossen.'});
          try{onResult(result,{runId:id,source})}catch{}
          return result;
        }catch(value){
          const error=errorOf(value);
          if(id!==runId)throw error;
          transition('error',{error,message:error.message});
          try{onError(error,{runId:id})}catch{}
          throw error;
        }finally{
          if(decoded&&typeof source?.close==='function')try{source.close()}catch{}
          if(active===job)active=null;
        }
      })();
      active=job;return job;
    };
    const recover=(message='Bereit für eine neue Aufnahme.')=>{runId++;active=null;return transition('idle',{message})};
    return{version:VERSION,run,recover,transition,get state(){return state},get busy(){return !!active},get runId(){return runId}};
  }

  root.DV_SCAN_V16_RUNTIME={version:VERSION,STATES:[...STATES],withTimeout,decodeFile,bindOnce,createController};
})();
