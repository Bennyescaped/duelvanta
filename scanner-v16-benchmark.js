(()=>{
  'use strict';
  const VERSION='16.1.0-lab',KEY='duelvanta_scanner_v16_benchmark_v1',MAX=120;let installed=false;
  const now=()=>typeof performance!=='undefined'?performance.now():Date.now();
  function load(){try{const x=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(x)?x:[]}catch{return[]}}
  function save(rows){try{localStorage.setItem(KEY,JSON.stringify(rows.slice(-MAX)))}catch{}}
  function compact(out,ms){return{at:new Date().toISOString(),engine:'V16',version:out?.version||VERSION,mode:out?.mode||null,tcg:out?.tcg||null,layout:out?.layout||null,elapsed_ms:Math.round(ms),ready:Number(out?.ready||0),review:Number(out?.review||0),empty:Number(out?.empty||0),geometry:out?.geometry||null,results:(out?.results||[]).map(r=>({slot:r.slot||null,confidence:Number(r.confidence||0),quality:Number(r.quality?.score||0),vision_recommended:!!r.visionRecommended,name:r.best?.name||null,number:r.best?.number||r.id?.code||null,language:r.best?.language||null}))}}
  function record(row){const rows=load();rows.push(row);save(rows);return row}
  function clear(){try{localStorage.removeItem(KEY)}catch{}}
  function summary(){const rows=load();if(!rows.length)return{count:0};const avg=k=>Math.round(rows.reduce((a,x)=>a+Number(x[k]||0),0)/rows.length);return{count:rows.length,average_ms:avg('elapsed_ms'),ready:rows.reduce((a,x)=>a+x.ready,0),review:rows.reduce((a,x)=>a+x.review,0),empty:rows.reduce((a,x)=>a+x.empty,0)}}
  function exportJson(){return JSON.stringify({version:VERSION,exported_at:new Date().toISOString(),summary:summary(),runs:load()},null,2)}
  function install(){const core=window.DV_SCAN_V16_CORE;if(!core||installed)return !!core;installed=true;const base=core.analyze.bind(core);core.analyze=async function(source,opts={}){const t=now();try{const out=await base(source,opts);record(compact(out,now()-t));return out}catch(e){record({at:new Date().toISOString(),engine:'V16',version:VERSION,mode:opts.mode||null,tcg:opts.tcg||null,layout:opts.layout||null,elapsed_ms:Math.round(now()-t),error:String(e?.message||e)});throw e}};window.DV_SCAN_V16_BENCHMARK={version:VERSION,load,record,clear,summary,exportJson};return true}
  let tries=0;const t=setInterval(()=>{tries++;if(install()||tries>120)clearInterval(t)},50);
})();