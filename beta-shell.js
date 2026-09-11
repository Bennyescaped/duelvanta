(()=>{
  'use strict';
  const pathname=String(globalThis.location?.pathname||'app.html');
  const page=(pathname.split('/').pop()||'app.html').toLowerCase();
  const items=[
    ['app.html','H','Home'],
    ['collect.html','C','Collect'],
    ['trade.html','T','Trade'],
    ['battle.html','B','Battle'],
    ['profile.html','P','Profile']
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
  function start(){mountDock();mountRouteStrip()}
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',start,{once:true}):start();
})();
