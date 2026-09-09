/* Participant-only offer overview. Listing/price snapshots come from the server. */
(() => {
  'use strict';
  const labels = {pending:'OFFEN',accepted:'ANGENOMMEN',declined:'ABGELEHNT',withdrawn:'ZURÜCKGEZOGEN',expired:'ABGELAUFEN',cancelled:'STORNIERT'};
  const categories = {display:'Display',booster:'Booster',case:'Case',promo_pack:'Promo Pack',etb_collection:'ETB / Collection',deck:'Deck',tin:'Tin',box:'Box',other:'Sealed'};
  const style = document.createElement('style');
  style.textContent = '.dvOfferDetail{grid-column:1/-1}.dvOfferDetail .body{padding:18px}.dvOfferDetail h3{margin-bottom:8px}.dvOfferQuantity{color:#efd18c;font-size:15px;margin:10px 0}.dvOfferPrices{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:12px 0}.dvOfferPrices>div{border:1px solid #303640;border-radius:12px;padding:12px}.dvOfferPrices span,.dvOfferPrices small{display:block;color:#969eaa;font-size:11px}.dvOfferPrices strong{display:block;font:400 23px Georgia,serif;color:#f3eee4;margin:6px 0}.dvOfferDifference{border:1px solid #4a4230;border-radius:10px;padding:10px;color:#d8c28f;font-size:12px}.dvOfferDifference.lower{border-color:#764343;color:#efaaaa}.dvOfferDetail .actions{display:flex;flex-wrap:wrap}.dvOfferDetail .actions>*{flex:1}.dvOfferMessage{white-space:pre-wrap;overflow-wrap:anywhere;color:#aab0ba;margin:12px 0;font-size:12px}.dvOfferDetail .meta a{color:#efd18c}@media(max-width:520px){.dvOfferPrices{grid-template-columns:1fr}.dvOfferDetail .actions{display:grid}}';
  document.head.appendChild(style);
  renderOffers = async function () {
    const {data,error} = await db.rpc('get_my_market_offers_v2');
    if (tab !== 'offers') return;
    $('mineStats').classList.add('hidden');
    if (error) { $('grid').innerHTML = '<div class="empty">Angebote konnten nicht geladen werden. Bitte erneut versuchen.</div>'; return; }
    $('grid').innerHTML = (data || []).map(o => {
      const incoming = o.seller_id === user.id, snapshot = o.listing_snapshot || {}, qty = Number(o.requested_quantity || 1), amount = Number(o.amount || 0);
      const unit = amount / qty, reference = o.historical_price ? Number(o.listed_total_snapshot) : null;
      const delta = reference === null ? null : Math.round((amount-reference)*100)/100;
      const type = categories[snapshot.sealed_category] || (snapshot.product_kind === 'graded' ? 'Graded Card' : 'Karte');
      const person = o.other_username ? `<a href="/u/${encodeURIComponent(o.other_username)}">${esc(o.other_name || o.other_username)} · @${esc(o.other_username)}</a>` : esc(o.other_name || 'DUELVANTA Member');
      let actions = '';
      if (o.status === 'pending') actions = incoming
        ? `<button class="btn gold" data-accept-offer="${o.id}">ANGEBOT ANNEHMEN</button><button class="btn danger" data-decline-offer="${o.id}">ABLEHNEN</button>`
        : `<button class="btn ghost" data-withdraw-offer="${o.id}">ZURÜCKZIEHEN</button>`;
      if (o.order_id) actions = `<button class="btn gold" data-go-order="${o.order_id}">ORDER ${esc(o.order_number || 'ÖFFNEN')}</button>`;
      let comparison = '<div class="msg">Bei diesem älteren Angebot wurde kein damaliger Inseratspreis gespeichert. Ein verlässlicher Rabattvergleich ist deshalb nicht möglich.</div>';
      if (delta !== null) comparison = `<div class="dvOfferDifference ${delta<0?'lower':''}">${delta === 0 ? 'ENTSPRICHT DEM MENGENPREIS · KEIN ZUSÄTZLICHER NACHLASS' : `${delta<0?'PREISVORSCHLAG UNTER INSERATSPREIS':'ÜBER INSERATSPREIS'}: ${money(Math.abs(delta))}${reference>0?` · ${Math.abs(delta/reference*100).toFixed(1).replace('.',',')} %`:''}`}</div>`;
      return `<article class="listing dvOfferDetail"><div class="body"><div class="eyebrow">${incoming?'EINGEGANGEN':'GESENDET'} · ${esc(labels[o.status] || o.status)}</div><h3>${esc(snapshot.card_name || 'Produkt')}</h3><div class="meta">${incoming?'Käufer':'Verkäufer'}: ${person}<br>${esc([snapshot.set_name,snapshot.language].filter(Boolean).join(' · '))}</div><div class="dvOfferQuantity"><b>${qty} × ${esc(type)}</b></div><div class="dvOfferPrices"><div><span>Inseratspreis für diese Menge</span><strong>${reference===null?'Nicht gespeichert':money(reference)}</strong><small>${reference===null?'':`${qty} × ${money(o.listed_unit_price_snapshot)} · Mengenrabatt berücksichtigt`}</small></div><div><span>${incoming?'Gebotener Produktgesamtpreis':'Dein Produktgesamtpreis'}</span><strong>${money(amount)}</strong><small>${qty} Stück · ${amount*100%qty===0?'':'Ø '}${money(unit)} pro Stück</small></div></div>${comparison}<div class="msg">${o.status==='cancelled'?'Die zugehörige Order wurde storniert.':'Versand separat über die Order.'}${snapshot.shipping_cost!=null?` Laut Anzeige: ${money(snapshot.shipping_cost)}.`:''}</div><div class="dvOfferMessage">${esc(o.message || 'Keine Nachricht')}</div><div class="actions">${actions}</div></div></article>`;
    }).join('') || '<div class="empty">Noch keine Preisangebote.</div>';
  };
})();
