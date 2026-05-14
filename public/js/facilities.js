/* ─── facilities.js ─────────────────────────────────────────────────────────── */

let user = null;
const skeleton = window.Skeleton;

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
  const minPrice = document.getElementById('filterMinPrice').value;
  const maxPrice = document.getElementById('filterMaxPrice').value;
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
      grid.innerHTML = '<div class="text-center" style="grid-column: 1/-1; padding: 3rem;"><p style="color:#777;">No facilities match your criteria.</p></div>';
      return;
    }

    grid.innerHTML = facilities.map((f) => `
      <div class="facility-card ${!f.is_bookable ? 'is-loading' : ''}">
        <img src="${f.image_url || 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=400&q=80'}" alt="${f.name}" loading="lazy" />
        <div class="card-body">
          <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <h3 style="margin:0;">${escHtml(f.name)}</h3>
            <span class="badge" style="background: #f1f5f9; color: #64748b;">${f.size}</span>
          </div>
          <p class="meta" style="margin-top:0.5rem; height: 3rem; overflow: hidden; text-overflow: ellipsis;">${escHtml(f.description || 'Experience the beauty of Mamagan.')}</p>
          <p class="price" style="margin-bottom:0.5rem;">
            ₱${Number(f.price_min).toLocaleString()}${f.price_max > f.price_min ? ' - ₱' + Number(f.price_max).toLocaleString() : ''}
            <small style="color:#777; font-weight:normal;"> / ${f.rental_type === 'FIXED' ? 'session' : f.rental_type === 'DAILY' ? 'day' : 'hour'}</small>
          </p>
          <div style="margin-bottom: 1rem; display:flex; gap:0.5rem; flex-wrap:wrap;">
             <span class="badge ${f.is_available && f.is_bookable ? 'badge-available' : 'badge-unavailable'}">
              ${f.is_available && f.is_bookable ? 'Available' : 'Unavailable'}
            </span>
            <span class="badge" style="background:#fff7ed; color:#9a3412;"><i data-lucide="users" style="width:12px; height:12px; vertical-align:middle;"></i> ${f.capacity_min}-${f.capacity_max} pax</span>
            <span class="badge" style="background:#f0f9ff; color:#0369a1;"><i data-lucide="package" style="width:12px; height:12px; vertical-align:middle;"></i> ${f.units} units</span>
          </div>
          
          ${!f.is_bookable ? `<p style="color:var(--error); font-size:0.8rem; margin-bottom:1rem;">${f.unavailable_reason || 'Not bookable'}</p>` : ''}

          <a href="/booking.html?id=${f.id}" class="btn ${f.is_bookable ? 'btn-primary' : 'btn-secondary'} btn-block" ${!f.is_bookable ? 'style="pointer-events:none; opacity:0.5;"' : ''}>
            ${f.is_bookable ? 'Book Now' : 'Currently Unavailable'}
          </a>
        </div>
      </div>
    `).join('');
    
    if (window.lucide) lucide.createIcons();

  } catch (err) {
    grid.innerHTML = `<div class="text-center" style="grid-column: 1/-1; padding: 3rem;"><p style="color:#c62828;">Error: ${err.message}</p></div>`;
  }
}

// ─── Event Listeners ────────────────────────────────────────────────────────

document.getElementById('applyFilters').addEventListener('click', loadFacilities);
document.getElementById('resetFilters').addEventListener('click', () => {
  document.getElementById('filterCategory').value = '';
  document.getElementById('filterCapacity').value = '';
  document.getElementById('filterMinPrice').value = '';
  document.getElementById('filterMaxPrice').value = '';
  document.getElementById('searchInput').value = '';
  loadFacilities();
});

let searchTimeout;
document.getElementById('searchInput').addEventListener('input', () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(loadFacilities, 300);
});

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
