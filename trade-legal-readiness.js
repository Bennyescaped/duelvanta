/* Browser compatibility barrier for the unapplied legal candidate.
   No migration, legal approval, payment activation or server authorization. */
(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root?.document)api.install(root);
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const VERSION='1.2';
  const SCHEMA_VERSION='trade-legal-contract-model-v1.2';
  const ACTIONS='#dvBuyNow,#sendOffer,[data-accept-offer],[data-checkout-offer],[data-o-stripe],[data-o-withdraw],#oWithdrawalPrepare,#oWithdrawalConfirm,#saveBuyerPurchaseType';
  const COPY='LEGAL-ENTWURF · Neue Vertragsaktionen sind in dieser Vorschau gesperrt. Das Datenbankschema fehlt oder seine Kompatibilität ist nicht bestätigt. Bestehende Bestellungen bleiben einsehbar.';
  function diagnosticsEnabled(root){
    try{
      return root?.DV_SUPABASE?.environment==='preview' &&
        new root.URLSearchParams(root.location?.search||'').get('dv_legal_diag')==='1';
    }catch{return false}
  }
  function trace(root,phase,detail={}){
    if(!diagnosticsEnabled(root))return;
    try{
      const list=root.__DV_TRADE_LEGAL_TRACE||(root.__DV_TRADE_LEGAL_TRACE=[]);
      const entry=Object.freeze({seq:list.length+1,source:'guard',phase,...detail});
      list.push(entry);
      if(typeof root.CustomEvent==='function')root.dispatchEvent(new root.CustomEvent('dv:trade-legal-trace',{detail:entry}));
    }catch{}
  }
  function supportsCandidate(response){
    const data=response?.data;
    // Compatibility is computed from real catalogs by a STABLE, read-only RPC.
    return !!response&&!response.error&&!!data&&!Array.isArray(data)&&
      data.compatible===true&&data.revision===SCHEMA_VERSION;
  }
  async function probe(client,{timeoutMs=5000,schedule=setTimeout,cancel=clearTimeout}={}){
    if(typeof client?.rpc!=='function')return false;
    let timer;
    try{
      const request=Promise.resolve().then(()=>client.rpc('get_market_legal_schema_readiness_v1',{}, {get:true}));
      return await Promise.race([
        request.then(supportsCandidate,()=>false),
        new Promise(resolve=>{timer=schedule(()=>resolve(false),timeoutMs)})
      ]);
    }catch{return false}finally{if(timer!==undefined)cancel(timer)}
  }
  function install(root){
    if(root.DV_TRADE_LEGAL_SCHEMA)return;
    const doc=root.document,outputs=new Set();
    trace(root,'installed',{guard_version:VERSION,schema_revision:SCHEMA_VERSION});
    let available=false,settled=false,attempts=0,poll=null,observer=null;
    const state=()=>{
      root.DV_TRADE_LEGAL_SCHEMA=Object.freeze({guard_version:VERSION,available,
        state:settled?(available?'schema-compatible':'schema-unavailable'):'checking'});
      trace(root,'state',{state:root.DV_TRADE_LEGAL_SCHEMA.state,available});
      if(settled&&typeof root.CustomEvent==='function')root.dispatchEvent(new root.CustomEvent('dv:trade-legal-schema',{detail:root.DV_TRADE_LEGAL_SCHEMA}));
    };
    function lockControls(){
      if(!settled||available)return;
      const controls=[...(doc.querySelectorAll?.(ACTIONS)||[]),doc.getElementById('buyerPurchaseType')];
      for(const element of controls)if(element&&!element.disabled)element.disabled=true;
    }
    function inform(target){
      if(available)return;
      let note=doc.getElementById('dvTradeLegalSchemaNotice');
      if(!note){
        note=doc.createElement('div');note.id='dvTradeLegalSchemaNotice';note.className='msg';
        note.setAttribute('role','status');note.setAttribute('tabindex','-1');
        (doc.querySelector('.hero')||doc.getElementById('app')||doc.body)?.appendChild(note);
      }
      if(note)note.textContent=COPY;
      const modal=target?.closest?.('dialog');
      const output=modal?.querySelector('#dvBuyMsg,#offerMsg,#dvODMsg')||
        (target?.id==='saveBuyerPurchaseType'?doc.getElementById('buyerPurchaseTypeMsg'):null);
      if(output){output.textContent=COPY;output.setAttribute('role','status');outputs.add(output)}
      lockControls();
      return output||note;
    }
    function isAction(event){
      const target=event.target?.closest?event.target:event.target?.parentElement;
      if(event.type==='submit')return event.submitter?.closest?.(ACTIONS)||target?.querySelector?.(ACTIONS);
      return target?.closest?.(ACTIONS);
    }
    function block(event){
      if(available)return;
      const action=isAction(event);if(!action)return;
      event.preventDefault();event.stopImmediatePropagation();
      inform(action)?.focus?.();
    }
    function client(){
      try{return root.__dvAppDb||(typeof db!=='undefined'?db:null)}catch{return null}
    }
    function finish(ok){
      available=ok;settled=true;state();
      if(available){
        doc.getElementById('dvTradeLegalSchemaNotice')?.remove?.();
        for(const output of outputs)if(output.textContent===COPY)output.textContent='';
        return;
      }
      inform();
      if(typeof root.MutationObserver==='function'){
        observer=new root.MutationObserver(lockControls);
        observer.observe(doc.body,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled']});
      }
    }
    async function check(){
      const current=client();
      if(!current){
        if(++attempts>=150){finish(false);return}
        poll=root.setTimeout(check,100);return;
      }
      trace(root,'probe-start',{rpc:'get_market_legal_schema_readiness_v1',method:'GET'});
      const ok=await probe(current,{schedule:root.setTimeout.bind(root),cancel:root.clearTimeout.bind(root)});
      trace(root,'probe-result',{compatible:ok,revision:ok?SCHEMA_VERSION:null});
      finish(ok);
    }
    state();
    doc.addEventListener('click',block,true);
    doc.addEventListener('submit',block,true);
    poll=root.setTimeout(check,0);
    root.addEventListener?.('pagehide',()=>{root.clearTimeout(poll);observer?.disconnect()},{once:true});
  }
  return Object.freeze({VERSION,SCHEMA_VERSION,ACTIONS,COPY,supportsCandidate,probe,install});
});
