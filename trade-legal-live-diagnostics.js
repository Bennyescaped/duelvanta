/* Preview-only, read-only live legal diagnostics.
   Uses the real authenticated browser session. Never displays tokens or private data. */
(()=>{
  'use strict';
  const PARAM='dv_legal_diag';
  const TABLES=['market_contract_snapshots','market_withdrawal_drafts','market_withdrawals','marketplace_message_outbox'];
  const DENIED_CODES=new Set(['42501','PGRST106','PGRST205']);
  const runtime=window.DV_SUPABASE;
  let enabled=false;
  try{enabled=runtime?.environment==='preview'&&new URLSearchParams(location.search).get(PARAM)==='1'}catch{}
  if(!enabled)return;

  const trace=window.__DV_TRADE_LEGAL_TRACE||(window.__DV_TRADE_LEGAL_TRACE=[]);
  const state={auth:'checking',private:[],flow:'checking',overall:'checking'};
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const label=value=>value==='PASS'?'PASS':value==='FAIL'?'FAIL':value==='BLOCKIERT'?'BLOCKIERT':'PRÜFUNG';

  function panel(){
    let node=document.getElementById('dvLegalLiveDiagnostics');
    if(node)return node;
    node=document.createElement('section');
    node.id='dvLegalLiveDiagnostics';
    node.setAttribute('role','status');
    node.style.cssText='grid-column:1/-1;border:1px solid rgba(199,164,93,.55);border-radius:14px;padding:14px;margin:12px 0;background:#0b0f14;color:#e9e1d6;font:12px/1.55 system-ui;overflow-wrap:anywhere';
    (document.querySelector('.hero')||document.getElementById('app')||document.body).insertAdjacentElement('afterend',node);
    return node;
  }

  const first=(source,phase)=>trace.find(entry=>entry?.source===source&&entry?.phase===phase);
  const index=(source,phase)=>trace.findIndex(entry=>entry?.source===source&&entry?.phase===phase);

  function flowStatus(){
    const installed=index('guard','installed'),probeStart=index('guard','probe-start'),probeResult=index('guard','probe-result');
    const compatibleState=trace.findIndex(entry=>entry?.source==='guard'&&entry?.phase==='state'&&entry?.state==='schema-compatible'&&entry?.available===true);
    const guardSettled=index('loader','guard-settled'),loaderStart=index('loader','loader-start'),loaderLoaded=index('loader','loader-loaded'),runtimeReady=index('loader','runtime-ready');
    const probe=trace[probeResult];
    const complete=[installed,probeStart,probeResult,compatibleState,guardSettled,loaderStart,loaderLoaded,runtimeReady].every(value=>value>=0);
    if(!complete)return 'BLOCKIERT';
    if(!(installed<probeStart&&probeStart<probeResult&&probeResult<compatibleState&&compatibleState<=guardSettled&&guardSettled<loaderStart&&loaderStart<loaderLoaded&&loaderLoaded<runtimeReady))return 'FAIL';
    if(probe?.compatible!==true||probe?.revision!=='trade-legal-contract-model-v1.2')return 'FAIL';
    return 'PASS';
  }

  function render(){
    state.flow=flowStatus();
    const privatePass=state.private.length===TABLES.length&&state.private.every(item=>item.status==='PASS');
    const privateFail=state.private.some(item=>item.status==='FAIL');
    if(state.auth==='PASS'&&privatePass&&state.flow==='PASS')state.overall='PASS';
    else if(state.auth==='FAIL'||privateFail||state.flow==='FAIL')state.overall='FAIL';
    else state.overall='BLOCKIERT';

    const probe=first('guard','probe-result');
    const probeStart=first('guard','probe-start');
    const readiness=probe
      ? `${probeStart?.method||'GET'} ${probeStart?.rpc||'get_market_legal_schema_readiness_v1'} · compatible=${String(probe.compatible===true)} · revision=${probe.revision||'—'}`
      : 'noch kein Probe-Ergebnis';
    const phases=trace.map(entry=>`${entry.seq}:${entry.source}/${entry.phase}`).join(' → ')||'noch keine Trace-Ereignisse';
    const rows=TABLES.map(table=>{
      const item=state.private.find(entry=>entry.table===table);
      return `<li><code>dv_market_private.${esc(table)}</code>: <b>${label(item?.status||'checking')}</b>${item?.code?` · ${esc(item.code)}`:''}</li>`;
    }).join('');

    panel().innerHTML=`<div style="color:#efd18c;font-weight:700;letter-spacing:.06em">LIVE-LEGAL-DIAGNOSE · READ ONLY · v1.1</div>
      <div id="dvLegalDiagOverall"><b>GESAMT: ${label(state.overall)}</b></div>
      <div>Browser-Session: <b>${label(state.auth)}</b></div>
      <div>Guard/RPC/Loader: <b>${label(state.flow)}</b></div>
      <div>Readiness-RPC: <code>${esc(readiness)}</code></div>
      <div>Private SELECT-Grenzen:</div><ul style="margin:6px 0 8px;padding-left:20px">${rows}</ul>
      <div style="color:#8f98a4">Trace: ${esc(phases)}</div>
      <div style="color:#8f98a4">Direkte Browser-GETs mit Accept-Profile=dv_market_private; nur Status/Fehlercode wird ausgewertet. Tokens und Antwortdaten werden nie angezeigt.</div>`;
  }

  function getClient(){
    try{
      if(window.__dvAppDb?.auth?.getSession)return window.__dvAppDb;
      if(window.supabase?.createClient&&runtime?.url&&runtime?.key){
        window.__dvLegalDiagDb=window.__dvLegalDiagDb||window.supabase.createClient(runtime.url,runtime.key,{auth:{persistSession:true,autoRefreshToken:true}});
        return window.__dvLegalDiagDb;
      }
    }catch{}
    return null;
  }

  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  async function waitForClient(timeoutMs=12000){
    const end=Date.now()+timeoutMs;
    while(Date.now()<end){
      const client=getClient();
      if(client?.auth?.getSession)return client;
      await sleep(50);
    }
    return null;
  }
  async function waitForTrace(timeoutMs=12000){
    const end=Date.now()+timeoutMs;
    while(Date.now()<end){
      const flow=flowStatus();
      if(flow==='PASS'||flow==='FAIL')return;
      await sleep(50);
    }
  }

  async function privateProbe(session,table){
    if(!session?.access_token)return{table,status:'BLOCKIERT',code:'NO_SESSION'};
    try{
      const url=new URL('/rest/v1/'+encodeURIComponent(table),runtime.url);
      url.searchParams.set('select','id');
      url.searchParams.set('limit','1');
      const response=await fetch(url.href,{
        method:'GET',
        cache:'no-store',
        headers:{
          apikey:runtime.key,
          authorization:'Bearer '+session.access_token,
          'accept-profile':'dv_market_private',
          accept:'application/json'
        }
      });
      if(response.ok){
        try{await response.body?.cancel?.()}catch{}
        return{table,status:'FAIL',code:'HTTP_'+response.status+'/ACCESS_ALLOWED'};
      }
      let pgCode='';
      try{
        const body=await response.json();
        pgCode=String(body?.code||'');
      }catch{}
      const code='HTTP_'+response.status+(pgCode?'/'+pgCode:'');
      if(response.status===401||response.status===403||DENIED_CODES.has(pgCode))return{table,status:'PASS',code};
      return{table,status:'BLOCKIERT',code};
    }catch{return{table,status:'BLOCKIERT',code:'FETCH_EXCEPTION'}}
  }

  async function run(){
    render();
    const client=await waitForClient();
    if(!client){state.auth='BLOCKIERT';render();return}
    let session;
    try{
      const result=await client.auth.getSession();
      session=result?.data?.session||null;
      if(!session){state.auth='BLOCKIERT';render();return}
      state.auth='PASS';render();
    }catch{state.auth='BLOCKIERT';render();return}

    for(const table of TABLES){
      state.private.push(await privateProbe(session,table));
      render();
    }
    await waitForTrace();
    render();
  }

  window.addEventListener('dv:trade-legal-trace',render);
  render();
  run();
})();