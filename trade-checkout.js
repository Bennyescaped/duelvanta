/* Checkout V1: reuses the existing page client; never creates an auth client. */
(() => {
  'use strict';
  const byId = id => document.getElementById(id);
  const methods = {standard_letter:'Standardbrief',tracked_letter:'Brief mit Tracking',parcel:'Paket mit Tracking',pickup:'Abholung',custom:'Nach Absprache'};
  let current = null, busy = false, installed = false, retry = null;
  const cash = n => money(n);
  function priceFor(listing, quantity) {
    let price = Number(listing.asking_price || 0);
    for (const tier of [...(listing.quantity_pricing || [])].sort((a,b) => a.min_quantity-b.min_quantity)) {
      if (quantity >= Number(tier.min_quantity)) price = Number(tier.unit_price);
    }
    return price;
  }
  function fixed(l) { return l?.pricing_mode === 'fixed' && l.listing_type !== 'trade'; }
  function decorate() {
    if (!['market','mine'].includes(tab)) return;
    byId('grid').querySelectorAll('.listing').forEach(card => {
      const button = card.querySelector('[data-offer],[data-edit]');
      const listing = listings.find(l => l.id === (button?.dataset.offer || button?.dataset.edit));
      if (!listing || card.querySelector('.dvPriceMode') || listing.listing_type === 'trade') return;
      card.querySelector('.priceRow')?.insertAdjacentHTML('afterend', `<div class="dvPriceMode">${fixed(listing)?'FESTPREIS':'VERHANDLUNGSBASIS'}</div>`);
      if (button.dataset.offer) button.textContent = fixed(listing) ? 'JETZT KAUFEN' : 'PREIS VORSCHLAGEN';
    });
  }
  function selectedQuantity() {
    return current.product_kind === 'sealed' ? Number(byId('dvBuyQty').value) : 1;
  }
  function refresh() {
    const quantity = selectedQuantity(), min = current.product_kind === 'sealed' ? current.minimum_purchase_quantity : 1;
    const valid = Number.isInteger(quantity) && quantity >= min && quantity <= current.quantity_available;
    byId('dvBuyNow').disabled = busy || !valid;
    if (byId('dvBuyMinus')) byId('dvBuyMinus').disabled = busy || !valid || quantity <= min;
    if (byId('dvBuyPlus')) byId('dvBuyPlus').disabled = busy || !valid || quantity >= current.quantity_available;
    byId('dvBuyQtyHint').textContent = valid ? `${current.quantity_available} verfügbar` : `Bitte eine ganze Menge zwischen ${min} und ${current.quantity_available} eingeben.`;
    if (!valid) { byId('dvBuyTotals').textContent = 'Bitte Menge eingeben.'; return; }
    const unit = priceFor(current,quantity), amount = Math.round(unit*quantity*100)/100, shipping = Number(current.shipping_cost);
    byId('dvBuyTotals').innerHTML = `<div><span>${quantity} × Stückpreis</span><strong>${cash(unit)}</strong></div><div><span>Artikel</span><strong>${cash(amount)}</strong></div><div><span>Versand laut Inserat</span><strong>${cash(shipping)}</strong></div><div class="grand"><span>SUMME VORLÄUFIG</span><strong>${cash(amount+shipping)}</strong></div>`;
  }
  function open(listing) {
    if (busy) return;
    current = {...listing};
    retry = null;
    byId('dvBuyMsg').textContent = '';
    byId('dvBuyBody').innerHTML = `<div class="summary"><b>${esc(listing.card_name)}</b><div class="msg">${esc([listing.set_name,listing.language,methods[listing.shipping_method]].filter(Boolean).join(' · '))}</div></div><div class="field" ${listing.product_kind==='sealed'?'':'hidden'}><label for="dvBuyQty">Menge</label><div class="dvQuantityPicker"><button id="dvBuyMinus" class="btn ghost" type="button" aria-label="Menge verringern">−</button><input id="dvBuyQty" type="number" inputmode="numeric" min="${listing.minimum_purchase_quantity}" max="${listing.quantity_available}" step="1" value="${listing.product_kind==='sealed'?listing.minimum_purchase_quantity:1}" aria-label="Gewünschte Menge"><button id="dvBuyPlus" class="btn ghost" type="button" aria-label="Menge erhöhen">+</button></div></div><div id="dvBuyQtyHint" class="msg"></div><div id="dvBuyTotals" class="dvBuyTotals"></div><div class="dvCheckoutBeta"><strong>BETA</strong><span>Die Bestellung wird sofort angelegt. Noch keine Onlinezahlung. Der Versand kann sich durch Combined Shipping anschließend ändern.</span></div><button id="dvBuyNow" class="btn gold" type="button">JETZT BESTELLEN</button>`;
    byId('dvBuyQty').addEventListener('input', refresh); // Empty is a valid editing state on iOS.
    byId('dvBuyMinus').onclick = () => changeQuantity(-1);
    byId('dvBuyPlus').onclick = () => changeQuantity(1);
    byId('dvBuyNow').onclick = buy;
    refresh();
    byId('dvBuyDialog').showModal();
  }
  function changeQuantity(delta) {
    if (busy || !current || current.product_kind !== 'sealed') return;
    const input = byId('dvBuyQty'), min = Number(current.minimum_purchase_quantity || 1), max = Number(current.quantity_available || min);
    const value = Number.isInteger(Number(input.value)) ? Number(input.value) : min;
    input.value = String(Math.max(min,Math.min(max,value+delta)));
    input.dispatchEvent(new Event('input',{bubbles:true}));
  }
  function purchaseRequest(quantity) {
    const key = `dv-checkout:${user.id}:${current.id}`;
    const signature = `${current.updated_at}:${quantity}`;
    let saved = null;
    try { saved = JSON.parse(sessionStorage.getItem(key)); } catch (_) {}
    if (!saved || saved.signature !== signature) saved = {signature,id:crypto.randomUUID()};
    try { sessionStorage.setItem(key, JSON.stringify(saved)); } catch (_) {}
    if (retry?.signature === signature) saved = retry;
    retry = {...saved,key};
    return retry;
  }
  async function buy() {
    if (busy || !current || byId('dvBuyNow').disabled) return;
    const listing = current, quantity = selectedQuantity(), request = purchaseRequest(quantity);
    busy = true;
    byId('dvBuyNow').disabled = true;
    byId('dvBuyMinus').disabled = true;
    byId('dvBuyPlus').disabled = true;
    byId('dvBuyMsg').textContent = 'Bestellung wird angelegt …';
    byId('dvBuyQty').disabled = true;
    let result;
    try {
      const response = await db.rpc('buy_market_listing_v2', {p_listing_id:listing.id,p_quantity:quantity,p_request_id:request.id,p_expected_updated_at:listing.updated_at});
      if (response.error) throw response.error;
      result = response.data;
    } catch (error) {
      byId('dvBuyMsg').textContent = error.message || 'Keine Bestätigung erhalten. Du kannst dieselbe Anfrage sicher wiederholen.';
      busy = false;
      byId('dvBuyQty').disabled = false;
      refresh();
      return;
    }
    busy = false;
    try { sessionStorage.removeItem(request.key); } catch (_) {}
    retry = null;
    byId('dvBuyMsg').textContent = '';
    byId('dvBuyBody').innerHTML = `<div class="dvCheckoutSuccess"><div class="dvCheckoutSuccessMark">✓</div><b>BESTELLUNG ANGELEGT</b><p>${quantity} × ${esc(listing.card_name)}</p><p>Artikel: ${cash(result.item_total)}</p><div class="msg">Adresse, Versand und den nächsten Schritt findest du jetzt unter Bestellungen. Es wurde keine Zahlung ausgeführt.</div></div><div class="actions"><button id="dvBuyGoOrder" class="btn gold">BESTELLUNG ÖFFNEN</button><button id="dvBuyContinue" class="btn ghost">WEITER EINKAUFEN</button></div>`;
    byId('dvBuyContinue').onclick = () => byId('dvBuyDialog').close();
    byId('dvBuyGoOrder').onclick = () => { byId('dvBuyDialog').close(); window.DV_TRADE_ORDERS.open(result.order_id); };
    // A refresh failure must not present an already successful purchase as failed.
    try { await loadListings(); } catch (error) { console.warn('Checkout refresh',error); }
  }
  function install() {
    if (installed) return true;
    if (typeof user==='undefined' || !user || !window.DV_TRADE_SEALED || !window.DV_TRADE_ORDERS) return false;
    installed = true;
    const style = document.createElement('style');
    style.textContent = '.dvPriceMode{margin:8px 0;color:#d8c28f;font-size:10px;letter-spacing:.08em}.dvBuyTotals{border:1px solid #303640;border-radius:12px;padding:12px;margin:12px 0}.dvBuyTotals>div{display:flex;justify-content:space-between;gap:12px;padding:6px 0;color:#a0a8b3;font-size:12px}.dvBuyTotals strong{color:#eee7dc}.dvBuyTotals .grand{border-top:1px solid #303640;margin-top:7px}.dvCheckoutNote{color:#9ba2ad;font-size:11px;line-height:1.6;margin:12px 0}#dvBuyNow{width:100%;margin-top:12px}#dvBuyQty{width:100%;box-sizing:border-box}#dvBuyMsg{overflow-wrap:anywhere}';
    document.head.appendChild(style);
    const dialog = document.createElement('dialog');
    dialog.id = 'dvBuyDialog';
    dialog.innerHTML = '<div class="modal"><div class="modalHead"><h2>Kauf prüfen</h2><button id="dvBuyClose" type="button" class="close" aria-label="Kaufdialog schließen">✕</button></div><div id="dvBuyBody"></div><div id="dvBuyMsg" class="msg" aria-live="polite"></div></div>';
    document.body.appendChild(dialog);
    byId('dvBuyClose').onclick = () => { if (!busy) dialog.close(); };
    dialog.addEventListener('cancel',e => { if (busy) e.preventDefault(); });
    document.addEventListener('click',e => {
      const button = e.target.closest('[data-offer]');
      if (!button) return;
      const listing = listings.find(l => l.id === button.dataset.offer);
      if (!fixed(listing)) return;
      e.preventDefault(); e.stopImmediatePropagation(); open(listing);
    },true);
    new MutationObserver(decorate).observe(byId('grid'),{childList:true});
    decorate();
    window.DV_TRADE_CHECKOUT = {version:'1.1',priceFor};
    return true;
  }
  const timer = setInterval(() => { if (install()) clearInterval(timer); },100);
})();
