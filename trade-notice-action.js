(() => {
  'use strict';
  const grid=document.getElementById('grid');
  if(!grid)return;
  function addReportLinks(){
    if(typeof listings==='undefined'||typeof user==='undefined'||!user||typeof tab!=='undefined'&&tab!=='market')return;
    const active=typeof listings==='undefined'?[]:listings.filter(item=>item.status==='active');
    grid.querySelectorAll('.listing').forEach((card,index)=>{
      if(card.querySelector('.dvReportListing'))return;
      const listingId=card.querySelector('[data-offer]')?.dataset.offer;
      const listing=listingId?listings.find(item=>item.id===listingId):active[index];
      if(!listing||listing.seller_id===user.id)return;
      const actions=card.querySelector('.actions');if(!actions)return;
      const button=document.createElement('button');button.type='button';button.className='dvReportListing';button.textContent='Angebot melden';
      button.setAttribute('aria-label',`${listing.card_name||'Angebot'} melden`);
      button.onclick=()=>location.href=`listing-report.html?listing=${encodeURIComponent(listing.id)}`;
      actions.appendChild(button);
    });
  }
  new MutationObserver(addReportLinks).observe(grid,{childList:true,subtree:true});addReportLinks();
})();
