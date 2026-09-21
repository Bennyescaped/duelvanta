/* Fixed-price checkout V2: buyer offer -> automatic Stripe payment request -> contract. */
(() => {
  'use strict';
  const byId=id=>document.getElementById(id);
  const methods={standard_letter:'Standardbrief',tracked_letter:'Brief mit Tracking',parcel:'Paket mit Tracking',pickup:'Abholung',custom:'Nach Absprache'};
  const classes={b2c:'B2C · GEWERBLICHER VERKAUF AN VERBRAUCHER',b2b:'B2B · GEWERBLICHER VERKAUF',c2c:'PRIVATVERKAUF · VERBRAUCHERKAUF',c2b:'PRIVATVERKAUF · GESCHÄFTLICHER KÄUFER'};
  let current=null,busy=false,installed=false,retry=null,review=null,reviewTimer=null,reviewRequest=0;
  const cash=n=>money(n);
  function priceFor(listing,quantity){let price=Number(listing.asking_price||0);for(const tier of [...(listing.quantity_pricing||[])].sort((a,b)=>a.min_quantity-b.min_quantity)){if(quantity>=Number(tier.min_quantity))price=Number(tier.unit_price)}return price}
  function fixed(l){return l?.pricing_mode==='fixed'&&l.listing_type!=='trade'}
  function decorate(){if(!['market','mine'].includes(tab))return;byId('grid').querySelectorAll('.listing').forEach(card=>{const button=card.querySelector('[data-offer],[data-edit]'),listing=listings.find(l=>l.id===(button?.dataset.offer||button?.dataset.edit));if(!listing||card.querySelector('.dvPriceMode')||listing.listing_type==='trade')return;card.querySelector('.priceRow')?.insertAdjacentHTML('afterend',`<div class="dvPriceMode">${fixed(listing)?'FESTPREIS':'VERHANDLUNGSBASIS'}</div>`);if(button.dataset.offer)button.textContent=fixed(listing)?'JETZT KAUFEN':'PREIS VORSCHLAGEN'})}
  function selectedQuantity(){return current.product_kind==='sealed'?Number(byId('dvBuyQty').value):1}
  function address(p){return[p.street_line1,p.street_line2,[p.postal_code,p.city].filter(Boolean).join(' '),p.country_code].filter(Boolean).join(', ')}
  function reviewError(error){const m=String(error?.message||error||'');if(m.includes('buyer_profile_required'))return'Lege zuerst in deinem Profil fest, ob du auf DUELVANTA privat als Verbraucher oder geschäftlich einkaufst.';return m}
  function renderServerReview(data){
    const seller=data.seller_party||{},business=seller.business_name||seller.legal_name||'Verkäufer';
    byId('dvCheckoutParty').innerHTML=`<div class="dvCheckoutRole"><b>${esc(classes[data.contract_classification]||String(data.contract_classification||'').toUpperCase())}</b><span>${esc(seller.role_label||'Verkäufer')}</span></div><div><strong>Vertragspartner</strong><br>${esc(business)}${seller.legal_name&&seller.business_name?` · ${esc(seller.legal_name)}`:''}<br>${esc(address(seller))}${seller.public_email?`<br>${esc(seller.public_email)}`:''}</div><div class="dvCheckoutLegal">Dein Klick gibt das verbindliche Kaufangebot ab. Der Vertrag entsteht erst, wenn DUELVANTA unmittelbar die Stripe-Zahlungsaufforderung im Namen des Verkäufers erzeugt.</div>`;
    byId('dvBuyTotals').innerHTML=`<div><span>${data.quantity} × Stückpreis</span><strong>${cash(data.unit_price)}</strong></div><div><span>Warenwert</span><strong>${cash(data.goods_total)}</strong></div><div><span>Versand (${esc(methods[data.shipping_method]||data.shipping_method)})</span><strong>${cash(data.shipping_cost)}</strong></div><div class="grand"><span>GESAMTPREIS</span><strong>${cash(data.total_price)}</strong></div>`;
  }
  function scheduleReview(quantity){
    const request=++reviewRequest,listing=current;clearTimeout(reviewTimer);review=null;byId('dvBuyNow').disabled=true;
    byId('dvCheckoutParty').innerHTML='<div class="msg">Verkäuferrolle, Käuferprofil und Vertragsdaten werden serverseitig geprüft …</div>';
    reviewTimer=setTimeout(async()=>{const response=await db.rpc('review_market_checkout',{p_listing_id:listing.id,p_quantity:quantity});if(request!==reviewRequest||current?.id!==listing.id||selectedQuantity()!==quantity)return;if(response.error){byId('dvCheckoutParty').innerHTML='';byId('dvBuyMsg').textContent=reviewError(response.error);return}review=response.data;byId('dvBuyMsg').textContent='';renderServerReview(review);byId('dvBuyNow').disabled=busy},80);
  }
  function refresh(){
    const quantity=selectedQuantity(),min=current.product_kind==='sealed'?current.minimum_purchase_quantity:1,valid=Number.isInteger(quantity)&&quantity>=min&&quantity<=current.quantity_available;
    review=null;byId('dvBuyNow').disabled=true;if(byId('dvBuyMinus'))byId('dvBuyMinus').disabled=busy||!valid||quantity<=min;if(byId('dvBuyPlus'))byId('dvBuyPlus').disabled=busy||!valid||quantity>=current.quantity_available;
    byId('dvBuyQtyHint').textContent=valid?`${current.quantity_available} verfügbar`:`Bitte eine ganze Menge zwischen ${min} und ${current.quantity_available} eingeben.`;
    if(!valid){clearTimeout(reviewTimer);reviewRequest++;byId('dvBuyTotals').textContent='Bitte Menge eingeben.';byId('dvCheckoutParty').innerHTML='';return}
    const unit=priceFor(current,quantity),amount=Math.round(unit*quantity*100)/100,shipping=Number(current.shipping_cost);
    byId('dvBuyTotals').innerHTML=`<div><span>${quantity} × Stückpreis</span><strong>${cash(unit)}</strong></div><div><span>Warenwert</span><strong>${cash(amount)}</strong></div><div><span>Versand laut Inserat</span><strong>${Number.isFinite(shipping)?cash(shipping):'Prüfung erforderlich'}</strong></div><div class="grand"><span>SERVERPRÜFUNG AUSSTEHEND</span><strong>—</strong></div>`;scheduleReview(quantity);
  }
  function open(listing){
    if(busy)return;current={...listing};retry=null;review=null;reviewRequest++;byId('dvBuyMsg').textContent='';
    byId('dvBuyBody').innerHTML=`<div class="summary"><b>${esc(listing.card_name)}</b><div class="msg">${esc([listing.set_name,listing.language,methods[listing.shipping_method]].filter(Boolean).join(' · '))}</div></div><div class="field" ${listing.product_kind==='sealed'?'':'hidden'}><label for="dvBuyQty">Menge</label><div class="dvQuantityPicker"><button id="dvBuyMinus" class="btn ghost" type="button" aria-label="Menge verringern">−</button><input id="dvBuyQty" type="number" inputmode="numeric" min="${listing.minimum_purchase_quantity}" max="${listing.quantity_available}" step="1" value="${listing.product_kind==='sealed'?listing.minimum_purchase_quantity:1}" aria-label="Gewünschte Menge"><button id="dvBuyPlus" class="btn ghost" type="button" aria-label="Menge erhöhen">+</button></div></div><div id="dvBuyQtyHint" class="msg"></div><div id="dvCheckoutParty" class="dvCheckoutParty"></div><div id="dvBuyTotals" class="dvBuyTotals"></div><div class="dvCheckoutBeta"><strong>VERBINDLICHES KAUFANGEBOT</strong><span>„Zahlungspflichtig bestellen“ gibt dein Kaufangebot ab. Erst die unmittelbar danach erzeugte Stripe-Zahlungsaufforderung ist die Annahme des Verkäufers und bildet den Vertragsschluss. Scheitert die Zahlungsaufforderung, wird kein Vertrag angelegt.</span></div><button id="dvBuyNow" class="btn gold" type="button" disabled>Zahlungspflichtig bestellen</button>`;
    byId('dvBuyQty').addEventListener('input',refresh);byId('dvBuyMinus').onclick=()=>changeQuantity(-1);byId('dvBuyPlus').onclick=()=>changeQuantity(1);byId('dvBuyNow').onclick=buy;refresh();byId('dvBuyDialog').showModal();
  }
  function changeQuantity(delta){if(busy||!current||current.product_kind!=='sealed')return;const input=byId('dvBuyQty'),min=Number(current.minimum_purchase_quantity||1),max=Number(current.quantity_available||min),value=Number.isInteger(Number(input.value))?Number(input.value):min;input.value=String(Math.max(min,Math.min(max,value+delta)));input.dispatchEvent(new Event('input',{bubbles:true}))}
  function purchaseRequest(quantity){const key=`dv-fixed-offer:${user.id}:${current.id}`,signature=`${current.updated_at}:${quantity}:${review.checkout_hash}`;let saved=null;try{saved=JSON.parse(sessionStorage.getItem(key))}catch(_){}if(!saved||saved.signature!==signature)saved={signature,id:crypto.randomUUID()};try{sessionStorage.setItem(key,JSON.stringify(saved))}catch(_){}if(retry?.signature===signature)saved=retry;retry={...saved,key};return retry}
  async function buy(){
    if(busy||!current||!review||byId('dvBuyNow').disabled)return;
    const listing=current,quantity=selectedQuantity(),checkoutReview=review,request=purchaseRequest(quantity);busy=true;
    byId('dvBuyNow').disabled=true;byId('dvBuyMinus').disabled=true;byId('dvBuyPlus').disabled=true;byId('dvBuyQty').disabled=true;
    byId('dvBuyMsg').textContent='Kaufangebot wird geprüft und die Stripe-Zahlungsaufforderung vorbereitet …';
    try{
      const auth=await db.auth.getSession(),session=auth.data?.session;if(!session?.access_token)throw Error('Sitzung abgelaufen. Bitte erneut anmelden.');
      const response=await fetch('/api/market-stripe-checkout',{method:'POST',headers:{authorization:`Bearer ${session.access_token}`,'content-type':'application/json'},body:JSON.stringify({
        listing_id:listing.id,quantity,request_key:request.id,expected_updated_at:listing.updated_at,checkout_hash:checkoutReview.checkout_hash
      })});
      const result=await response.json().catch(()=>({}));
      if(!response.ok){
        if(result.error==='stripe_sandbox_disabled')throw Error('Die Stripe-Zahlungsaufforderung ist in dieser Umgebung noch nicht freigeschaltet. Es wurde kein Vertrag geschlossen.');
        throw Error(result.error||`checkout_${response.status}`);
      }
      const target=new URL(result.checkout_url);
      if(target.protocol!=='https:'||target.hostname!=='checkout.stripe.com')throw Error('Ungültige Stripe-Zahlungsaufforderung.');
      try{sessionStorage.removeItem(request.key)}catch(_){}retry=null;
      byId('dvBuyMsg').textContent='Zahlungsaufforderung erstellt. Der Vertrag ist geschlossen; Weiterleitung zu Stripe …';
      location.assign(target.href);
      return;
    }catch(error){
      byId('dvBuyMsg').textContent=reviewError(error);busy=false;byId('dvBuyQty').disabled=false;
      review=checkoutReview;byId('dvBuyNow').disabled=false;byId('dvBuyMinus').disabled=false;byId('dvBuyPlus').disabled=false;
      if(String(error.message||'').includes('checkout_review_changed'))refresh();
    }
  }
  function install(){
    if(installed)return true;if(typeof user==='undefined'||!user||!window.DV_TRADE_SEALED||!window.DV_TRADE_ORDERS)return false;installed=true;
    const style=document.createElement('style');style.textContent='.dvPriceMode{margin:8px 0;color:#d8c28f;font-size:10px;letter-spacing:.08em}.dvCheckoutParty,.dvBuyTotals{border:1px solid #303640;border-radius:12px;padding:12px;margin:12px 0}.dvCheckoutParty{display:grid;gap:9px;color:#a0a8b3;font-size:11px;line-height:1.55}.dvCheckoutParty strong,.dvCheckoutRole b{color:#eee7dc}.dvCheckoutRole{display:flex;justify-content:space-between;gap:10px}.dvCheckoutRole b{color:#efd18c}.dvCheckoutLegal{border-top:1px solid #303640;padding-top:8px}.dvBuyTotals>div{display:flex;justify-content:space-between;gap:12px;padding:6px 0;color:#a0a8b3;font-size:12px}.dvBuyTotals strong{color:#eee7dc}.dvBuyTotals .grand{border-top:1px solid #303640;margin-top:7px}.dvCheckoutNote{color:#9ba2ad;font-size:11px;line-height:1.6;margin:12px 0}#dvBuyNow{width:100%;margin-top:12px}#dvBuyQty{width:100%;box-sizing:border-box}#dvBuyMsg{overflow-wrap:anywhere}';document.head.appendChild(style);
    const dialog=document.createElement('dialog');dialog.id='dvBuyDialog';dialog.innerHTML='<div class="modal"><div class="modalHead"><h2>Kaufangebot prüfen</h2><button id="dvBuyClose" type="button" class="close" aria-label="Kaufdialog schließen">✕</button></div><div id="dvBuyBody"></div><div id="dvBuyMsg" class="msg" aria-live="polite"></div></div>';document.body.appendChild(dialog);
    byId('dvBuyClose').onclick=()=>{if(!busy)dialog.close()};dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault()});
    document.addEventListener('click',e=>{const button=e.target.closest('[data-offer]');if(!button)return;const listing=listings.find(l=>l.id===button.dataset.offer);if(!fixed(listing))return;e.preventDefault();e.stopImmediatePropagation();open(listing)},true);
    new MutationObserver(decorate).observe(byId('grid'),{childList:true});decorate();window.DV_TRADE_CHECKOUT={version:'2.0',priceFor};return true;
  }
  const timer=setInterval(()=>{if(install())clearInterval(timer)},100);
})();
