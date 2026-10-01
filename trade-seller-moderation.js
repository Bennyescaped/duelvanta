(() => {
  'use strict';
  const grid=document.getElementById('grid');if(!grid)return;
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const panel=document.createElement('section');panel.id='dvModerationCases';panel.className='dvModerationCases';panel.hidden=true;grid.before(panel);
  let loaded=false,cases=[];
  async function sync(){
    const mine=typeof tab!=='undefined'&&tab==='mine';panel.hidden=!mine;if(!mine||loaded||typeof db==='undefined'||typeof user==='undefined'||!user)return;
    loaded=true;const {data,error}=await db.rpc('get_my_marketplace_moderation_cases');if(error){panel.hidden=true;return}cases=data||[];render();
  }
  function render(){
    const relevant=cases.filter(item=>['restrict_visibility','remove_listing'].includes(item.action));
    if(!relevant.length){panel.hidden=true;return}
    panel.innerHTML=relevant.map(item=>{const open=(item.appeals||[]).some(appeal=>['submitted','under_review'].includes(appeal.status));return `<article class="dvModerationCase" data-notice="${esc(item.notice_id)}"><div class="eyebrow">MODERATIONSENTSCHEIDUNG · ${esc(item.case_reference)}</div><h3>${esc(item.listing_title||'Inserat')}</h3><p>${esc(item.reason||'')}</p>${item.reference?`<p>Grundlage: ${esc(item.reference)}</p>`:''}<p>Umfang: ${esc(item.scope||'—')} · Dauer: ${esc(item.duration||'—')} · automatisiert: ${item.automated_means_used?'Ja':'Nein'}</p>${open?'<b>Einspruch wird durch eine Person geprüft.</b>':`<label>Begründung des Einspruchs<textarea data-grounds minlength="30" maxlength="5000" rows="4"></textarea></label><button class="btn ghost" data-seller-appeal type="button">EINSPRUCH EINLEGEN</button><p class="msg" data-result></p>`}</article>`}).join('');panel.hidden=false;panel.querySelectorAll('[data-seller-appeal]').forEach(button=>button.onclick=()=>appeal(button));
  }
  async function appeal(button){const box=button.closest('[data-notice]'),grounds=box.querySelector('[data-grounds]').value.trim(),result=box.querySelector('[data-result]');if(grounds.length<30){result.textContent='Bitte mindestens 30 Zeichen eintragen.';return}button.disabled=true;const {error}=await db.rpc('submit_my_marketplace_moderation_appeal',{p_notice_id:box.dataset.notice,p_grounds:grounds});if(error){result.textContent=error.message;button.disabled=false;return}loaded=false;await sync()}
  document.addEventListener('click',event=>{if(event.target.closest('[data-tab="mine"],.dvTradePrimary,.dvTradeSecondary'))setTimeout(sync,0)});new MutationObserver(sync).observe(grid,{childList:true});sync();
})();
