(()=>{
  'use strict';
  const pathname=String(globalThis.location?.pathname||'app.html');
  const page=(pathname.split('/').pop()||'app.html').toLowerCase();
  const items=[
    ['app.html','⌂','Home'],
    ['collect.html','▤','Collect'],
    ['trade.html','⇄','Trade'],
    ['battle.html','◇','Battle'],
    ['profile.html','○','Profile']
  ];
  function mountDock(){
    if(document.querySelector('.beta-mobile-dock'))return;
    const nav=document.createElement('nav');
    nav.className='beta-mobile-dock';
    nav.setAttribute('aria-label','DUELVANTA App Navigation');
    nav.innerHTML=items.map(([href,symbol,label])=>`<a href="${href}" class="${page===href?'active':''}"><span class="dock-icon">${symbol}</span><span>${label}</span></a>`).join('');
    document.body.appendChild(nav);
  }
  function mountRouteStrip(){
    if(page==='profile.html'||document.querySelector('.beta-route-strip'))return;
    const hero=document.querySelector('.beta-page-hero');
    if(!hero)return;
    const strip=document.createElement('nav');
    strip.className='beta-route-strip';
    strip.setAttribute('aria-label','Plattformbereiche');
    strip.innerHTML=items.map(([href,symbol,label])=>`<a href="${href}" class="${page===href?'active':''}"><span class="beta-route-symbol">${symbol}</span><span>${label}</span></a>`).join('');
    hero.insertAdjacentElement('afterend',strip);
  }
  function bindTileActions(){
    document.addEventListener('click',e=>{
      const tile=e.target.closest?.('[data-beta-action]');if(!tile)return;
      const action=tile.dataset.betaAction;
      const map={market:'[data-tab="market"]',mine:'[data-tab="mine"]',offers:'[data-tab="offers"]',sell:'#sell','create-match':'#createMatch'};
      const target=map[action]?document.querySelector(map[action]):null;
      if(target){e.preventDefault();target.click();target.scrollIntoView?.({behavior:'smooth',block:'center'});return}
      if(action==='lobby'){e.preventDefault();document.getElementById('lobbyView')?.scrollIntoView?.({behavior:'smooth',block:'start'})}
    });
  }
  function start(){mountDock();mountRouteStrip();bindTileActions()}
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',start,{once:true}):start();
})();
