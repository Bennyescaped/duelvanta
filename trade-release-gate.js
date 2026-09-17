(()=>{
  'use strict';

  const TRADE_SCRIPTS=[
    'trade.js',
    'trade-b07-eligibility.js?v=1.1',
    'offers-fix.js?v=1.0',
    'seller-trust.js?v=2.0',
    'trade-c2c-swap.js?v=1.0',
    'trade-v2.js?v=2.1',
    'trade-b07-reviews.js?v=1.0',
    'trade-payment-flow.js?v=1.0',
    'trade-shipping-address.js?v=1.1',
    'trade-shipping-options.js?v=1.2',
    'trade-sealed.js?v=1.2.0',
    'trade-listing-type-rules.js?v=1.0',
    'trade-sealed-sale-only.js?v=1.0',
    'trade-orders.js?v=1.5',
    'trade-b07-order-lifecycle.js?v=1.0',
    'trade-b07-pickup-ui-fix-v2.js?v=2.1',
    'trade-offer-details.js?v=1.1',
    'trade-checkout.js?v=1.1',
    'trade-automation.js?v=2.0',
    'trade-shipping-profiles.js?v=1.1',
    'trade-order-resolution.js?v=1.1',
    'trade-marketplace-ux.js?v=1.1',
    'trade-b07-share.js?v=1.0',
    'trade-pickup-messages.js?v=1.0',
    'trade-search-archive.js?v=1.1'
  ];

  const setState=(state,environment,role=null)=>{
    window.DV_TRADE_RELEASE=Object.freeze({state,environment,role});
    document.documentElement.dataset.dvTradeRelease=state;
  };

  const addOwnerLink=()=>{
    const links=document.querySelector('.dv-global-nav .dv-nav-links');
    if(!links||links.querySelector('[href="control-center.html"]'))return;
    const a=document.createElement('a');
    a.href='control-center.html';
    a.textContent='CONTROL';
    const language=links.querySelector('.dv-nav-language');
    language?links.insertBefore(a,language):links.appendChild(a);
  };

  const loadTradeStack=async()=>{
    for(const src of TRADE_SCRIPTS){
      await new Promise((resolve,reject)=>{
        const script=document.createElement('script');
        script.src=src;
        script.async=false;
        script.dataset.dvTradeRuntime='1';
        script.onload=resolve;
        script.onerror=()=>reject(new Error(`trade_runtime_load_failed:${src}`));
        document.body.appendChild(script);
      });
    }
  };

  const showLocked=async(db,session,environment)=>{
    setState('locked',environment,'member');
    const app=document.getElementById('app');
    if(!app)throw new Error('trade_release_shell_missing');
    app.classList.remove('hidden');
    app.classList.add('trade-release-locked');
    if(!document.getElementById('tradeReleaseLockScreen')){
      const section=document.createElement('section');
      section.id='tradeReleaseLockScreen';
      section.className='trade-release-lock-screen';
      section.innerHTML='<div class="trade-release-lock-badge">TRADE · BETA</div><h1>COMING SOON 2027</h1><p>Der DUELVANTA Marktplatz wird noch vorbereitet. Kaufen, Verkaufen und Tauschen sind während der Beta noch nicht für normale Nutzer freigeschaltet.</p><div class="trade-release-lock-note">COLLECT und BATTLE bleiben weiterhin verfügbar.</div>';
      app.appendChild(section);
    }
    const logout=document.getElementById('logout');
    if(logout){
      logout.textContent=session?'Abmelden':'Anmelden';
      logout.onclick=async()=>{
        if(session)await db.auth.signOut();
        location.href='login.html';
      };
    }
  };

  const start=async()=>{
    const runtime=window.DV_SUPABASE;
    if(!runtime?.url||!runtime?.key||!window.supabase?.createClient)throw new Error('trade_release_runtime_missing');
    const db=window.supabase.createClient(runtime.url,runtime.key,{auth:{persistSession:true,autoRefreshToken:true}});
    const environment=runtime.environment||'development';

    if(environment!=='production'){
      setState('internal-preview',environment);
      await loadTradeStack();
      return;
    }

    const{data:{session}}=await db.auth.getSession();
    let role=null;
    if(session){
      const{data,error}=await db.from('profiles').select('role').eq('id',session.user.id).single();
      if(!error)role=data?.role||null;
    }

    if(role==='owner'){
      setState('owner-bypass',environment,role);
      addOwnerLink();
      await loadTradeStack();
      return;
    }

    await showLocked(db,session,environment);
  };

  start().catch(error=>{
    console.error('DUELVANTA TRADE release gate',error);
    const app=document.getElementById('app');
    if(app){
      app.classList.remove('hidden');
      app.classList.add('trade-release-locked');
      const section=document.createElement('section');
      section.className='trade-release-lock-screen';
      section.innerHTML='<div class="trade-release-lock-badge">TRADE</div><h1>Der Marktplatz ist derzeit nicht verfügbar.</h1><p>Bitte versuche es später erneut.</p>';
      app.appendChild(section);
    }
  });
})();
