/* DUELVANTA listing-type rules: pure trade listings never carry a money amount. */
(() => {
  'use strict';

  let installed = false;
  const field = id => document.getElementById(id)?.closest('.field') || null;

  function stashAndClear(input) {
    if (!input) return;
    if (input.value && !input.dataset.dvTradeMoneyStash) input.dataset.dvTradeMoneyStash = input.value;
    input.value = '';
    input.disabled = true;
  }

  function restore(input) {
    if (!input) return;
    input.disabled = false;
    if (!input.value && input.dataset.dvTradeMoneyStash) input.value = input.dataset.dvTradeMoneyStash;
    delete input.dataset.dvTradeMoneyStash;
  }

  function toggleField(id, hidden) {
    const el = field(id);
    if (!el) return;
    el.hidden = hidden;
    el.setAttribute('aria-hidden', hidden ? 'true' : 'false');
  }

  function syncSingle() {
    const type = document.getElementById('listingType');
    const asking = document.getElementById('asking');
    const pricing = document.getElementById('dvPricingMode');
    const hint = document.getElementById('priceHint');
    if (!type || !asking || !pricing) return;

    const tradeOnly = type.value === 'trade';
    toggleField('asking', tradeOnly);
    toggleField('dvPricingMode', tradeOnly);

    if (tradeOnly) {
      stashAndClear(asking);
      pricing.value = 'negotiable';
      pricing.disabled = true;
      if (hint) hint.textContent = 'Nur Tausch: Es wird kein Geldbetrag vereinbart. Ein Marktwert dient ausschließlich als Referenz.';
    } else {
      restore(asking);
      pricing.disabled = false;
      asking.dispatchEvent(new Event('input', {bubbles:true}));
    }
  }

  function sealedNote() {
    let note = document.getElementById('dvTradeOnlySealedMoneyNote');
    if (note) return note;
    const typeField = field('dvSListingType');
    if (!typeField) return null;
    note = document.createElement('div');
    note.id = 'dvTradeOnlySealedMoneyNote';
    note.className = 'dvSealedHint full';
    note.hidden = true;
    note.textContent = 'Nur Tausch: Es wird kein Geldbetrag vereinbart. Preisart, Stückpreis und Mengenpreise sind deaktiviert.';
    typeField.insertAdjacentElement('afterend', note);
    return note;
  }

  function syncSealed() {
    const type = document.getElementById('dvSListingType');
    const pricing = document.getElementById('dvSPricingMode');
    const price = document.getElementById('dvSPrice');
    const tierInputs = ['dvSTier1Qty','dvSTier1Price','dvSTier2Qty','dvSTier2Price'].map(id => document.getElementById(id)).filter(Boolean);
    if (!type || !pricing || !price) return;

    const tradeOnly = type.value === 'trade';
    toggleField('dvSPricingMode', tradeOnly);
    toggleField('dvSPrice', tradeOnly);
    const tierField = field('dvSTier1Qty');
    if (tierField) {
      tierField.hidden = tradeOnly;
      tierField.setAttribute('aria-hidden', tradeOnly ? 'true' : 'false');
    }
    const note = sealedNote();
    if (note) note.hidden = !tradeOnly;

    if (tradeOnly) {
      stashAndClear(price);
      tierInputs.forEach(stashAndClear);
      pricing.value = 'negotiable';
      pricing.disabled = true;
    } else {
      restore(price);
      tierInputs.forEach(restore);
      pricing.disabled = false;
    }
  }

  function observeDialog(id, sync) {
    const dialog = document.getElementById(id);
    if (!dialog) return;
    new MutationObserver(() => {
      if (dialog.hasAttribute('open')) Promise.resolve().then(sync);
    }).observe(dialog, {attributes:true, attributeFilter:['open']});
  }

  function install() {
    if (installed) return true;
    const singleType = document.getElementById('listingType');
    const sealedType = document.getElementById('dvSListingType');
    const pricing = document.getElementById('dvPricingMode');
    if (!singleType || !sealedType || !pricing) return false;

    installed = true;
    singleType.addEventListener('change', syncSingle);
    sealedType.addEventListener('change', syncSealed);
    observeDialog('listDialog', syncSingle);
    observeDialog('dvSealedDialog', syncSealed);
    syncSingle();
    syncSealed();
    window.DV_TRADE_LISTING_TYPE_RULES = {version:'1.0', sync(){ syncSingle(); syncSealed(); }};
    return true;
  }

  let tries = 0;
  const timer = setInterval(() => {
    tries += 1;
    if (install() || tries > 180) clearInterval(timer);
  }, 100);
})();
