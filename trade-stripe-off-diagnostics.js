/* Preview-only proof that Stripe sandbox is OFF at the application boundary.
   Same-origin anonymous POST only. No auth token, no Stripe provider call, no mutation. */
(()=>{
  'use strict';
  const PARAM='dv_stripe_off_diag';
  const runtime=window.DV_SUPABASE;
  let enabled=false;
  try{
    enabled=runtime?.environment==='preview' &&
      new URLSearchParams(location.search).get(PARAM)==='1';
  }catch{}
  if(!enabled)return;

  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const panel=()=>{
    let node=document.getElementById('dvStripeOffDiagnostics');
    if(node)return node;
    node=document.createElement('section');
    node.id='dvStripeOffDiagnostics';
    node.setAttribute('role','status');
    node.style.cssText='grid-column:1/-1;border:1px solid rgba(199,164,93,.55);border-radius:14px;padding:14px;margin:12px 0;background:#0b0f14;color:#e9e1d6;font:12px/1.55 system-ui;overflow-wrap:anywhere';
    (document.querySelector('.hero')||document.getElementById('app')||document.body).insertAdjacentElement('afterend',node);
    return node;
  };

  function render(status,{http=null,error=null,detail=null}={}){
    const ref=(()=>{
      try{return new URL(runtime.url).hostname.split('.')[0]}catch{return'unknown'}
    })();
    panel().innerHTML=`<div style="color:#efd18c;font-weight:700;letter-spacing:.06em">STRIPE SANDBOX OFF DIAG · PREVIEW ONLY</div>
      <div id="dvStripeOffOverall"><b>GESAMT: ${esc(status)}</b></div>
      <div>Environment: <code>${esc(runtime.environment||'unknown')}</code></div>
      <div>Supabase Project: <code>${esc(ref)}</code></div>
      <div>Probe: <code>POST /api/market-stripe-checkout</code></div>
      <div>HTTP: <code>${esc(http??'—')}</code></div>
      <div>App-Fehler: <code>${esc(error??'—')}</code></div>
      <div style="color:#8f98a4">${esc(detail||'Anonymer Same-Origin-POST ohne Authorization-Header. PASS nur bei stripe_sandbox_disabled vor Auth/Provider.')}</div>`;
  }

  async function run(){
    render('PRÜFUNG');
    try{
      const response=await fetch('/api/market-stripe-checkout',{
        method:'POST',
        credentials:'same-origin',
        cache:'no-store',
        headers:{'content-type':'application/json'},
        body:'{}'
      });
      let body={};
      try{body=await response.json()}catch{}
      const error=String(body?.error||'');
      if(response.status===409&&error==='stripe_sandbox_disabled'){
        render('PASS',{http:response.status,error,detail:'Sandbox ist an der echten Anwendungskante OFF; Anfrage endet vor Auth und vor jedem Stripe-Providercall.'});
        return;
      }
      render('FAIL',{http:response.status,error:error||'unexpected_response',detail:'Erwartet wurde HTTP 409 + stripe_sandbox_disabled. Kein weiterer Request wird gesendet.'});
    }catch(error){
      render('BLOCKIERT',{error:'fetch_failed',detail:String(error?.message||error||'fetch_failed')});
    }
  }

  render('PRÜFUNG');
  run();
})();