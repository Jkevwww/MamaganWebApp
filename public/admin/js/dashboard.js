/* ─── Admin Dashboard JS ────────────────────────────────────────────────────── */

const skeleton = window.Skeleton;
const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user') || '{}');

if (!token || user.role !== 'admin') {
  window.location.replace('/admin/login.html');
}

// Show logged-in admin name
const navUser = document.getElementById('navUser');
if (navUser) navUser.textContent = user.name || user.email || 'Admin';

// Logout
document.getElementById('logoutBtn').addEventListener('click', () => {
  localStorage.clear();
  window.location.replace('/admin/login.html');
});

const authHeader = { Authorization: `Bearer ${token}` };

// ─── Load Stats ─────────────────────────────────────────────────────────────
async function loadStats() {
  const statGrid = document.getElementById('statGrid');
  if (skeleton?.renderStatSkeleton && statGrid) {
    skeleton.renderStatSkeleton(statGrid, 4);
  }

  try {
    const res = await fetch('/api/admin/stats', { headers: authHeader });
    if (res.status === 401 || res.status === 403) {
      window.location.replace('/admin/login.html');
      return;
    }
    const data = await res.json();
    
    statGrid.innerHTML = `
      <div class="stat-card">
        <div class="stat-label">Total Users</div>
        <div class="stat-value">${data.totalUsers ?? 0}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total Facilities</div>
        <div class="stat-value">${data.totalFacilities ?? 0}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total Bookings</div>
        <div class="stat-value">${data.totalBookings ?? 0}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label" style="color: var(--orange);">Pending Bookings</div>
        <div class="stat-value">${data.pendingBookings ?? 0}</div>
      </div>
    `;

    const lastUpdated = document.getElementById('lastUpdated');
    if (lastUpdated) lastUpdated.textContent = 'Last updated: ' + new Date().toLocaleTimeString();

  } catch (err) {
    console.error('Stats error:', err.message);
  }
}

// ─── Load Bookings ───────────────────────────────────────────────────────────
async function loadBookings() {
  const tbody = document.getElementById('bookingsTbody');
  if (skeleton?.renderTableSkeleton && tbody) {
    skeleton.renderTableSkeleton(tbody, 7, 6);
  }

  try {
    const res = await fetch('/api/admin/bookings', { headers: authHeader });
    const bookings = await res.json();
    if (!res.ok) throw new Error('Failed to load bookings');

    if (bookings.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:2rem;">No bookings yet.</td></tr>';
      return;
    }

    tbody.innerHTML = bookings.map((b) => `
      <tr>
        <td>${b.id}</td>
        <td>
          <div style="font-weight:600;">${escHtml(b.user_name)}</div>
          <div style="font-size:0.75rem; color:#64748b;">${escHtml(b.user_email)}</div>
        </td>
        <td>${escHtml(b.facility)}</td>
        <td>${new Date(b.date).toLocaleDateString()}</td>
        <td>${b.start_time} – ${b.end_time}</td>
        <td><span class="status-badge status-${b.status}">${b.status}</span></td>
        <td>
          <div style="display:flex; gap:0.4rem;">
            ${b.status !== 'approved'
              ? `<button class="btn-sm btn-approve" onclick="updateBooking(${b.id}, 'approved')" title="Approve"><i data-lucide="check" style="width:14px;"></i></button> `
              : ''}
            ${b.status !== 'cancelled'
              ? `<button class="btn-sm btn-cancel" onclick="updateBooking(${b.id}, 'cancelled')" title="Cancel"><i data-lucide="x" style="width:14px;"></i></button>`
              : ''}
          </div>
        </td>
      </tr>
    `).join('');
    
    if (window.lucide) lucide.createIcons();
    
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" style="color:#c62828;text-align:center;padding:2rem;">${err.message}</td></tr>`;
  }
}

// ─── Update Booking Status ───────────────────────────────────────────────────
async function updateBooking(bookingId, status) {
  try {
    const res = await fetch(`/api/admin/bookings/${bookingId}`, {
      method: 'PATCH',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Update failed');
    loadBookings();
    loadStats();
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

// ─── Load Users ──────────────────────────────────────────────────────────────
async function loadUsers() {
  const tbody = document.getElementById('usersTbody');
  if (skeleton?.renderTableSkeleton && tbody) {
    skeleton.renderTableSkeleton(tbody, 5, 5);
  }

  try {
    const res = await fetch('/api/admin/users', { headers: authHeader });
    const users = await res.json();
    if (!res.ok) throw new Error('Failed to load users');

    if (users.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:2rem;">No users found.</td></tr>';
      return;
    }

    tbody.innerHTML = users.map((u) => `
      <tr>
        <td>${u.id}</td>
        <td>${escHtml(u.name)}</td>
        <td>${escHtml(u.email)}</td>
        <td><span class="status-badge ${u.role === 'admin' ? 'status-approved' : 'status-pending'}">${u.role}</span></td>
        <td>${new Date(u.created_at).toLocaleDateString()}</td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" style="color:#c62828;text-align:center;padding:2rem;">${err.message}</td></tr>`;
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Init ────────────────────────────────────────────────────────────────────
loadStats();
loadBookings();
loadUsers();


