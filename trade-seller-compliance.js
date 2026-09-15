(() => {
  'use strict';
  const cache = new Map();
  let loaded = false, unavailable = false, busy = false, lastSellerSignature = '';
  let knownSellerIds = new Set();
  let mySellerAccount = null, sellerGateAvailable = false;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

  const style = document.createElement('style');
  style.textContent = '.dvSellerClass{display:inline-flex;align-items:center;margin-top:7px;border:1px solid #3b424d;border-radius:999px;padding:5px 8px;color:#c2c8d0;background:#0b0e13;font-size:9px;letter-spacing:.06em}.dvSellerClass.private{color:#d8c28f;border-color:#5d4a2b}.dvSellerClass.trader{color:#91c99a;border-color:#315b3b;cursor:pointer}.dvSellerClass.pending{color:#b7bdc5}.dvLegalGrid{display:grid;grid-template-columns:1fr 1fr;gap:11px;margin-top:14px}.dvLegalItem{border:1px solid #2b313a;border-radius:10px;padding:10px;background:#0a0d12}.dvLegalItem span{display:block;color:#8e96a1;font-size:9px;text-transform:uppercase;margin-bottom:4px}.dvLegalItem strong,.dvLegalItem a{color:#f0e9de;font-size:13px;overflow-wrap:anywhere}.dvLegalNote,.dvSellerGateCopy{color:#9ba3ae;font-size:11px;line-height:1.55;margin-top:13px}.dvSellerGateAction{display:block;width:100%;margin-top:16px;text-align:center}@media(max-width:680px){.dvLegalGrid{grid-template-columns:1fr}}';
  document.head.appendChild(style);

  const dialog = document.createElement('dialog');
  dialog.id = 'dvSellerLegalDialog';
  dialog.innerHTML = '<div class="modal"><div class="modalHead"><h2>Anbieterangaben</h2><button class="close" type="button" aria-label="Anbieterangaben schließen">✕</button></div><div id="dvSellerLegalBody"></div></div>';
  document.body.appendChild(dialog);
  dialog.querySelector('.close').onclick = () => dialog.close();

  const gateDialog = document.createElement('dialog');
  gateDialog.id = 'dvSellerGateDialog';
  gateDialog.innerHTML = '<div class="modal"><div class="modalHead"><h2>Verkäuferkonto erforderlich</h2><button class="close" type="button" aria-label="Hinweis schließen">✕</button></div><div id="dvSellerGateBody"></div><a class="btn gold dvSellerGateAction" href="seller-onboarding.html">VERKÄUFERKONTO EINRICHTEN</a></div>';
  document.body.appendChild(gateDialog);
  gateDialog.querySelector('.close').onclick = () => gateDialog.close();

  function listingFor(card) {
    const button = card.querySelector('[data-offer],[data-edit],[data-pause],[data-finish],[data-renew]');
    const id = button?.dataset.offer || button?.dataset.edit || button?.dataset.pause || button?.dataset.finish || button?.dataset.renew;
    return typeof listings === 'undefined' ? null : listings.find(item => item.id === id);
  }

  function badge(disclosure) {
    if (disclosure?.seller_type === 'trader' && disclosure.onboarding_status === 'active') {
      return `<button class="dvSellerClass trader" type="button" data-dv-trader="${esc(disclosure.seller_id)}">GEWERBLICHER VERKÄUFER · ANGABEN</button>`;
    }
    if (disclosure?.seller_type === 'private' && disclosure.onboarding_status === 'active') {
      return '<span class="dvSellerClass private">PRIVATER VERKÄUFER</span>';
    }
    return '<span class="dvSellerClass pending">EINSTUFUNG AUSSTEHEND</span>';
  }

  function decorate() {
    if (!loaded) return;
    document.querySelectorAll('#grid .listing').forEach(card => {
      if (card.closest('.dvDealGrid') || card.dataset.dvSellerClassified) return;
      const listing = listingFor(card), seller = card.querySelector('.seller');
      if (!listing || !seller) return;
      if (!knownSellerIds.has(listing.seller_id)) return;
      card.dataset.dvSellerClassified = '1';
      const disclosure = cache.get(listing.seller_id) || null;
      seller.insertAdjacentHTML('beforeend', `<div>${badge(disclosure)}</div>`);
    });
  }

  async function load() {
    if (busy || unavailable || typeof db === 'undefined' || typeof listings === 'undefined') return;
    const sellerIds = [...new Set(listings.map(item => item.seller_id).filter(Boolean))].sort().slice(0,100);
    const signature = sellerIds.join('|');
    if (loaded && signature === lastSellerSignature) { decorate(); return; }
    if (!sellerIds.length) { knownSellerIds = new Set(); lastSellerSignature = ''; loaded = true; decorate(); return; }
    busy = true;
    const {data,error} = await db.rpc('get_market_seller_disclosures',{p_seller_ids:sellerIds});
    busy = false;
    if (error) { unavailable = true; return; }
    cache.clear();
    for (const item of data || []) if (item?.seller_id) cache.set(item.seller_id,item);
    knownSellerIds = new Set(sellerIds);
    lastSellerSignature = signature;
    loaded = true;
    decorate();
  }

  async function loadMySellerAccount() {
    if (typeof db === 'undefined') return;
    const {data,error} = await db.rpc('get_my_market_seller_onboarding');
    if (error) return;
    mySellerAccount = data || {seller_type:'unclassified',onboarding_status:'draft',onboarding_enforced:false};
    sellerGateAvailable = true;
  }

  function openSellerGate() {
    const state = mySellerAccount?.onboarding_status || 'draft';
    const copy = {
      pending_review:'Deine Grunddaten werden geprüft. Bis zur Freigabe können keine neuen oder pausierten Angebote aktiviert werden.',
      rejected:'Deine Angaben müssen überarbeitet werden. Öffne dein Verkäuferkonto und reiche sie danach erneut ein.',
      suspended:'Dein Verkäuferkonto ist gesperrt. Bitte wende dich an den DUELVANTA-Support.',
      legacy_beta:'Bitte stufe dich einmal als privater oder gewerblicher Verkäufer ein und vervollständige die erforderlichen Angaben.'
    }[state] || 'Bevor du ein Angebot veröffentlichen kannst, richte dein Verkäuferkonto einmal vollständig ein.';
    document.getElementById('dvSellerGateBody').innerHTML = `<div class="eyebrow">${esc(String(state).replaceAll('_',' '))}</div><div class="dvSellerGateCopy">${esc(copy)}</div>`;
    gateDialog.querySelector('.dvSellerGateAction').classList.toggle('hidden',state==='suspended');
    gateDialog.showModal();
  }

  function legalItem(label,value,link) {
    if (!value) return '';
    const content = link ? `<a href="${esc(link)}">${esc(value)}</a>` : `<strong>${esc(value)}</strong>`;
    return `<div class="dvLegalItem"><span>${esc(label)}</span>${content}</div>`;
  }

  function openTrader(id) {
    const item = cache.get(id);
    if (!item || item.seller_type !== 'trader' || item.onboarding_status !== 'active') return;
    const address = [item.street_line1,item.street_line2,item.postal_code,item.city,item.country_code].filter(Boolean).join(', ');
    const register = [item.register_name,item.register_number,item.register_court].filter(Boolean).join(' · ');
    document.getElementById('dvSellerLegalBody').innerHTML = `<div class="eyebrow">GEPRÜFTER GEWERBLICHER VERKÄUFER</div><div class="dvLegalGrid">${legalItem('Geschäftsbezeichnung',item.business_name)}${legalItem('Unternehmer',item.legal_name)}${legalItem('Rechtsform',item.legal_form)}${legalItem('Vertretung',item.representative_name)}${legalItem('Anschrift',address)}${legalItem('E-Mail',item.public_email,`mailto:${item.public_email}`)}${legalItem('Telefon',item.public_phone,`tel:${String(item.public_phone || '').replace(/[^0-9+]/g,'')}`)}${legalItem('Register',register)}</div><div class="dvLegalNote">Diese Angaben stammen aus dem geprüften Verkäuferkonto. Private Geburts-, Steuer- und Zahlungsdaten werden nicht veröffentlicht.</div>`;
    dialog.showModal();
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('[data-dv-trader]');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    openTrader(button.dataset.dvTrader);
  }, true);
  document.addEventListener('click', event => {
    if (!event.target.closest('#sell')) return;
    if (!sellerGateAvailable || !mySellerAccount?.onboarding_enforced || mySellerAccount.onboarding_status === 'active') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openSellerGate();
  }, true);
  new MutationObserver(() => { decorate(); load(); }).observe(document.getElementById('grid'),{childList:true,subtree:true});
  const timer = setInterval(() => {
    if (typeof user !== 'undefined' && user && typeof listings !== 'undefined') {
      clearInterval(timer);
      load();
      loadMySellerAccount();
    }
  },100);
  window.DV_TRADE_SELLER_COMPLIANCE = {version:'1.0',refresh:() => Promise.all([load(),loadMySellerAccount()])};
})();
