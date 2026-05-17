let user = null;
const skeleton = window.Skeleton;
let activeReviewFacility = null;

function showPageMessageFromQuery() {
  const alertEl = document.getElementById('pageAlert');
  if (!alertEl) return;
  const params = new URLSearchParams(window.location.search);
  if (params.get('error') === 'admin_permission') {
    alertEl.textContent = 'You do not have permission to access the admin panel.';
    alertEl.className = 'alert alert-error show';
  }
}

async function checkAuth() {
  try {
    const res = await fetch('/api/auth/me');
    if (res.ok) {
      user = await res.json();
      const navUserEl = document.getElementById('navUser');
      if (navUserEl && user?.name) navUserEl.textContent = user.name;

      document.querySelectorAll('.auth-only').forEach((el) => { el.style.display = 'inline-block'; });
      document.querySelectorAll('.guest-only').forEach((el) => { el.style.display = 'none'; });
      const logoutBtn = document.getElementById('navLogout');
      if (logoutBtn) logoutBtn.style.display = 'inline-block';
    } else {
      document.querySelectorAll('.auth-only').forEach((el) => { el.style.display = 'none'; });
      document.querySelectorAll('.guest-only').forEach((el) => { el.style.display = 'inline-block'; });
    }
  } catch (_) {
    // ignore
  }
}

async function loadFacilities() {
  const grid = document.getElementById('facilityGrid');
  if (grid && skeleton?.renderFacilityGridSkeleton) {
    skeleton.renderFacilityGridSkeleton(grid, 6);
  }

  const category = document.getElementById('filterCategory').value;
  const capacity = document.getElementById('filterCapacity').value;
  const { minPrice, maxPrice } = getSelectedPriceRange();
  const search = document.getElementById('searchInput').value.toLowerCase();

  let url = '/api/facilities?';
  if (category) url += `category=${encodeURIComponent(category)}&`;
  if (capacity) url += `capacity=${encodeURIComponent(capacity)}&`;
  if (minPrice) url += `min_price=${encodeURIComponent(minPrice)}&`;
  if (maxPrice) url += `max_price=${encodeURIComponent(maxPrice)}&`;

  try {
    const res = await fetch(url);
    let facilities = await res.json();

    if (!res.ok) throw new Error('Failed to load facilities');

    if (search) {
      facilities = facilities.filter((f) =>
        String(f.name || '').toLowerCase().includes(search)
        || String(f.description || '').toLowerCase().includes(search));
    }

    if (!facilities.length) {
      grid.innerHTML = '<div class="text-center empty-state-spacious"><p class="text-muted-small">No facilities match your criteria.</p></div>';
      return;
    }

    grid.innerHTML = facilities.map(renderFacilityCard).join('');

    if (window.lucide) lucide.createIcons();
  } catch (err) {
    grid.innerHTML = `<div class="text-center empty-state-spacious"><p class="text-danger">Error: ${escHtml(err.message)}</p></div>`;
  }
}

function renderFacilityCard(f) {
  const priceMin = Number(f.price_min || 0);
  const priceMax = Number(f.price_max || priceMin);
  const priceText = `PHP ${priceMin.toLocaleString()}${priceMax > priceMin ? ` - PHP ${priceMax.toLocaleString()}` : ''}`;
  return `
    <div class="facility-card ${!f.bookable ? 'is-loading' : ''}">
      <img src="${escAttr(f.image_url || 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=400&q=80')}" alt="${escAttr(f.name)}" loading="lazy" />
      <div class="card-body">
        <div class="facility-card-header-row">
          <h3 class="facility-card-heading">${escHtml(f.name)}</h3>
          <span class="badge badge-muted">${prettyCategory(f.category)}</span>
        </div>
        <p class="meta facility-description-clamp">${escHtml(f.description || 'Experience the beauty of Mamagan.')}</p>
        <p class="price facility-price">
          ${priceText}
          <small class="muted-normal"> / ${f.rental_type === 'FIXED' ? 'session' : f.rental_type === 'DAILY' ? 'day' : 'hour'}</small>
        </p>
        <div class="facility-review-strip">
          <div class="facility-rating-summary" aria-label="${escAttr(reviewLabel(f))}">
            <span class="facility-stars">${starText(f.average_rating)}</span>
            <strong>${f.average_rating ? Number(f.average_rating).toFixed(1) : 'New'}</strong>
            <span>${Number(f.review_count || 0).toLocaleString()} review${Number(f.review_count || 0) === 1 ? '' : 's'}</span>
          </div>
          ${renderReviewSnippets(f.latest_reviews || [])}
        </div>
        <div class="facility-badge-row">
          <span class="badge ${f.active && f.bookable ? 'badge-available' : 'badge-unavailable'}">
            ${f.active && f.bookable ? 'Available' : 'Unavailable'}
          </span>
          ${f.capacity_max ? `<span class="badge badge-warm"><i class="icon-xxs" data-lucide="users"></i> ${f.capacity_min || 1}-${f.capacity_max} pax</span>` : ''}
          <span class="badge badge-info"><i class="icon-xxs" data-lucide="package"></i> ${f.inventory_count} units</span>
        </div>

        ${!f.bookable ? `<p class="text-error-small">${escHtml(f.unavailable_reason || 'Not bookable')}</p>` : ''}

        <div class="facility-card-actions">
          <a href="/booking.html?id=${encodeURIComponent(f.id)}" class="btn ${f.bookable ? 'btn-primary' : 'btn-secondary'} btn-block ${!f.bookable ? 'facility-card-disabled' : ''}">
            ${f.bookable ? 'Book Now' : 'Currently Unavailable'}
          </a>
          <button type="button" class="btn btn-outline btn-block facility-review-btn" data-facility-id="${escAttr(f.id)}" data-facility-name="${escAttr(f.name)}">
            <i class="icon-xs-inline" data-lucide="star"></i> Review
          </button>
        </div>
      </div>
    </div>
  `;
}

