/* B07 pickup UI hardening: seller cannot confirm own handover code; pickup wording uses Übergabe. */
(() => {
  'use strict';

  function fixCard(card) {
    if (!(card instanceof Element) || !card.matches('.dvOrderCard')) return;

    const eyebrow = card.querySelector('.eyebrow')?.textContent || '';
    if (eyebrow.includes('DU VERKAUFST')) {
      card.querySelector('[data-b07-pickup-confirm]')?.remove();
    }

    const quote = card.querySelector('.dvQuote');
    const heading = quote?.querySelector('b');
    if (quote && heading && /Abholung\s*·/i.test(quote.textContent || '')) {
      heading.textContent = heading.textContent.replace(/^VERSAND\s*·/i, 'ÜBERGABE ·');
    }
  }

  function fixAll() {
    document.querySelectorAll('.dvOrderCard').forEach(fixCard);
  }

  function install() {
    const root = document.getElementById('grid');
    if (!root) return false;

    const observer = new MutationObserver(() => queueMicrotask(fixAll));
    observer.observe(root, { childList: true, subtree: true, characterData: true });
    fixAll();
    window.DV_B07_PICKUP_UI_FIX = { version: '1.0', refresh: fixAll };
    return true;
  }

  let tries = 0;
  const timer = setInterval(() => {
    tries += 1;
    if (install() || tries > 120) clearInterval(timer);
  }, 100);
})();
