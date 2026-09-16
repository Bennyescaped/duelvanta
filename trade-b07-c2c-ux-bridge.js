/* B07 C2C UI integration bridge. Keeps swap actions/navigation intact after marketplace rewrites. */
(() => {
  'use strict';

  let installed=false,scheduled=false;
  const tradeCapable=listing=>['trade','sale_or_trade'].includes(listing?.listing_type);

  function listingFor(button){
    if(typeof listings==='undefined')return null;
    return listings.find(item=>item.id===button.dataset.offer)||null;
  }

  function decorateListings(){
    if(typeof listings==='undefined'||typeof user==='undefined'||!user)return;
    document.querySelectorAll('#grid [data-offer]').forEach(button=>{
      const listing=listingFor(button);
      if(!listing||listing.seller_id===user.id||!tradeCapable(listing)||listing.status!=='active')return;
      const actions=button.parentElement;
      if(!actions)return;

      if(listing.listing_type==='trade'){
        button.dataset.swapPropose=listing.id;
        delete button.dataset.offer;
        button.textContent='TAUSCH VORSCHLAGEN';
        button.classList.remove('gold');
        button.classList.add('ghost');
        return;
      }

      if(actions.querySelector(`[data-swap-propose="${CSS.escape(listing.id)}"]`))return;
      const swap=document.createElement('button');
      swap.type='button';
      swap.className='btn ghost';
      swap.dataset.swapPropose=listing.id;
      swap.textContent='TAUSCH VORSCHLAGEN';
      actions.appendChild(swap);
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

  function sync(){
    ensureSwapTab();
    if(typeof tab==='undefined'||tab!=='swaps')decorateListings();
  }

  function scheduleSync(){
    if(scheduled)return;
    scheduled=true;
    setTimeout(()=>{
      scheduled=false;
      sync();
    },0);
  }

  function install(){
    if(installed)return true;
    const grid=document.getElementById('grid'),tabs=document.querySelector('.tabs');
    if(!grid||!tabs||!window.DV_C2C_SWAP?.render)return false;
    installed=true;
    new MutationObserver(scheduleSync).observe(grid,{childList:true,subtree:true});
    new MutationObserver(scheduleSync).observe(tabs,{childList:true,subtree:true});
    tabs.addEventListener('click',event=>{
      if(event.target.closest('[data-tab],#dvSwapsTab'))setTimeout(scheduleSync,0);
    },true);
    document.getElementById('refresh')?.addEventListener('click',()=>setTimeout(scheduleSync,0));
    window.DV_B07_C2C_UX_BRIDGE={version:'1.1',sync};
    sync();
    return true;
  }

  let tries=0;
  const timer=setInterval(()=>{
    tries+=1;
    if(install()||tries>150)clearInterval(timer);
  },100);
})();
