(function () {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* State + DOM refs                                                   */
  /* ------------------------------------------------------------------ */

  const state = {
    apps: [],
    query: '',
    category: 'All',
  };

  /* In-grid "native" ad slot: shows one ad card every AD_EVERY_N cards.
     Set enabled: false to turn it off entirely. Only shown while there
     are enough results to make an ad card feel native rather than filler. */
  const AD_CONFIG = {
    enabled: true,
    everyNCards: 6,
  };

  const el = {
    grid: document.getElementById('appGrid'),
    tabs: document.getElementById('categoryTabs'),
    search: document.getElementById('searchInput'),
    resultsMeta: document.getElementById('resultsMeta'),
    emptyState: document.getElementById('emptyState'),
    loadError: document.getElementById('loadError'),
    modalOverlay: document.getElementById('modalOverlay'),
    modalClose: document.getElementById('modalClose'),
    modalIcon: document.getElementById('modalIcon'),
    modalTitle: document.getElementById('modalTitle'),
    modalMeta: document.getElementById('modalMeta'),
    modalDesc: document.getElementById('modalDesc'),
    modalLinks: document.getElementById('modalLinks'),
  };

  let lastFocusedEl = null;

  /* ------------------------------------------------------------------ */
  /* Category colour mapping (dynamic categories fall back gracefully)  */
  /* ------------------------------------------------------------------ */

  const CATEGORY_COLORS = {
    Productivity: 'var(--accent-cyan)',
    Media: 'var(--accent-purple)',
    Navigation: 'var(--accent-gold)',
  };
  const FALLBACK_COLORS = ['var(--accent-gold)', 'var(--accent-cyan)', 'var(--accent-purple-soft)', 'var(--accent-pink-soft)'];

  function colorForCategory(category) {
    if (CATEGORY_COLORS[category]) return CATEGORY_COLORS[category];
    const hash = Array.from(category || '').reduce((a, c) => a + c.charCodeAt(0), 0);
    return FALLBACK_COLORS[hash % FALLBACK_COLORS.length];
  }

  const ICON_GRADIENTS = [
    ['#ff3d81', '#9b5cff'],
    ['#2fe0d4', '#9b5cff'],
    ['#ff5470', '#ffb85c'],
    ['#9b5cff', '#2fe0d4'],
  ];

  function gradientForString(str) {
    const hash = Array.from(str || '?').reduce((a, c) => a + c.charCodeAt(0), 0);
    const pair = ICON_GRADIENTS[hash % ICON_GRADIENTS.length];
    return `linear-gradient(135deg, ${pair[0]}, ${pair[1]})`;
  }

  /* ------------------------------------------------------------------ */
  /* Small helpers                                                      */
  /* ------------------------------------------------------------------ */

  function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  window.handleIconError = function (img) {
    const wrap = img.parentElement;
    if (!wrap) return;
    const title = img.dataset.title || '?';
    const letter = title.trim().charAt(0).toUpperCase() || '?';
    wrap.innerHTML = `<div class="icon-fallback" style="background:${gradientForString(title)}">${escapeHtml(letter)}</div>`;
  };

  function iconMarkup(app) {
    if (app.icon) {
      return `<img src="${escapeHtml(app.icon)}" alt="" data-title="${escapeHtml(app.title)}" onerror="handleIconError(this)">`;
    }
    return `<div class="icon-fallback" style="background:${gradientForString(app.title)}">${escapeHtml((app.title || '?').charAt(0).toUpperCase())}</div>`;
  }

  function formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  const ICONS = {
    download: '<svg viewBox="0 0 24 24"><path d="M12 3v12"/><path d="M7 11l5 5 5-5"/><path d="M5 21h14"/></svg>',
    bolt: '<svg class="link-icon" viewBox="0 0 24 24"><path d="M13 2 4 14h6l-1 8 9-12h-6z"/></svg>',
    server: '<svg class="link-icon" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="6" rx="1.5"/><rect x="3" y="14" width="18" height="6" rx="1.5"/><line x1="7" y1="7" x2="7" y2="7"/><line x1="7" y1="17" x2="7" y2="17"/></svg>',
    plane: '<svg class="link-icon" viewBox="0 0 24 24"><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4 20-7z"/></svg>',
    youtube: '<svg class="link-icon" viewBox="0 0 24 24"><path d="M23 12s0-3-0.4-4.4a2.8 2.8 0 0 0-2-2C19.2 5 12 5 12 5s-7.2 0-8.6.6a2.8 2.8 0 0 0-2 2C1 9 1 12 1 12s0 3 .4 4.4a2.8 2.8 0 0 0 2 2C4.8 19 12 19 12 19s7.2 0 8.6-.6a2.8 2.8 0 0 0 2-2C23 15 23 12 23 12Z"/><path d="m10 9 5 3-5 3z" fill="currentColor"/></svg>'
  };

  /* ------------------------------------------------------------------ */
  /* Rendering                                                           */
  /* ------------------------------------------------------------------ */

  function cardTemplate(app) {
    const tags = (app.tags || []).map((t) => `<span class="tag-chip">${escapeHtml(t)}</span>`).join('');
    return `
      <article class="app-card">
        <div class="card-top">
          <div class="card-icon-wrap">${iconMarkup(app)}</div>
          <span class="badge" data-cat="${escapeHtml(app.category)}" style="--cat-color:${colorForCategory(app.category)}">${escapeHtml(app.category)}</span>
        </div>
        <div class="card-body">
          <h3 class="card-title">${escapeHtml(app.title)}</h3>
          <span class="version-tag">${escapeHtml(app.version)}${app.releaseDate ? ` · ${escapeHtml(formatDate(app.releaseDate))}` : ''}</span>
          ${tags ? `<div class="card-tags">${tags}</div>` : ''}
        </div>
        <button type="button" class="download-btn" data-id="${escapeHtml(app.id)}" aria-haspopup="dialog">
          Download ${ICONS.download}
        </button>
      </article>
    `;
  }

  function adCardTemplate() {
    // Native in-grid ad slot, sized like an .app-card so it blends into the
    // grid instead of breaking the layout. Drop your ad network's snippet
    // (e.g. an AdSense in-feed unit, or an EthicalAds "fixed footer" unit
    // reused here) inside .ad-card-inner.
    return `
      <div class="ad-card" role="complementary" aria-label="Advertisement">
        <span class="ad-slot-label">Advertisement</span>
        <div class="ad-card-inner">
          <!-- ad network snippet goes here -->
        </div>
      </div>
    `;
  }

  function withAdsInterleaved(cardsHtml) {
    if (!AD_CONFIG.enabled || cardsHtml.length <= AD_CONFIG.everyNCards) return cardsHtml;
    const out = [];
    cardsHtml.forEach((html, i) => {
      out.push(html);
      if ((i + 1) % AD_CONFIG.everyNCards === 0 && i !== cardsHtml.length - 1) {
        out.push(adCardTemplate());
      }
    });
    return out;
  }

  function filteredApps() {
    const q = state.query.toLowerCase();
    return state.apps.filter((app) => {
      const matchesCategory = state.category === 'All' || app.category === state.category;
      const matchesQuery = !q || app.title.toLowerCase().includes(q);
      return matchesCategory && matchesQuery;
    });
  }

  function render() {
    const filtered = filteredApps();
    el.resultsMeta.textContent = `${filtered.length} app${filtered.length === 1 ? '' : 's'} found`;

    if (filtered.length === 0) {
      el.grid.innerHTML = '';
      el.emptyState.hidden = false;
    } else {
      el.emptyState.hidden = true;
      const cards = filtered.map(cardTemplate);
      el.grid.innerHTML = withAdsInterleaved(cards).join('');
    }
  }

  function buildCategoryTabs() {
    const categories = Array.from(new Set(state.apps.map((a) => a.category))).sort();
    const all = ['All', ...categories];
    el.tabs.innerHTML = all
      .map((c, i) => `<button type="button" class="tab-btn${i === 0 ? ' is-active' : ''}" data-category="${escapeHtml(c)}">${escapeHtml(c)}</button>`)
      .join('');
  }

  /* ------------------------------------------------------------------ */
  /* Modal                                                               */
  /* ------------------------------------------------------------------ */

  function linkButton(link, variant) {
    let icon = ICONS.server;
    let cls = 'is-mirror';

    if (variant === 'tutorial') {
      icon = ICONS.youtube;
      cls = 'is-youtube';
    } else if (variant === 'primary') {
      icon = ICONS.bolt;
      cls = 'is-primary';
    } else if (link.type === 'telegram') {
      icon = ICONS.plane;
      cls = 'is-telegram';
    }

    return `
      <a class="link-btn ${cls}"
         href="${escapeHtml(link.url)}"
         target="_blank"
         rel="noopener noreferrer">
         ${icon}
         <span>${escapeHtml(link.label)}</span>
      </a>
    `;
  }

  function openModal(appId) {
    const app = state.apps.find((a) => a.id === appId);
    if (!app) return;

    lastFocusedEl = document.activeElement;

    el.modalIcon.innerHTML = iconMarkup(app);
    el.modalTitle.textContent = app.title;
    el.modalMeta.textContent = [app.version, app.category, app.size, app.license].filter(Boolean).join(' • ');
    el.modalDesc.textContent = app.description || '';

    // Order: YouTube tutorial first, then primary download, then any mirrors.
    const links = [];

    if (app.downloads && app.downloads.tutorial) {
      links.push(
        linkButton({ label: '▶ Watch Tutorial', url: app.downloads.tutorial }, 'tutorial')
      );
    }

    if (app.downloads && app.downloads.primary) {
      links.push(linkButton(app.downloads.primary, 'primary'));
    }

    (app.downloads && app.downloads.mirrors ? app.downloads.mirrors : [])
      .forEach((m) => links.push(linkButton(m, 'mirror')));

    el.modalLinks.innerHTML = links.join('');

    el.modalOverlay.hidden = false;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => requestAnimationFrame(() => {
      el.modalOverlay.classList.add('is-open');
    }));
    el.modalClose.focus();
  }

  function closeModal() {
    el.modalOverlay.classList.remove('is-open');
    document.body.style.overflow = '';
    const done = () => { el.modalOverlay.hidden = true; };
    let handled = false;
    el.modalOverlay.addEventListener('transitionend', function handler() {
      handled = true;
      el.modalOverlay.removeEventListener('transitionend', handler);
      done();
    }, { once: true });
    setTimeout(() => { if (!handled) done(); }, 320);
    if (lastFocusedEl && typeof lastFocusedEl.focus === 'function') lastFocusedEl.focus();
  }

  /* ------------------------------------------------------------------ */
  /* Events                                                              */
  /* ------------------------------------------------------------------ */

  el.grid.addEventListener('click', (e) => {
    const btn = e.target.closest('.download-btn');
    if (btn) openModal(btn.dataset.id);
  });

  el.tabs.addEventListener('click', (e) => {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;
    state.category = btn.dataset.category;
    Array.from(el.tabs.children).forEach((b) => b.classList.toggle('is-active', b === btn));
    render();
  });

  let searchTimeout;
  el.search.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    const value = e.target.value;
    searchTimeout = setTimeout(() => {
      state.query = value.trim();
      render();
    }, 150);
  });

  el.modalClose.addEventListener('click', closeModal);
  el.modalOverlay.addEventListener('click', (e) => {
    if (e.target === el.modalOverlay) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !el.modalOverlay.hidden) closeModal();
  });

  /* ------------------------------------------------------------------ */
  /* Init                                                                */
  /* ------------------------------------------------------------------ */

  el.resultsMeta.textContent = 'Loading apps…';

  fetch('apps.json')
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then((data) => {
      state.apps = Array.isArray(data) ? data : [];
      // Newest release first.
      state.apps.sort((a, b) => new Date(b.releaseDate) - new Date(a.releaseDate));
      buildCategoryTabs();
      render();
    })
    .catch(() => {
      el.resultsMeta.textContent = '';
      el.loadError.hidden = false;
    });
})();
