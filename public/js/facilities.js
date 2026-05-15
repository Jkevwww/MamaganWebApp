/* ─── facilities.js ─────────────────────────────────────────────────────────── */

let user = null;
const skeleton = window.Skeleton;

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
      
      document.querySelectorAll('.auth-only').forEach(el => el.style.display = 'inline-block');
      document.querySelectorAll('.guest-only').forEach(el => el.style.display = 'none');
      const logoutBtn = document.getElementById('navLogout');
      if (logoutBtn) logoutBtn.style.display = 'inline-block';
    } else {
      document.querySelectorAll('.auth-only').forEach(el => el.style.display = 'none');
      document.querySelectorAll('.guest-only').forEach(el => el.style.display = 'inline-block');
    }
  } catch (_) {
    // ignore
  }
}

showPageMessageFromQuery();
checkAuth();

if (document.getElementById('navLogout')) {
  document.getElementById('navLogout').addEventListener('click', async (e) => {
    e.preventDefault();
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (_) {}
    localStorage.clear();
    window.location.replace('/');
  });
}

// ─── Load facilities with Filters ───────────────────────────────────────────

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
  if (category) url += `category=${category}&`;
  if (capacity) url += `capacity=${capacity}&`;
  if (minPrice) url += `min_price=${minPrice}&`;
  if (maxPrice) url += `max_price=${maxPrice}&`;

  try {
    const res = await fetch(url);
    let facilities = await res.json();

    if (!res.ok) throw new Error('Failed to load facilities');

    // Client-side search filter
    if (search) {
      facilities = facilities.filter(f => 
        f.name.toLowerCase().includes(search) || 
        f.description.toLowerCase().includes(search)
      );
    }

    if (facilities.length === 0) {
      grid.innerHTML = '<div class="text-center empty-state-spacious"><p class="text-muted-small">No facilities match your criteria.</p></div>';
      return;
    }

    grid.innerHTML = facilities.map((f) => `
      <div class="facility-card ${!f.bookable ? 'is-loading' : ''}">
        <img src="${f.image_url || 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=400&q=80'}" alt="${f.name}" loading="lazy" />
        <div class="card-body">
          <div class="facility-card-header-row">
            <h3 class="facility-card-heading">${escHtml(f.name)}</h3>
            <span class="badge badge-muted">${prettyCategory(f.category)}</span>
          </div>
          <p class="meta facility-description-clamp">${escHtml(f.description || 'Experience the beauty of Mamagan.')}</p>
          <p class="price facility-price">
            ₱${Number(f.price_min).toLocaleString()}${f.price_max > f.price_min ? ' - ₱' + Number(f.price_max).toLocaleString() : ''}
            <small class="muted-normal"> / ${f.rental_type === 'FIXED' ? 'session' : f.rental_type === 'DAILY' ? 'day' : 'hour'}</small>
          </p>
          <div class="facility-badge-row">
             <span class="badge ${f.active && f.bookable ? 'badge-available' : 'badge-unavailable'}">
              ${f.active && f.bookable ? 'Available' : 'Unavailable'}
            </span>
            ${f.capacity_max ? `<span class="badge badge-warm"><i class="icon-xxs" data-lucide="users"></i> ${f.capacity_min || 1}-${f.capacity_max} pax</span>` : ''}
            <span class="badge badge-info"><i class="icon-xxs" data-lucide="package"></i> ${f.inventory_count} units</span>
          </div>
          
          ${!f.bookable ? `<p class="text-error-small">${f.unavailable_reason || 'Not bookable'}</p>` : ''}

          <a href="/booking.html?id=${f.id}" class="btn ${f.bookable ? 'btn-primary' : 'btn-secondary'} btn-block ${!f.bookable ? 'facility-card-disabled' : ''}">
            ${f.bookable ? 'Book Now' : 'Currently Unavailable'}
          </a>
        </div>
      </div>
    `).join('');
    
    if (window.lucide) lucide.createIcons();

  } catch (err) {
    grid.innerHTML = `<div class="text-center empty-state-spacious"><p class="text-danger">Error: ${err.message}</p></div>`;
  }
}

// ─── Event Listeners ────────────────────────────────────────────────────────

document.getElementById('applyFilters').addEventListener('click', () => {
  closeFiltersPanel();
  loadFacilities();
});
document.getElementById('resetFilters').addEventListener('click', () => {
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
document.getElementById('searchInput').addEventListener('input', () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(loadFacilities, 300);
});

function prettyCategory(cat) {
  const map = {
    'COTTAGE': 'Cottage',
    'CABANA': 'Cabana',
    'BEACH_EQUIPMENT': 'Equipment'
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

// ─── Helpers ────────────────────────────────────────────────────────────────
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Init ────────────────────────────────────────────────────────────────────
loadFacilities();
