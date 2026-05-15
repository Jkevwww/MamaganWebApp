// Skeleton loading utility — styles from /css/style.css (.skeleton, .skeleton-line, …)

(function () {
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

  function renderFacilityCardSkeleton() {
    const card = el('div', 'facility-card skeleton-card');

    const img = el('div', 'skeleton skeleton-img');
    img.setAttribute('aria-hidden', 'true');

    const body = el('div', 'card-body');
    body.appendChild(el('div', 'skeleton skeleton-line', { style: 'height:16px; width: 70%; margin-top: 2px;' }));
    body.appendChild(el('div', 'skeleton skeleton-line', { style: 'height:12px; width: 55%;' }));
    body.appendChild(el('div', 'skeleton skeleton-line', { style: 'height:12px; width: 45%;' }));
    body.appendChild(el('div', 'skeleton skeleton-line', { style: 'height:12px; width: 95%;' }));
    body.appendChild(el('div', 'skeleton skeleton-line', { style: 'height:12px; width: 80%;' }));

    const footerBtn = el('div', 'skeleton skeleton-button', { style: 'height: 40px; width: 100%; margin-top: 10px;' });
    footerBtn.setAttribute('aria-hidden', 'true');
    card.appendChild(img);
    card.appendChild(body);
    card.appendChild(footerBtn);
    return card;
  }

  function renderFacilityGridSkeleton(gridEl, count = 6) {
    clear(gridEl);
    const frag = document.createDocumentFragment();
    for (let i = 0; i < count; i++) frag.appendChild(renderFacilityCardSkeleton());
    gridEl.appendChild(frag);
  }

  function renderTableSkeleton(tbodyEl, columns = 5, rows = 6) {
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

  function renderStatSkeleton(container, count = 4) {
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

  window.Skeleton = {
    renderFacilityGridSkeleton,
    renderTableSkeleton,
    renderStatSkeleton,
    clear,
  };
})();
