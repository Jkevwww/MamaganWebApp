// Skeleton loading utility
// Safe to import on pages that may not use it.
// Provides lightweight shimmer placeholders without external deps.

(function () {
  function ensureStylesInjected() {
    if (document.getElementById('skeleton-style-injected')) return;

    const style = document.createElement('style');
    style.id = 'skeleton-style-injected';
    style.textContent = `
      .skeleton { position: relative; overflow: hidden; background: rgba(148,163,184,.25); border-radius: 10px; }
      .skeleton::after { content: ''; position: absolute; inset: 0; transform: translateX(-100%); background: linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,.35) 50%, rgba(255,255,255,0) 100%); animation: skeleton-shimmer 1.2s ease-in-out infinite; }
      @keyframes skeleton-shimmer { 0% { transform: translateX(-100%);} 100% { transform: translateX(100%);} }
      .skeleton-line { height: 12px; margin: 8px 0; border-radius: 8px; }
      .skeleton-img { height: 180px; width: 100%; border-radius: 0; }
      .skeleton-card { background:#fff; border-radius:10px; box-shadow: 0 2px 12px rgba(0,0,0,.07); }
      .skeleton-table-row { height: 34px; border-radius: 8px; }
    `;

    document.head.appendChild(style);
  }

  function el(tag, className, attrs = {}, text = '') {
    const node = document.createElement(tag);
    if (className) node.className = className;
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    if (text) node.textContent = text;
    return node;
  }

  function clear(elm) {
    if (!elm) return;
    while (elm.firstChild) elm.removeChild(elm.firstChild);
  }

  // Facility card skeleton
  function renderFacilityCardSkeleton() {
    const card = el('div', 'facility-card skeleton-card');

    // keep same internal structure as facilities cards
    const img = el('div', 'skeleton skeleton-img');
    img.setAttribute('aria-hidden', 'true');

    const body = el('div', 'card-body');
    body.appendChild(el('div', 'skeleton skeleton-line', { style: 'height:16px; width: 70%; margin-top: 2px;' }));
    body.appendChild(el('div', 'skeleton skeleton-line', { style: 'height:12px; width: 55%;' }));
    body.appendChild(el('div', 'skeleton skeleton-line', { style: 'height:12px; width: 45%;' }));
    body.appendChild(el('div', 'skeleton skeleton-line', { style: 'height:12px; width: 95%;' }));
    body.appendChild(el('div', 'skeleton skeleton-line', { style: 'height:12px; width: 80%;' }));

    const footerBtn = el('div', 'skeleton', { style: 'height: 40px; width: 100%; border-radius: 8px; margin-top: 10px;' });
    footerBtn.setAttribute('aria-hidden', 'true');
    card.appendChild(img);
    card.appendChild(body);
    card.appendChild(footerBtn);
    return card;
  }

  function renderFacilityGridSkeleton(gridEl, count = 6) {
    ensureStylesInjected();
    clear(gridEl);
    const frag = document.createDocumentFragment();
    for (let i = 0; i < count; i++) frag.appendChild(renderFacilityCardSkeleton());
    gridEl.appendChild(frag);
  }

  // Table skeleton (generic rows)
  function renderTableSkeleton(tbodyEl, columns = 5, rows = 6) {
    ensureStylesInjected();
    clear(tbodyEl);
    for (let i = 0; i < rows; i++) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = columns;
      td.style.padding = '10px 12px';

      const row = el('div', 'skeleton skeleton-table-row');
      row.setAttribute('aria-hidden', 'true');
      td.appendChild(row);
      tr.appendChild(td);
      tbodyEl.appendChild(tr);
    }
  }

  // Stat card skeleton
  function renderStatSkeleton(container, count = 4) {
    ensureStylesInjected();
    if (!container) return;
    container.innerHTML = '';
    const frag = document.createDocumentFragment();
    for (let i = 0; i < count; i++) {
      const card = document.createElement('div');
      card.className = 'stat-card';

      const label = document.createElement('div');
      label.className = 'skeleton skeleton-line';
      label.style.height = '12px';
      label.style.width = '55%';

      const value = document.createElement('div');
      value.className = 'skeleton skeleton-line';
      value.style.height = '22px';
      value.style.width = '70%';

      card.appendChild(label);
      card.appendChild(value);
      frag.appendChild(card);
    }
    container.appendChild(frag);
  }

  // Expose globally
  window.Skeleton = {
    renderFacilityGridSkeleton,
    renderTableSkeleton,
    renderStatSkeleton,
    clear,
  };
})();

