/* B07 pickup UI hardening V2: role-safe controls and pickup wording without observer recursion. */
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
    const pickup = /Abholung\s*·/i.test(quote?.textContent || '');
    if (pickup && heading) {
      const current = heading.textContent || '';
      const next = current.replace(/^VERSAND\s*·/i, 'ÜBERGABE ·');
      if (next !== current) heading.textContent = next;
    }

    const completed = card.querySelector('.dvOrderStatus.completed');
    const steps = card.querySelectorAll('.dvOrderRail .dvOrderStep');
    if (pickup && completed && steps.length >= 3) {
      const handover = steps[1];
      handover.classList.remove('current');
      handover.classList.add('done');
      if (handover.innerHTML !== '<b>ÜBERGABE</b>BESTÄTIGT') handover.innerHTML = '<b>ÜBERGABE</b>BESTÄTIGT';
    }
  }

  function fixAll() {
    document.querySelectorAll('.dvOrderCard').forEach(fixCard);
  }

  function install() {
    const root = document.getElementById('grid');
    if (!root) return false;

    let scheduled = false;
    const observer = new MutationObserver(() => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        fixAll();
      });
    });
    observer.observe(root, { childList: true, subtree: true });
    fixAll();
    window.DV_B07_PICKUP_UI_FIX = { version: '2.1', refresh: fixAll };
    return true;
  }

  let tries = 0;
  const timer = setInterval(() => {
    tries += 1;
    if (install() || tries > 120) clearInterval(timer);
  }, 100);
})();
