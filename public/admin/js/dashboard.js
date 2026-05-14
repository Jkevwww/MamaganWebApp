/* ─── Admin Dashboard JS ────────────────────────────────────────────────────── */

// Auth guard – admin only
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
  try {
    const res = await fetch('/api/admin/stats', { headers: authHeader });
    if (res.status === 401 || res.status === 403) {
      localStorage.clear();
      window.location.replace('/admin/login.html');
      return;
    }
    const data = await res.json();
    document.getElementById('statUsers').textContent = data.totalUsers ?? '–';
    document.getElementById('statFacilities').textContent = data.totalFacilities ?? '–';
    document.getElementById('statBookings').textContent = data.totalBookings ?? '–';
    document.getElementById('statPending').textContent = data.pendingBookings ?? '–';
  } catch (err) {
    console.error('Stats error:', err.message);
  }
}

// ─── Load Bookings ───────────────────────────────────────────────────────────
async function loadBookings() {
  const tbody = document.getElementById('bookingsTbody');
  try {
    const res = await fetch('/api/admin/bookings', { headers: authHeader });
    const bookings = await res.json();
    if (!res.ok) throw new Error('Failed to load bookings');

    if (bookings.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#94a3b8;">No bookings yet.</td></tr>';
      return;
    }

    tbody.innerHTML = bookings.map((b) => `
      <tr>
        <td>${b.id}</td>
        <td>${escHtml(b.user_name)}<br/><small style="color:#94a3b8;">${escHtml(b.user_email)}</small></td>
        <td>${escHtml(b.facility)}</td>
        <td>${b.date}</td>
        <td>${b.start_time} – ${b.end_time}</td>
        <td><span class="status-badge status-${b.status}">${b.status}</span></td>
        <td>
          ${b.status !== 'approved'
            ? `<button class="btn-sm btn-approve" onclick="updateBooking(${b.id}, 'approved')">Approve</button> `
            : ''}
          ${b.status !== 'cancelled'
            ? `<button class="btn-sm btn-cancel" onclick="updateBooking(${b.id}, 'cancelled')">Cancel</button>`
            : ''}
        </td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" style="color:#c62828;">${err.message}</td></tr>`;
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
    await loadBookings();
    await loadStats();
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

// ─── Load Users ──────────────────────────────────────────────────────────────
async function loadUsers() {
  const tbody = document.getElementById('usersTbody');
  try {
    const res = await fetch('/api/admin/users', { headers: authHeader });
    const users = await res.json();
    if (!res.ok) throw new Error('Failed to load users');

    if (users.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#94a3b8;">No users found.</td></tr>';
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
    tbody.innerHTML = `<tr><td colspan="5" style="color:#c62828;">${err.message}</td></tr>`;
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
