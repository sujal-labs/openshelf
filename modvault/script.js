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
    Shooter: 'var(--accent-pink)',
    Adventure: 'var(--accent-purple)',
    Casual: 'var(--accent-cyan)',
    Horror: 'var(--accent-crimson)',
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

  const ICONS = {
    download: '<svg viewBox="0 0 24 24"><path d="M12 3v12"/><path d="M7 11l5 5 5-5"/><path d="M5 21h14"/></svg>',
    bolt: '<svg class="link-icon" viewBox="0 0 24 24"><path d="M13 2 4 14h6l-1 8 9-12h-6z"/></svg>',
    server: '<svg class="link-icon" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="6" rx="1.5"/><rect x="3" y="14" width="18" height="6" rx="1.5"/><line x1="7" y1="7" x2="7" y2="7"/><line x1="7" y1="17" x2="7" y2="17"/></svg>',
    plane: '<svg class="link-icon" viewBox="0 0 24 24"><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4 20-7z"/></svg>',
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
          <span class="version-tag">${escapeHtml(app.version)}</span>
          ${tags ? `<div class="card-tags">${tags}</div>` : ''}
        </div>
        <button type="button" class="download-btn" data-id="${escapeHtml(app.id)}" aria-haspopup="dialog">
          Download ${ICONS.download}
        </button>
      </article>
    `;
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
    el.resultsMeta.textContent = `${filtered.length} mod${filtered.length === 1 ? '' : 's'} found`;

    if (filtered.length === 0) {
      el.grid.innerHTML = '';
      el.emptyState.hidden = false;
    } else {
      el.emptyState.hidden = true;
      el.grid.innerHTML = filtered.map(cardTemplate).join('');
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
    const icon = variant === 'primary' ? ICONS.bolt : link.type === 'telegram' ? ICONS.plane : ICONS.server;
    const cls = variant === 'primary' ? 'is-primary' : link.type === 'telegram' ? 'is-telegram' : 'is-mirror';
    return `<a class="link-btn ${cls}" href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer">${icon}<span>${escapeHtml(link.label)}</span></a>`;
  }

  function openModal(appId) {
    const app = state.apps.find((a) => a.id === appId);
    if (!app) return;

    lastFocusedEl = document.activeElement;

    el.modalIcon.innerHTML = iconMarkup(app);
    el.modalTitle.textContent = app.title;
    el.modalMeta.textContent = [app.version, app.category, app.size].filter(Boolean).join(' • ');
    el.modalDesc.textContent = app.description || '';

    const links = [];
    if (app.downloads && app.downloads.primary) links.push(linkButton(app.downloads.primary, 'primary'));
    (app.downloads && app.downloads.mirrors ? app.downloads.mirrors : []).forEach((m) => links.push(linkButton(m, 'mirror')));
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

  el.resultsMeta.textContent = 'Loading mods…';

  fetch('apps.json')
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then((data) => {
      state.apps = Array.isArray(data) ? data : [];
      buildCategoryTabs();
      render();
    })
    .catch(() => {
      el.resultsMeta.textContent = '';
      el.loadError.hidden = false;
    });
})();
