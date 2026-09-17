(()=>{
  'use strict';
  let installed=false, actions=[], notifications=[], busy=false;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const cash=v=>typeof money==='function'?money(Number(v||0)):new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(Number(v||0));
  const stamp=v=>{if(!v)return '';const d=new Date(v),same=d.toDateString()===new Date().toDateString();return new Intl.DateTimeFormat('de-DE',same?{hour:'2-digit',minute:'2-digit'}:{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(d)};

  function mount(){
    if(document.getElementById('dvTradeAutomation'))return;
    const tabs=document.querySelector('.tabs');
    if(!tabs)return;
    const panel=document.createElement('section');
    panel.id='dvTradeAutomation';
    panel.className='dvAutomation';
    panel.innerHTML='<div class="dvAutomationHead"><div><div class="eyebrow">TRADE CONTROL · LIVE STATUS</div><div class="dvAutomationTitle">AKTION ERFORDERLICH <span id="dvActionCount" class="dvAutomationCount">0</span></div></div><button id="dvNotifyBtn" class="btn ghost" type="button">BENACHRICHTIGUNGEN <span id="dvNotifyBadge" class="dvNotifyBadge" hidden>0</span></button></div><div id="dvActionList" class="dvActionList"></div>';
    tabs.insertAdjacentElement('afterend',panel);

    const dialog=document.createElement('dialog');
    dialog.id='dvNotifyDialog';
    dialog.className='dvNotifyDialog';
    dialog.innerHTML='<div class="modal"><div class="modalHead"><h2>Benachrichtigungen</h2><button id="dvNotifyClose" class="close" type="button">✕</button></div><div class="dvNotifyTools"><span class="dvNotifyHint">Kauf · Angebot · Chat · Versand · Erhalt · Probleme</span><button id="dvNotifyReadAll" class="btn ghost" type="button">ALLE GELESEN</button></div><div id="dvNotifyList" class="dvNotifyList"></div><div id="dvNotifyMsg" class="msg"></div></div>';
    document.body.appendChild(dialog);
  }

  function renderActions(){
    const host=document.getElementById('dvActionList'), count=document.getElementById('dvActionCount');
    if(!host||!count)return;
    count.textContent=String(actions.length);
    if(!actions.length){host.innerHTML='<div class="dvActionEmpty">Aktuell ist im TRADE-Bereich nichts von dir erforderlich.</div>';return}
    host.innerHTML=actions.slice(0,6).map(a=>`<article class="dvAction"><div><div class="dvActionTitle">${esc(a.title)}</div><div class="dvActionSubject">${esc(a.subject||'DUELVANTA')}</div><div class="dvActionMeta">${a.quantity?`${Number(a.quantity)} Stück · `:''}${a.amount!=null?cash(a.amount):''}</div></div><button class="btn gold dvActionOpen" data-dv-action="${esc(a.action_key)}" type="button">ÖFFNEN</button></article>`).join('')+(actions.length>6?`<div class="dvActionEmpty">+ ${actions.length-6} weitere offene Aktionen</div>`:'');
  }

  function renderNotifications(){
    const host=document.getElementById('dvNotifyList'), badge=document.getElementById('dvNotifyBadge');
    if(!host||!badge)return;
    const unread=notifications.filter(n=>n.is_unread).length;
    badge.hidden=!unread;badge.textContent=String(unread);
    host.innerHTML=notifications.length?notifications.map(n=>`<article class="dvNotifyRow ${n.is_unread?'unread':''}" data-dv-note="${n.notification_id}"><div class="dvNotifyTop"><span class="dvNotifyTitle">${esc(n.title)}</span><span class="dvNotifyTime">${esc(stamp(n.created_at))}</span></div><div class="dvNotifyBody">${esc(n.body)}</div></article>`).join(''):'<div class="empty">Noch keine Benachrichtigungen.</div>';
  }

  const isSwap=item=>/swap/.test(String(item?.context_type||'')+' '+String(item?.action_type||'')+' '+String(item?.kind||'')+' '+String(item?.action_key||''));

  async function refresh(){
    if(busy)return;
    busy=true;
    try{
      try{
        const sync=await db.rpc('sync_my_trade_notifications_v2');
        if(sync?.error&&!/Could not find the function|schema cache/i.test(sync.error.message||''))console.warn('TRADE notification sync',sync.error);
      }catch(error){console.warn('TRADE notification sync unavailable',error)}
      const [a,n]=await Promise.all([
        db.rpc('get_my_trade_actions'),
        db.rpc('get_my_market_notifications',{p_limit:60})
      ]);
      if(a.error)throw a.error;if(n.error)throw n.error;
      actions=(a.data||[]).filter(item=>!isSwap(item)).sort((x,y)=>(Number(x.priority||99)-Number(y.priority||99))||(new Date(y.created_at||0)-new Date(x.created_at||0)));
      notifications=(n.data||[]).filter(item=>!isSwap(item));
      renderActions();renderNotifications();
    }catch(error){
      console.warn('DUELVANTA TRADE automation',error);
      const host=document.getElementById('dvActionList');
      if(host&&!host.children.length)host.innerHTML='<div class="dvActionEmpty">TRADE Status konnte nicht geladen werden. Bitte aktualisieren.</div>';
    }finally{busy=false}
  }

  function openOrder(id){
    if(id&&window.DV_TRADE_ORDERS?.open)return window.DV_TRADE_ORDERS.open(id);
    document.getElementById('dvOrdersTab')?.click();
  }
  function openOffer(){document.querySelector('[data-tab="offers"]')?.click()}
  function openPickup(type,id){
    if(type&&id&&window.DV_PICKUP_MESSAGES?.open)return window.DV_PICKUP_MESSAGES.open(type,id);
    document.getElementById('dvPickupMessagesTab')?.click();
  }
  function route(item){
    if(isSwap(item))return;
    if(item?.order_id)return openOrder(item.order_id);
    if(item?.offer_id)return openOffer();
    if(item?.context_type==='pickup_order')return openPickup('order',item.context_id);
    const key=String(item?.action_key||'');
  }

  async function openNotification(item){
    if(!item)return;
    if(item.is_unread){
      const {error}=await db.rpc('mark_market_notification_read',{p_notification_id:item.notification_id});
      if(!error)item.is_unread=false;
    }
    renderNotifications();
    document.getElementById('dvNotifyDialog')?.close();
    route(item);
  }

  function bind(){
    document.getElementById('dvNotifyBtn').onclick=async()=>{await refresh();document.getElementById('dvNotifyDialog').showModal()};
    document.getElementById('dvNotifyClose').onclick=()=>document.getElementById('dvNotifyDialog').close();
    document.getElementById('dvNotifyReadAll').onclick=async()=>{
      const {error}=await db.rpc('mark_all_market_notifications_read');
      if(error){document.getElementById('dvNotifyMsg').textContent=error.message;return}
      notifications.forEach(n=>n.is_unread=false);renderNotifications();
    };
    document.getElementById('dvTradeAutomation').addEventListener('click',e=>{
      const button=e.target.closest('[data-dv-action]');
      if(button)route(actions.find(a=>a.action_key===button.dataset.dvAction));
    });
    document.getElementById('dvNotifyList').addEventListener('click',e=>{
      const row=e.target.closest('[data-dv-note]');
      if(row)openNotification(notifications.find(n=>n.notification_id===row.dataset.dvNote));
    });
    window.addEventListener('focus',refresh);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
  }

  function install(){
    if(installed)return true;
    if(typeof db==='undefined'||typeof user==='undefined'||!user||!document.querySelector('.tabs'))return false;
    installed=true;mount();bind();refresh();
    setInterval(()=>{if(!document.hidden)refresh()},30000);
    window.DV_TRADE_AUTOMATION={version:'2.0',refresh,get actions(){return actions},get notifications(){return notifications}};
    return true;
  }

  let tries=0;
  const timer=setInterval(()=>{tries++;if(install()||tries>120)clearInterval(timer)},100);
})();