function prettyCategory(cat) {
  const map = {
    COTTAGE: 'Cottage',
    CABANA: 'Cabana',
    BEACH_EQUIPMENT: 'Equipment',
  };
  return map[cat] || cat;
}

function getSelectedPriceRange() {
  const value = document.getElementById('filterPriceRange')?.value || '';
  if (!value) return { minPrice: '', maxPrice: '' };
  const [min, max] = value.split('-');
  return {
    minPrice: min || '',
    maxPrice: max || '',
  };
}

function closeFiltersPanel() {
  const panel = document.getElementById('filtersPanel');
  const toggle = document.getElementById('filterToggle');
  if (!panel || !toggle) return;
  panel.classList.remove('open');
  toggle.setAttribute('aria-expanded', 'false');
}

function showReviewAlert(message, type = 'error') {
  const el = document.getElementById('reviewAlert');
  if (!el) return;
  el.textContent = message;
  el.className = `alert alert-${type} show`;
}

function hideReviewAlert() {
  const el = document.getElementById('reviewAlert');
  if (!el) return;
  el.className = 'alert alert-error';
  el.textContent = '';
}

function setReviewLoading(isLoading) {
  const btn = document.getElementById('submitReviewBtn');
  if (!btn) return;
  btn.disabled = isLoading;
  btn.textContent = isLoading ? 'Submitting...' : 'Submit Review';
}

function openReviewModal(facilityId, facilityName) {
  activeReviewFacility = { id: facilityId, name: facilityName };
  hideReviewAlert();
  document.getElementById('reviewForm')?.reset();
  document.getElementById('reviewFacilityId').value = facilityId;
  document.getElementById('reviewModalTitle').textContent = `Review ${facilityName}`;
  document.getElementById('reviewModalSubtitle').textContent = 'Only guests with a paid or approved booking can post a review.';
  const modal = document.getElementById('reviewModal');
  modal?.classList.add('open');
  modal?.setAttribute('aria-hidden', 'false');
  loadFacilityReviews(facilityId).catch((err) => showReviewAlert(err.message));
  document.getElementById('reviewComment')?.focus();
  if (window.lucide) lucide.createIcons();
}

function closeReviewModal() {
  const modal = document.getElementById('reviewModal');
  modal?.classList.remove('open');
  modal?.setAttribute('aria-hidden', 'true');
  activeReviewFacility = null;
}

