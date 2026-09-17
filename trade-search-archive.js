/* DUELVANTA TRADE: prominent marketplace search + non-destructive archive separation. */
(() => {
  'use strict';

  let installed = false;
  let archiveRows = [];
  let archiveType = 'all';
  let filterQueued = false;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
  const fmt = value => value ? new Intl.DateTimeFormat('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  }).format(new Date(value)) : '—';
  const cash = value => typeof money === 'function'
    ? money(Number(value || 0))
    : new Intl.NumberFormat('de-DE', {style: 'currency', currency: 'EUR'}).format(Number(value || 0));
  const text = value => String(value ?? '').toLocaleLowerCase('de-DE');

  function style() {
    if (document.getElementById('dvSearchArchiveStyle')) return;
    const node = document.createElement('style');
    node.id = 'dvSearchArchiveStyle';
    node.textContent = `
      .wrap:not([data-trade-view="market"]):not([data-trade-view="mine"]) .toolbar{display:none!important}
      .toolbar #search{min-height:46px;font-size:14px}
      .dvArchiveIntro{grid-column:1/-1;border:1px solid rgba(199,164,93,.28);background:rgba(199,164,93,.045);border-radius:16px;padding:15px;color:#aaa39a;font-size:11px;line-height:1.55}
      .dvArchiveIntro b{display:block;color:#efd18c;letter-spacing:.08em;margin-bottom:4px}
      .dvArchiveTools{grid-column:1/-1;display:grid;gap:10px;border:1px solid #2b313a;border-radius:14px;padding:12px;background:#0c1015}
      .dvArchiveSearch{width:100%;box-sizing:border-box;border:1px solid #303640;background:#090c10;color:#f3eee4;border-radius:10px;padding:12px;font-size:13px}
      .dvArchiveFilters{display:flex;gap:7px;flex-wrap:wrap}
      .dvArchiveFilters .btn{font-size:9px;padding:8px 10px}
      .dvArchiveGrid{grid-column:1/-1;display:grid;gap:10px}
      .dvArchiveCard{border:1px solid #2a3039;border-radius:14px;background:linear-gradient(180deg,#11151b,#0b0f14);padding:14px}
      .dvArchiveCard[hidden]{display:none!important}
      .dvArchiveTop{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}
      .dvArchiveKind{color:#c7a45d;font-size:9px;letter-spacing:.12em;text-transform:uppercase}
      .dvArchiveStatus{border:1px solid #3a414c;border-radius:999px;padding:4px 7px;color:#9da5af;font-size:8px;letter-spacing:.08em;text-transform:uppercase}
      .dvArchiveTitle{font:400 20px Georgia,serif;color:#f3eee4;margin:6px 0}
      .dvArchiveMeta{color:#8f98a4;font-size:10px;line-height:1.5}
      .dvArchiveActions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
      .dvArchiveEmpty{grid-column:1/-1;border:1px dashed #303640;border-radius:14px;padding:28px;text-align:center;color:#89919c}
      .dvArchiveHint{grid-column:1/-1;border:1px dashed #303640;border-radius:12px;padding:18px;text-align:center;color:#89919c}
      @media(max-width:760px){
        .dvArchiveTop{display:block}.dvArchiveStatus{display:inline-flex;margin-top:7px}
        .toolbar{margin-top:0}.toolbar #search{font-size:16px}
      }
    `;
    document.head.appendChild(node);
  }

  function setHeroArchive() {
    const app = document.getElementById('app');
    if (!app || app.dataset.tradeView !== 'archive') return;
    const hero = document.querySelector('.hero');
    if (!hero) return;
    const eyebrow = hero.querySelector('.eyebrow');
    const title = hero.querySelector('h1');
    const copy = hero.querySelector('p');
    if (eyebrow) eyebrow.textContent = 'TRADE · ARCHIV';
    if (title) title.textContent = 'Abgeschlossene Vorgänge.';
    if (copy) copy.textContent = 'Verkäufe, Käufe, Tauschvorgänge und beendete Angebote bleiben nachvollziehbar, ohne die aktiven Bereiche zu überladen.';
  }

  function enhanceSearch() {
    const search = document.getElementById('search');
    const toolbar = document.querySelector('.toolbar');
    const automation = document.getElementById('dvTradeAutomation');
    if (!search || !toolbar) return;
    search.type = 'search';
    search.autocomplete = 'off';
    search.placeholder = 'Karten, Graded, Sealed, Sets oder Nummern suchen';
    search.setAttribute('aria-label', 'TRADE durchsuchen');
    if (automation && toolbar.previousElementSibling !== automation) automation.insertAdjacentElement('afterend', toolbar);
  }

  function terminalListingStatus(status) {
    return !['active', 'reserved', 'paused'].includes(String(status || ''));
  }
  function terminalOrderStatus(status) {
    return !['open', 'in_progress', 'shipped', 'received', 'disputed'].includes(String(status || ''));
  }
  function terminalSwapStatus(status) {
    return !['negotiating', 'bound', 'disputed'].includes(String(status || ''));
  }

  function listingRows() {
    if (typeof listings === 'undefined' || typeof user === 'undefined' || !user) return [];
    return listings
      .filter(row => row.seller_id === user.id && terminalListingStatus(row.status))
      .map(row => ({
        type: 'listing',
        kind: 'INSERAT',
        status: row.status,
        title: row.card_name || 'Inserat',
        meta: [row.set_name, row.card_number, row.product_kind, row.listing_type === 'trade' ? 'Tausch' : row.asking_price != null ? cash(row.asking_price) : null].filter(Boolean).join(' · '),
        at: row.updated_at || row.created_at,
        search: [row.card_name, row.set_name, row.card_number, row.product_kind, row.status].join(' ')
      }));
  }

  async function loadArchive() {
    const offerPromise = db.from('market_offers')
      .select('id,status,amount,message,created_at,updated_at,buyer_id,seller_id,market_listings(card_name,set_name,card_number)')
      .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
      .order('created_at', {ascending: false});
    const orderPromise = db.rpc('get_my_market_orders');
    const swapPromise = db.rpc('get_my_market_swaps_v1');
    const casePromise = db.rpc('get_my_market_swap_cases_v1');
    const [offersResult, ordersResult, swapsResult, casesResult] = await Promise.all([offerPromise, orderPromise, swapPromise, casePromise]);

    const rows = [...listingRows()];

    if (!offersResult.error) {
      for (const row of offersResult.data || []) {
        if (row.status === 'pending') continue;
        const card = row.market_listings || {};
        rows.push({
          type: 'offer', kind: 'PREISANGEBOT', status: row.status,
          title: card.card_name || 'Preisangebot',
          meta: [card.set_name, card.card_number, row.amount != null ? cash(row.amount) : null].filter(Boolean).join(' · '),
          at: row.updated_at || row.created_at,
          search: [card.card_name, card.set_name, card.card_number, row.status, row.message].join(' ')
        });
      }
    }

    if (!ordersResult.error) {
      for (const row of ordersResult.data || []) {
        if (!terminalOrderStatus(row.status)) continue;
        rows.push({
          type: 'order', kind: row.seller_id === user.id ? 'VERKAUF' : 'KAUF', status: row.status,
          title: row.order_number || 'DUELVANTA Order',
          meta: [row.item_count ? `${Number(row.item_count)} Artikel` : null, row.total_amount != null ? cash(row.total_amount) : null, row.fulfillment_group === 'pickup' ? 'Abholung' : 'Versand'].filter(Boolean).join(' · '),
          at: row.completed_at || row.updated_at || row.created_at,
          orderId: row.order_id,
          search: [row.order_number, row.status, row.seller_name, row.buyer_name].join(' ')
        });
      }
    }

    if (!swapsResult.error) {
      for (const row of swapsResult.data || []) {
        if (!terminalSwapStatus(row.status)) continue;
        const revision = row.current_revision || {};
        const names = [...(revision.party_a_items || []), ...(revision.party_b_items || [])]
          .map(item => item.card_name || item.item_title || 'Produkt').filter(Boolean);
        rows.push({
          type: 'swap', kind: 'TAUSCH', status: row.status,
          title: names.slice(0, 2).join(' ↔ ') || 'C2C-Tausch',
          meta: row.fulfillment_mode === 'pickup' ? 'Persönliche Abholung' : 'Versand',
          at: row.completed_at || row.closed_at || row.binding_at || revision.created_at,
          search: [names.join(' '), row.status, row.fulfillment_mode].join(' ')
        });
      }
    }

    if (!casesResult.error) {
      for (const row of casesResult.data || []) {
        if (row.status === 'open') continue;
        rows.push({
          type: 'case', kind: 'TAUSCH-PROBLEM', status: row.status,
          title: row.reason || 'Problemfall',
          meta: [row.category, row.response_note ? 'Antwort vorhanden' : null].filter(Boolean).join(' · '),
          at: row.resolved_at || row.updated_at || row.created_at,
          search: [row.reason, row.category, row.status, row.response_note].join(' ')
        });
      }
    }

    archiveRows = rows.sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0));
  }

  function archiveCard(row) {
    const action = row.orderId
      ? `<div class="dvArchiveActions"><button class="btn ghost" type="button" data-archive-order="${esc(row.orderId)}">ORDER ÖFFNEN</button></div>`
      : '';
    return `<article class="dvArchiveCard" data-archive-type="${esc(row.type)}" data-archive-search="${esc(text(`${row.search} ${row.title} ${row.meta}`))}">
      <div class="dvArchiveTop"><div><div class="dvArchiveKind">${esc(row.kind)}</div><div class="dvArchiveTitle">${esc(row.title)}</div></div><span class="dvArchiveStatus">${esc(row.status || 'abgeschlossen')}</span></div>
      <div class="dvArchiveMeta">${esc(row.meta || '—')} · ${esc(fmt(row.at))}</div>${action}
    </article>`;
  }

  function applyArchiveFilter() {
    const query = text(document.getElementById('dvArchiveSearch')?.value).trim();
    let visible = 0;
    document.querySelectorAll('.dvArchiveCard').forEach(card => {
      const typeOk = archiveType === 'all' || card.dataset.archiveType === archiveType;
      const searchOk = !query || String(card.dataset.archiveSearch || '').includes(query);
      card.hidden = !(typeOk && searchOk);
      if (!card.hidden) visible += 1;
    });
    const empty = document.getElementById('dvArchiveFilterEmpty');
    if (empty) empty.hidden = visible > 0;
  }

  async function renderArchive() {
    const app = document.getElementById('app');
    const grid = document.getElementById('grid');
    if (!app || !grid) return;
    app.dataset.tradeView = 'archive';
    setHeroArchive();
    document.getElementById('mineStats')?.classList.add('hidden');
    grid.innerHTML = '<div class="empty">Archiv wird geladen …</div>';
    try {
      await loadArchive();
    } catch (error) {
      grid.innerHTML = `<div class="empty">${esc(error?.message || 'Archiv konnte nicht geladen werden.')}</div>`;
      return;
    }
    grid.innerHTML = `<div class="dvArchiveIntro"><b>AUTOMATISCHES ARCHIV</b>Abgeschlossene und beendete Vorgänge werden hier nur aus der aktiven Ansicht ausgeblendet. Die zugrunde liegenden Nachweise und Vertragsdaten werden dadurch nicht gelöscht.</div>
      <div class="dvArchiveTools"><input id="dvArchiveSearch" class="dvArchiveSearch" type="search" autocomplete="off" placeholder="Archiv durchsuchen"><div class="dvArchiveFilters">
        <button class="btn gold" type="button" data-archive-filter="all">ALLES</button>
        <button class="btn ghost" type="button" data-archive-filter="listing">INSERATE</button>
        <button class="btn ghost" type="button" data-archive-filter="order">KÄUFE / VERKÄUFE</button>
        <button class="btn ghost" type="button" data-archive-filter="swap">TAUSCH</button>
        <button class="btn ghost" type="button" data-archive-filter="offer">PREISANGEBOTE</button>
        <button class="btn ghost" type="button" data-archive-filter="case">PROBLEMFÄLLE</button>
      </div></div>
      <div class="dvArchiveGrid">${archiveRows.map(archiveCard).join('') || '<div class="dvArchiveEmpty">Noch keine archivierten Vorgänge.</div>'}<div id="dvArchiveFilterEmpty" class="dvArchiveHint" hidden>Keine passenden Archiveinträge.</div></div>`;
    document.getElementById('dvArchiveSearch')?.addEventListener('input', applyArchiveFilter);
    grid.querySelectorAll('[data-archive-filter]').forEach(button => button.addEventListener('click', () => {
      archiveType = button.dataset.archiveFilter || 'all';
      grid.querySelectorAll('[data-archive-filter]').forEach(item => item.className = `btn ${item === button ? 'gold' : 'ghost'}`);
      applyArchiveFilter();
    }));
    grid.querySelectorAll('[data-archive-order]').forEach(button => button.addEventListener('click', () => {
      const id = button.dataset.archiveOrder;
      if (id && window.DV_TRADE_ORDERS?.open) window.DV_TRADE_ORDERS.open(id);
    }));
  }

  function addArchiveButton() {
    const secondary = document.querySelector('.dvTradeSecondary');
    if (!secondary || document.getElementById('dvArchiveTab')) return false;
    const button = document.createElement('button');
    button.id = 'dvArchiveTab';
    button.className = 'btn';
    button.type = 'button';
    button.dataset.tab = 'archive';
    button.textContent = 'ARCHIV';
    secondary.appendChild(button);
    button.addEventListener('click', async () => {
      if (typeof tab !== 'undefined') tab = 'archive';
      document.querySelectorAll('.dvTradeNav .btn').forEach(item => item.classList.remove('active'));
      button.classList.add('active');
      archiveType = 'all';
      await renderArchive();
      document.querySelector('.dvTradeMore')?.removeAttribute('open');
    });
    return true;
  }

  function ensureActiveEmpty(view, visible) {
    const grid = document.getElementById('grid');
    if (!grid || view === 'archive') return;
    const id = 'dvActiveArchiveHint';
    const hint = document.getElementById(id);
    if (visible > 0) {
      hint?.remove();
      return;
    }
    const existingEmpty = [...grid.children].some(node => node.classList?.contains('empty') && !node.hidden);
    if (existingEmpty) {
      hint?.remove();
      return;
    }
    if (hint) return;
    const next = document.createElement('div');
    next.id = id;
    next.className = 'dvArchiveHint';
    next.textContent = 'Keine aktiven Vorgänge. Abgeschlossene Einträge findest du im Archiv.';
    grid.appendChild(next);
  }

  function applyActiveFilters() {
    filterQueued = false;
    const app = document.getElementById('app');
    const grid = document.getElementById('grid');
    const view = app?.dataset.tradeView;
    if (!grid || !view || view === 'archive') return;

    let candidates = [];
    if (view === 'mine') {
      candidates = [...grid.querySelectorAll('article.listing')];
      candidates.forEach(card => {
        const status = text(card.querySelector('.badge')?.textContent).split('·')[0].trim();
        card.hidden = ['sold', 'withdrawn', 'expired', 'cancelled'].includes(status);
      });
    } else if (view === 'offers') {
      candidates = [...grid.querySelectorAll('article.listing')];
      candidates.forEach(card => {
        const eyebrow = text(card.querySelector('.eyebrow')?.textContent);
        card.hidden = !eyebrow.includes('offen');
      });
    } else if (view === 'orders') {
      candidates = [...grid.querySelectorAll('.dvOrderCard')];
      candidates.forEach(card => {
        const status = card.querySelector('.dvOrderStatus');
        card.hidden = !!status?.classList.contains('completed') || !!status?.classList.contains('cancelled');
      });
    } else if (view === 'swaps') {
      candidates = [...grid.querySelectorAll('.dvSwapCard')];
      candidates.forEach(card => {
        const status = card.querySelector('.dvSwapStatus');
        card.hidden = ['completed', 'withdrawn', 'declined'].some(name => status?.classList.contains(name));
      });
    } else if (view === 'swap_cases') {
      candidates = [...grid.querySelectorAll('.dvSwapProblemCase')];
      candidates.forEach(card => {
        const eyebrow = text(card.querySelector('.eyebrow')?.textContent);
        card.hidden = !eyebrow.includes('open');
      });
    }
    if (candidates.length) ensureActiveEmpty(view, candidates.filter(card => !card.hidden).length);
  }

  function queueActiveFilter() {
    if (filterQueued) return;
    filterQueued = true;
    Promise.resolve().then(applyActiveFilters);
  }

  function install() {
    if (installed) return true;
    if (typeof db === 'undefined' || typeof user === 'undefined' || !user || !document.querySelector('.dvTradeSecondary')) return false;
    installed = true;
    style();
    enhanceSearch();
    addArchiveButton();

    const app = document.getElementById('app');
    const grid = document.getElementById('grid');
    if (app) new MutationObserver(() => {
      if (app.dataset.tradeView === 'archive') setHeroArchive();
      else queueActiveFilter();
    }).observe(app, {attributes: true, attributeFilter: ['data-trade-view']});
    if (grid) new MutationObserver(queueActiveFilter).observe(grid, {childList: true, subtree: true});
    queueActiveFilter();

    window.DV_TRADE_SEARCH_ARCHIVE = {
      version: '1.0',
      refreshArchive: renderArchive,
      refreshActive: applyActiveFilters
    };
    return true;
  }

  let tries = 0;
  const timer = setInterval(() => {
    tries += 1;
    if (install() || tries > 180) clearInterval(timer);
  }, 100);
})();
