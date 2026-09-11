(() => {
  'use strict';
  const COPY = {
    market:['TRADE · MARKTPLATZ','Karten entdecken und direkt handeln.','Festpreis kaufen oder bei Verhandlungsbasis einen Preis vorschlagen.'],
    mine:['TRADE · VERKAUFEN','Deine Inserate.','Angebote bearbeiten, pausieren oder neue Produkte einstellen.'],
    offers:['TRADE · PREISANGEBOTE','Deine Preisangebote.','Eingegangene und gesendete Vorschläge mit Menge und Preisvergleich.'],
    orders:['TRADE · BESTELLUNGEN','Käufe und Verkäufe.','Produkte, Versand, Gesamtbetrag und der nächste Schritt an einem Ort.'],
    deals:['TRADE · BEWERTUNGEN','Abschlüsse und Bewertungen.','Abgeschlossene Handelsvorgänge prüfen und Handelspartner bewerten.'],
    shipping_profiles:['TRADE · VERSAND','Deine Versandregeln.','Tarife einmal festlegen und Combined Shipping sicher berechnen lassen.']
  };
  let installed = false;
  const isMobile = () => typeof matchMedia === 'function' && matchMedia('(max-width:760px)').matches;
  const setOpen = (details,open) => open ? details.setAttribute('open','') : details.removeAttribute('open');

  function activeView(tabs) {
    const active = tabs.querySelector('.btn.active');
    if (active?.id === 'dvOrdersTab') return 'orders';
    if (active?.id === 'dvDealsTab') return 'deals';
    if (active?.id === 'dvShippingProfilesTab') return 'shipping_profiles';
    return active?.dataset.tab || (typeof tab !== 'undefined' ? tab : 'market');
  }

  function syncView(tabs) {
    const app = document.getElementById('app'), hero = document.querySelector('.hero');
    if (!app || !hero) return;
    const view = activeView(tabs), copy = COPY[view] || COPY.market;
    app.dataset.tradeView = view;
    const eyebrow = hero.querySelector('.eyebrow'), title = hero.querySelector('h1'), text = hero.querySelector('p');
    if (eyebrow) eyebrow.textContent = copy[0];
    if (title) title.textContent = copy[1];
    if (text) text.textContent = copy[2];
    const details = tabs.querySelector('.dvTradeMore');
    if (details && !isMobile()) setOpen(details,true);
    else if (details?.querySelector('.btn.active')) setOpen(details,true);
  }

  function improveOfferDialog() {
    const dialog = document.getElementById('offerDialog');
    if (!dialog) return;
    const title = dialog.querySelector('h2'), amount = document.getElementById('offerAmount'), send = document.getElementById('sendOffer');
    if (title) title.textContent = 'Preis vorschlagen';
    const amountLabel = amount?.closest('.field')?.querySelector('label');
    if (amountLabel) amountLabel.textContent = 'Dein Gesamtangebot €';
    const message = document.getElementById('offerMessage');
    const messageLabel = message?.closest('.field')?.querySelector('label');
    if (messageLabel) messageLabel.textContent = 'Nachricht optional';
    if (send) send.textContent = 'PREISANGEBOT SENDEN';
    if (!document.getElementById('dvOfferFlowNote')) {
      const note = document.createElement('div');
      note.id = 'dvOfferFlowNote';
      note.className = 'dvOfferFlowNote';
      note.textContent = 'Bei Annahme entsteht automatisch eine Bestellung. In der Beta wird dabei noch keine Onlinezahlung ausgeführt.';
      send?.insertAdjacentElement('beforebegin', note);
    }
  }

  function fieldFor(id) {
    return document.getElementById(id)?.closest('.field') || null;
  }

  function buildAdvanced(form,id,fieldIds) {
    if (!form || document.getElementById(id)) return document.getElementById(id);
    const fields = [...new Set(fieldIds.map(fieldFor).filter(Boolean))];
    if (!fields.length) return null;
    const details = document.createElement('details');
    details.id = id;
    details.className = 'dvSellAdvanced full';
    details.innerHTML = '<summary>WEITERE EINSTELLUNGEN <span>OPTIONAL</span></summary><div class="dvAdvancedGrid"></div>';
    const grid = details.querySelector('.dvAdvancedGrid');
    fields.forEach(field => grid.appendChild(field));
    form.appendChild(details);
    return details;
  }

  function recentShipping(productKind) {
    if (typeof listings === 'undefined' || typeof user === 'undefined' || !user) return null;
    const reusableMethods = ['standard_letter','tracked_letter','parcel','pickup'];
    return listings.find(item => {
      const kind = item.product_kind || 'single';
      const sameKind = productKind === 'sealed' ? kind === 'sealed' : kind !== 'sealed';
      const cost = Number(item.shipping_cost);
      return item.seller_id === user.id && sameKind && reusableMethods.includes(item.shipping_method) && Number.isFinite(cost) && cost >= 0 && cost <= 500;
    }) || null;
  }

  function applyRecentShipping(productKind,method,cost,note) {
    const previous = recentShipping(productKind);
    if (!previous || !method || !cost || method.value === 'pickup' || String(cost.value).trim()) {
      if (note) note.hidden = true;
      return false;
    }
    method.value = previous.shipping_method;
    cost.value = Number(previous.shipping_cost).toFixed(2);
    method.dispatchEvent(new Event('change',{bubbles:true}));
    cost.dispatchEvent(new Event('input',{bubbles:true}));
    if (note) {
      note.hidden = false;
      note.textContent = 'Versandart und Kosten wurden aus deinem letzten passenden Inserat übernommen. Bitte kurz prüfen.';
    }
    return true;
  }

  function simplifySingleForm() {
    const dialog = document.getElementById('listDialog'), form = dialog?.querySelector('.formGrid'), chosenBox = document.getElementById('chosen');
    if (!dialog || !form || !chosenBox) return;
    const details = buildAdvanced(form,'dvSingleAdvanced',['listingType','dvShippingNote','note']);
    if (!details) return;

    const listingLabel = fieldFor('listingType')?.querySelector('label');
    const noteLabel = fieldFor('note')?.querySelector('label');
    if (listingLabel) listingLabel.textContent = 'Verkaufsart';
    if (noteLabel) noteLabel.textContent = 'Hinweis zum Angebot optional';

    const intro = document.createElement('div');
    intro.id = 'dvSingleAutoData';
    intro.className = 'dvSellIntro';
    intro.innerHTML = '<b>KARTENDATEN ÜBERNOMMEN</b><span>Name, Set, Nummer, Sprache, Zustand, Variante, Grading und Bild kommen aus deiner Collection. Du ergänzt nur Preis und Versand.</span>';
    chosenBox.insertAdjacentElement('afterend',intro);

    const reuse = document.createElement('div');
    reuse.id = 'dvSingleShippingReuse';
    reuse.className = 'dvShippingReuse full';
    reuse.hidden = true;
    details.insertAdjacentElement('beforebegin',reuse);

    const method = document.getElementById('dvShippingMethod'), cost = document.getElementById('dvShippingCost');
    method?.addEventListener('change',() => {
      if (method.value === 'custom') setOpen(details,true);
    });
    const sync = () => {
      const editing = document.getElementById('listHeading')?.textContent.toLowerCase().includes('bearbeiten');
      if (!editing) applyRecentShipping('single',method,cost,reuse);
      else reuse.hidden = true;
      const hasExtras = document.getElementById('listingType')?.value !== 'sale' || !!document.getElementById('dvShippingNote')?.value.trim() || !!document.getElementById('note')?.value.trim();
      setOpen(details,!!editing && hasExtras);
      if (method?.value === 'custom') setOpen(details,true);
    };
    new MutationObserver(() => { if (dialog.hasAttribute('open')) setTimeout(sync,0); }).observe(dialog,{attributes:true,attributeFilter:['open']});
    document.getElementById('publish')?.addEventListener('click',() => setTimeout(() => {
      if (document.getElementById('publishMsg')?.textContent.includes('Versandart')) setOpen(details,true);
    },0));
  }

  function simplifySealedForm() {
    const dialog = document.getElementById('dvSealedDialog'), form = dialog?.querySelector('.dvSealedGrid');
    if (!dialog || !form) return;
    const details = buildAdvanced(form,'dvSealedAdvanced',['dvSUnits','dvSContents','dvSWeight','dvSL','dvSListingType','dvSMinQty','dvSTier1Qty','dvSShippingNote','dvSNote']);
    if (!details) return;

    const intro = document.createElement('div');
    intro.id = 'dvSealedQuickIntro';
    intro.className = 'dvSellIntro';
    intro.innerHTML = '<b>SEALED SCHNELL EINSTELLEN</b><span>Produkt, Zustand, Bestand, Preis, Versand und echte Fotos genügen für den Standardfall. Spezialangaben bleiben optional.</span>';
    form.insertAdjacentElement('beforebegin',intro);

    const reuse = document.createElement('div');
    reuse.id = 'dvSealedShippingReuse';
    reuse.className = 'dvShippingReuse full';
    reuse.hidden = true;
    details.insertAdjacentElement('beforebegin',reuse);

    const method = document.getElementById('dvSShipping'), cost = document.getElementById('dvSShippingCost');
    method?.addEventListener('change',() => {
      if (method.value === 'custom') setOpen(details,true);
    });
    const sync = () => {
      const editing = document.getElementById('dvSealedHeading')?.textContent.toLowerCase().includes('bearbeiten');
      if (!editing) applyRecentShipping('sealed',method,cost,reuse);
      else reuse.hidden = true;
      const hasExtras = !![
        'dvSUnits','dvSContents','dvSWeight','dvSL','dvSW','dvSH','dvSShippingNote','dvSNote','dvSTier1Qty','dvSTier1Price','dvSTier2Qty','dvSTier2Price'
      ].some(id => document.getElementById(id)?.value.trim()) || document.getElementById('dvSListingType')?.value !== 'sale' || document.getElementById('dvSMinQty')?.value !== '1';
      setOpen(details,!!editing && hasExtras);
      if (method?.value === 'custom') setOpen(details,true);
    };
    new MutationObserver(() => { if (dialog.hasAttribute('open')) setTimeout(sync,0); }).observe(dialog,{attributes:true,attributeFilter:['open']});
    document.getElementById('dvSSave')?.addEventListener('click',() => setTimeout(() => {
      const message = document.getElementById('dvSMsg')?.textContent || '';
      if (/Mindestabnahme|Mengenpreis|individuelle Versandart/i.test(message)) setOpen(details,true);
    },0));
  }

  function install() {
    if (installed) return true;
    const tabs = document.querySelector('.tabs'), hero = document.querySelector('.hero'), daily = document.getElementById('daily');
    const market = tabs?.querySelector('[data-tab="market"]'), mine = tabs?.querySelector('[data-tab="mine"]'), offers = tabs?.querySelector('[data-tab="offers"]');
    const orders = document.getElementById('dvOrdersTab'), deals = document.getElementById('dvDealsTab'), shipping = document.getElementById('dvShippingProfilesTab');
    const sell = document.getElementById('sell'), automation = document.getElementById('dvTradeAutomation');
    if (!tabs || !hero || !daily || !market || !mine || !offers || !orders || !deals || !shipping || !sell || !automation) return false;
    installed = true;

    tabs.classList.add('dvTradeNav');
    market.textContent = 'MARKT';
    mine.textContent = 'MEINE INSERATE';
    offers.textContent = 'PREISANGEBOTE';
    orders.textContent = 'BESTELLUNGEN';
    deals.textContent = 'BEWERTUNGEN';
    shipping.textContent = 'VERSAND';
    sell.textContent = '+ VERKAUFEN';

    const primary = document.createElement('div');
    primary.className = 'dvTradePrimary';
    const more = document.createElement('details');
    more.className = 'dvTradeMore';
    more.innerHTML = '<summary>WEITERE BEREICHE</summary><div class="dvTradeSecondary"></div>';
    tabs.replaceChildren(primary, more);
    primary.append(market, orders, sell);
    more.querySelector('.dvTradeSecondary').append(mine, offers, deals, shipping);

    hero.after(tabs);
    tabs.after(automation);
    automation.after(daily);
    improveOfferDialog();
    simplifySingleForm();
    simplifySealedForm();
    syncView(tabs);

    tabs.addEventListener('click', event => {
      if (!event.target.closest('.btn')) return;
      setTimeout(() => {
        syncView(tabs);
        if (isMobile()) setOpen(more,false);
      }, 0);
    });
    const activeObserver = new MutationObserver(() => syncView(tabs));
    activeObserver.observe(tabs, {subtree:true,attributes:true,attributeFilter:['class']});
    window.addEventListener?.('resize', () => syncView(tabs), {passive:true});
    window.DV_TRADE_MARKETPLACE_UX = {version:'1.1',sync:() => syncView(tabs)};
    return true;
  }

  let tries = 0;
  const timer = setInterval(() => {
    tries += 1;
    if (install() || tries > 140) clearInterval(timer);
  }, 100);
})();