async function loadFacilityReviews(facilityId) {
  const list = document.getElementById('reviewList');
  if (list) list.innerHTML = '<p class="text-muted-small">Loading reviews...</p>';
  const res = await fetch(`/api/facilities/${encodeURIComponent(facilityId)}/reviews`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Unable to load reviews');
  renderReviewList(data.reviews || []);
}

function renderReviewList(reviews) {
  const list = document.getElementById('reviewList');
  if (!list) return;
  if (!reviews.length) {
    list.innerHTML = '<p class="text-muted-small">No reviews yet.</p>';
    return;
  }
  list.innerHTML = reviews.map((review) => `
    <article class="review-item">
      <div class="review-item-header">
        <strong>${escHtml(review.user_name || 'Guest')}</strong>
        <span class="facility-stars">${starText(review.rating)}</span>
      </div>
      <p>${escHtml(review.comment || '')}</p>
      ${renderReviewMedia(review.media || [])}
    </article>
  `).join('');
}

function renderReviewMedia(media) {
  if (!media.length) return '';
  return `
    <div class="review-media-grid">
      ${media.map((item) => item.type === 'video'
        ? `<video src="${escAttr(item.url)}" controls preload="metadata"></video>`
        : `<img src="${escAttr(item.url)}" alt="Review upload" loading="lazy">`).join('')}
    </div>
  `;
}

async function submitReview(event) {
  event.preventDefault();
  hideReviewAlert();
  const facilityId = document.getElementById('reviewFacilityId').value;
  const rating = document.getElementById('reviewRating').value;
  const comment = document.getElementById('reviewComment').value.trim();
  const files = Array.from(document.getElementById('reviewMedia').files || []);

  if (!rating || (!comment && !files.length)) {
    showReviewAlert('Add a rating and a comment or photo/video.');
    return;
  }
  if (files.length > 6) {
    showReviewAlert('You can upload up to 6 files.');
    return;
  }

  const body = new FormData();
  body.append('rating', rating);
  body.append('comment', comment);
  files.forEach((file) => body.append('media', file));

  setReviewLoading(true);
  try {
    const res = await fetch(`/api/facilities/${encodeURIComponent(facilityId)}/reviews`, {
      method: 'POST',
      credentials: 'same-origin',
      body,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Unable to submit review');
    showReviewAlert('Review submitted.', 'success');
    document.getElementById('reviewForm')?.reset();
    await loadFacilityReviews(facilityId);
    await loadFacilities();
  } catch (err) {
    showReviewAlert(err.message);
  } finally {
    setReviewLoading(false);
  }
}

function starText(value) {
  const rating = Math.round(Number(value || 0));
  return `${'★'.repeat(rating)}${'☆'.repeat(Math.max(0, 5 - rating))}`;
}

function reviewLabel(facility) {
  const count = Number(facility.review_count || 0);
  return count ? `${Number(facility.average_rating || 0).toFixed(1)} out of 5 from ${count} reviews` : 'No reviews yet';
}

function renderReviewSnippets(reviews) {
  if (!reviews.length) return '<p class="facility-review-empty">No guest reviews yet.</p>';
  return `
    <div class="facility-review-snippets">
      ${reviews.map((review) => `
        <p><strong>${escHtml(review.user_name || 'Guest')}:</strong> ${escHtml(review.comment || 'Shared a rating.').slice(0, 90)}</p>
      `).join('')}
    </div>
  `;
}

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escAttr(str) {
  return escHtml(str).replace(/'/g, '&#39;');
}

showPageMessageFromQuery();
checkAuth();
loadFacilities();

document.getElementById('navLogout')?.addEventListener('click', async (e) => {
  e.preventDefault();
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } catch (_) {}
  localStorage.clear();
  window.location.replace('/');
});

document.getElementById('applyFilters')?.addEventListener('click', () => {
  closeFiltersPanel();
  loadFacilities();
});

document.getElementById('resetFilters')?.addEventListener('click', () => {
  document.getElementById('filterCategory').value = '';
  document.getElementById('filterCapacity').value = '';
  document.getElementById('filterPriceRange').value = '';
  document.getElementById('searchInput').value = '';
  closeFiltersPanel();
  loadFacilities();
});

const filterToggle = document.getElementById('filterToggle');
const filtersPanel = document.getElementById('filtersPanel');
if (filterToggle && filtersPanel) {
  filterToggle.addEventListener('click', () => {
    const isOpen = filtersPanel.classList.toggle('open');
    filterToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  });

  document.addEventListener('click', (event) => {
    if (!filtersPanel.classList.contains('open')) return;
    if (filtersPanel.contains(event.target) || filterToggle.contains(event.target)) return;
    closeFiltersPanel();
  });
}

let searchTimeout;
document.getElementById('searchInput')?.addEventListener('input', () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(loadFacilities, 300);
});

document.getElementById('facilityGrid')?.addEventListener('click', (event) => {
  const button = event.target.closest('.facility-review-btn');
  if (!button) return;
  if (!user) {
    window.location.href = `/login.html?next=${encodeURIComponent('/facilities.html')}`;
    return;
  }
  openReviewModal(button.dataset.facilityId, button.dataset.facilityName);
});

document.getElementById('closeReviewModal')?.addEventListener('click', closeReviewModal);
document.getElementById('cancelReviewBtn')?.addEventListener('click', closeReviewModal);
document.getElementById('reviewModal')?.addEventListener('click', (event) => {
  if (event.target?.id === 'reviewModal') closeReviewModal();
});
document.getElementById('reviewForm')?.addEventListener('submit', submitReview);
