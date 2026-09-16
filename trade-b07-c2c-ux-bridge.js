/* B07 C2C UI integration bridge. Keeps swap actions/navigation intact after marketplace UX rewrites. */
(() => {
  'use strict';

  let installed=false,syncing=false,scheduled=false;
  const tradeCapable=listing=>['trade','sale_or_trade'].includes(listing?.listing_type);

  function listingFor(button){
    if(typeof listings==='undefined')return null;
    return listings.find(item=>item.id===button.dataset.offer)||null;
  }

  function needsDecoration(){
    if(typeof listings==='undefined'||typeof user==='undefined'||!user)return false;
    return [...document.querySelectorAll('#grid [data-offer]')].some(button=>{
      const listing=listingFor(button);
      if(!listing||listing.seller_id===user.id||!tradeCapable(listing)||listing.status!=='active')return false;
      const actions=button.parentElement;
      const swap=actions?.querySelector(`[data-swap-propose="${CSS.escape(listing.id)}"]`);
      return !swap||listing.listing_type==='trade';
    });
  }

  function cleanTradeOnlyOfferButtons(){
    if(typeof listings==='undefined'||typeof user==='undefined'||!user)return;
    document.querySelectorAll('#grid [data-offer]').forEach(button=>{
      const listing=listingFor(button);
      if(!listing||listing.seller_id===user.id||listing.listing_type!=='trade'||listing.status!=='active')return;
      const swap=button.parentElement?.querySelector(`[data-swap-propose="${CSS.escape(listing.id)}"]`);
      if(swap)button.remove();
    });
  }

  function setSwapHero(){
    const hero=document.querySelector('.hero');
    if(!hero)return;
    const eyebrow=hero.querySelector('.eyebrow'),title=hero.querySelector('h1'),text=hero.querySelector('p');
    if(eyebrow)eyebrow.textContent='TRADE · TAUSCH';
    if(title)title.textContent='Karten direkt tauschen.';
    if(text)text.textContent='C2C-Tausch wird erst verbindlich, wenn beide Seiten exakt denselben finalen Stand bestätigen.';
  }

  function ensureSwapTab(){
    const tabs=document.querySelector('.tabs');
    if(!tabs)return null;
    let button=document.getElementById('dvSwapsTab');
    if(!button){
      button=document.createElement('button');
      button.id='dvSwapsTab';
      button.className='btn';
      button.textContent='TAUSCH';
      const secondary=tabs.querySelector('.dvTradeSecondary');
      if(secondary){
        const deals=secondary.querySelector('#dvDealsTab');
        secondary.insertBefore(button,deals||null);
      }else{
        const sell=document.getElementById('sell');
        sell?tabs.insertBefore(button,sell):tabs.appendChild(button);
      }
    }
    if(button.dataset.dvC2cBridge!=='1'){
      button.dataset.dvC2cBridge='1';
      button.onclick=()=>{
        if(typeof tab!=='undefined')tab='swaps';
        tabs.querySelectorAll('.btn').forEach(item=>item.classList.remove('active'));
        button.classList.add('active');
        window.DV_C2C_SWAP?.render?.();
        setSwapHero();
      };
    }
    return button;
  }

  async function syncMarket(){
    if(syncing||!window.DV_C2C_SWAP?.refresh)return;
    if(typeof tab!=='undefined'&&tab==='swaps')return;
    syncing=true;
    try{
      await window.DV_C2C_SWAP.refresh(false);
      cleanTradeOnlyOfferButtons();
    }catch(error){
      console.warn('B07 C2C UX bridge sync failed',error);
    }finally{
      syncing=false;
    }
  }

  function scheduleSync(){
    if(scheduled)return;
    scheduled=true;
    setTimeout(async()=>{
      scheduled=false;
      ensureSwapTab();
      if(needsDecoration())await syncMarket();
    },0);
  }

  function install(){
    if(installed)return true;
    const grid=document.getElementById('grid'),tabs=document.querySelector('.tabs');
    if(!grid||!tabs||!window.DV_C2C_SWAP?.refresh||!window.DV_TRADE_MARKETPLACE_UX)return false;
    installed=true;
    ensureSwapTab();
    new MutationObserver(scheduleSync).observe(grid,{childList:true,subtree:true});
    tabs.addEventListener('click',event=>{
      if(event.target.closest('[data-tab],#dvSwapsTab'))setTimeout(scheduleSync,0);
    },true);
    document.getElementById('refresh')?.addEventListener('click',()=>setTimeout(scheduleSync,0));
    window.DV_B07_C2C_UX_BRIDGE={version:'1.0',sync:syncMarket};
    syncMarket();
    return true;
  }

  let tries=0;
  const timer=setInterval(()=>{
    tries+=1;
    if(install()||tries>150)clearInterval(timer);
  },100);
})();
