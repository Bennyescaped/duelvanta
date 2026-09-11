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
    window.DV_TRADE_MARKETPLACE_UX = {version:'1.0',sync:() => syncView(tabs)};
    return true;
  }

  let tries = 0;
  const timer = setInterval(() => {
    tries += 1;
    if (install() || tries > 140) clearInterval(timer);
  }, 100);
})();
