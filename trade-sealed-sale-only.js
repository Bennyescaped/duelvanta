/* DUELVANTA B07: Sealed products are sale-only. No trade or sale+trade mode. */
(() => {
  'use strict';

  let installed = false;

  function normalize() {
    const select = document.getElementById('dvSListingType');
    if (!select) return false;

    if (select.options.length !== 1 || select.options[0]?.value !== 'sale') {
      const saleOption = document.createElement('option');
      saleOption.value = 'sale';
      saleOption.textContent = 'Verkauf';
      select.replaceChildren(saleOption);
    }
    select.value = 'sale';
    select.disabled = true;

    const field = select.closest('.field');
    if (field) {
      field.hidden = true;
      field.setAttribute('aria-hidden', 'true');
    }

    const tradeOnlyNote = document.getElementById('dvTradeOnlySealedMoneyNote');
    if (tradeOnlyNote) tradeOnlyNote.hidden = true;

    return true;
  }

  function install() {
    if (installed) return true;
    const dialog = document.getElementById('dvSealedDialog');
    if (!dialog || !normalize()) return false;

    installed = true;
    new MutationObserver(() => {
      if (dialog.hasAttribute('open')) Promise.resolve().then(normalize);
    }).observe(dialog, {attributes:true, attributeFilter:['open']});

    window.DV_SEALED_SALE_ONLY = {version:'1.0', sync:normalize};
    return true;
  }

  let tries = 0;
  const timer = setInterval(() => {
    tries += 1;
    if (install() || tries > 180) clearInterval(timer);
  }, 100);
})();
