/* B07 Release-1 owner delivery verification. Manual carrier check; no paid tracking API required. */
(() => {
  'use strict';
  const $=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let rows=[];
  const fmt=d=>d?new Date(d).toLocaleString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}):'—';
  const localInput=d=>{const x=d?new Date(d):new Date();const z=n=>String(n).padStart(2,'0');return `${x.getFullYear()}-${z(x.getMonth()+1)}-${z(x.getDate())}T${z(x.getHours())}:${z(x.getMinutes())}`};

  function install(){
    const side=document.querySelector('aside .nav'),mobile=document.querySelector('.mobileNav'),anchor=$('sellerReviewPanel')||$('scannerPanel');
    if(!side||!mobile||!anchor||typeof db==='undefined')return setTimeout(install,100);
    for(const nav of [side,mobile]){const b=document.createElement('button');b.type='button';b.dataset.deliveryAdmin='true';b.textContent='Zustellprüfung';b.onclick=show;nav.appendChild(b)}
    const panel=document.createElement('section');panel.id='deliveryReviewPanel';panel.className='hidden';
    panel.innerHTML='<div class="sellerReviewToolbar"><div><div class="eyebrow">VERSAND · OWNER ONLY</div><p class="lead">Getrackte Zustellungen manuell beim offiziellen Versanddienst prüfen. Erst eine bestätigte Zustellung startet die 72-Stunden-Frist.</p></div><select id="deliveryReviewFilter"><option value="pending">Offene Prüfungen</option><option value="">Alle</option><option value="verified">Verifiziert</option><option value="rejected">Abgelehnt</option></select></div><div id="deliveryReviewQueue" class="sellerReviewQueue"><div class="empty">Zustellprüfungen werden geladen.</div></div>';
    anchor.insertAdjacentElement('afterend',panel);$('deliveryReviewFilter').onchange=load;
    document.querySelectorAll('[data-admin-view],[data-seller-admin]').forEach(b=>b.addEventListener('click',()=>panel.classList.add('hidden')));
    document.addEventListener('click',e=>{if(e.target.closest('[data-notice-admin]'))panel.classList.add('hidden')});
  }

  async function show(event){
    event?.preventDefault();currentView='delivery';
    document.querySelectorAll('[data-admin-view],[data-notice-admin],[data-seller-admin],[data-delivery-admin]').forEach(b=>b.classList.toggle('active',b.dataset.deliveryAdmin==='true'));
    $('betaPanel')?.classList.add('hidden');$('betaTablePanel')?.classList.add('hidden');$('scannerPanel')?.classList.add('hidden');$('noticePanel')?.classList.add('hidden');$('sellerReviewPanel')?.classList.add('hidden');$('deliveryReviewPanel').classList.remove('hidden');
    $('pageTitle').textContent='Zustellprüfung';$('pageLead').textContent='Trackingnachweis prüfen und die 72-Stunden-Frist ausschließlich nach bestätigter Zustellung starten.';
    await load();
  }

  async function load(){
    const queue=$('deliveryReviewQueue');queue.innerHTML='<div class="empty">Zustellprüfungen werden geladen.</div>';
    const {data,error}=await db.rpc('get_owner_market_delivery_reviews_b07',{p_status:$('deliveryReviewFilter').value||null});
    if(error){queue.innerHTML=`<div class="empty">${esc(error.message||'Kein Zugriff oder B07-Versandprüfung noch nicht aktiviert.')}</div>`;return}
    rows=Array.isArray(data)?data:[];render();
  }

  function render(){
    const queue=$('deliveryReviewQueue');if(!rows.length){queue.innerHTML='<div class="empty">Keine passenden Zustellprüfungen.</div>';return}
    queue.innerHTML=rows.map(r=>{
      const pending=r.review_status==='pending';
      return `<article class="sellerReviewCard" data-order="${esc(r.order_id)}"><div class="eyebrow">${esc(r.review_status||'not_requested')} · ${esc(r.carrier||'Versanddienst')}</div><h2>${esc(r.order_number||r.order_id)}</h2><div class="sellerReviewMeta">Versandt: ${fmt(r.shipped_at)} · Anfrage: ${fmt(r.requested_at)}</div><div class="sellerReviewGrid"><div><span>Versanddienst</span>${esc(r.carrier||'—')}</div><div><span>Trackingnummer</span><code>${esc(r.tracking_code||'—')}</code></div><div><span>Zustellung verifiziert</span>${fmt(r.delivery_evidence_at)}</div><div><span>Technischer Abschluss ab</span>${fmt(r.closure_eligible_at)}</div></div>${pending?`<div class="sellerReviewActions"><label>Zustellzeitpunkt laut offizieller Sendungsverfolgung</label><input data-delivered type="datetime-local" value="${localInput()}" max="${localInput()}"><input data-reference maxlength="160" placeholder="Referenz optional, z. B. DHL-Status / Prüfnachweis"><textarea data-note maxlength="1000" placeholder="Prüfnotiz; bei Ablehnung erforderlich"></textarea><button class="btn gold" data-delivery-decision="verify" type="button">ZUSTELLUNG VERIFIZIEREN</button><button class="btn danger" data-delivery-decision="reject" type="button">NICHT BESTÄTIGEN</button><p class="sellerReviewResult" aria-live="polite"></p></div>`:`<div class="sellerReviewTax ${r.review_status==='verified'?'good':''}">Geprüft: ${fmt(r.reviewed_at)}${r.review_note?' · '+esc(r.review_note):''}</div>`}</article>`
    }).join('');
    queue.querySelectorAll('[data-delivery-decision]').forEach(b=>b.onclick=()=>decide(b));
  }

  async function decide(button){
    const card=button.closest('[data-order]'),decision=button.dataset.deliveryDecision,note=card.querySelector('[data-note]')?.value.trim()||'',result=card.querySelector('.sellerReviewResult');
    if(decision==='reject'&&!note){result.textContent='Bei Ablehnung ist eine Begründung erforderlich.';result.className='sellerReviewResult error';return}
    const delivered=card.querySelector('[data-delivered]')?.value;
    if(decision==='verify'&&!delivered){result.textContent='Zustellzeitpunkt ist erforderlich.';result.className='sellerReviewResult error';return}
    if(!confirm(decision==='verify'?'Zustellung wirklich anhand der offiziellen Sendungsverfolgung geprüft? Ab diesem Zeitpunkt laufen 72 Stunden.':'Zustellprüfung ablehnen?'))return;
    card.querySelectorAll('button,input,textarea').forEach(el=>el.disabled=true);
    const {error}=await db.rpc('review_market_order_delivery_b07',{p_order_id:card.dataset.order,p_decision:decision,p_delivered_at:decision==='verify'?new Date(delivered).toISOString():null,p_reference:card.querySelector('[data-reference]')?.value.trim()||null,p_note:note||null});
    if(error){result.textContent=error.message;result.className='sellerReviewResult error';card.querySelectorAll('button,input,textarea').forEach(el=>el.disabled=false);return}
    await load();
  }

  window.DV_ADMIN_LOAD_DELIVERY_REVIEWS=load;install();
})();
