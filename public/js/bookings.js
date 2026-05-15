/* ─── bookings.js ─────────────────────────────────────────────────────────── */

let user = null;
const skeleton = window.Skeleton;

async function checkAuth() {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
    if (!res.ok) {
      window.location.replace('/login.html');
      return;
    }
    user = await res.json();
    const navUserEl = document.getElementById('navUser');
    if (navUserEl && user?.name) navUserEl.textContent = user.name;
    loadMyBookings();
  } catch (_) {
    window.location.replace('/login.html');
  }
}

checkAuth();

if (document.getElementById('navLogout')) {
  document.getElementById('navLogout').addEventListener('click', async (e) => {
    e.preventDefault();
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
    } catch (_) {}
    localStorage.clear();
    window.location.replace('/');
  });
}

async function loadMyBookings() {
  const tbody = document.getElementById('myBookingsTbody');
  if (skeleton?.renderTableSkeleton && tbody) {
    skeleton.renderTableSkeleton(tbody, 5, 5);
  }

  try {
    const res = await fetch('/api/facilities/my-bookings', { credentials: 'same-origin' }); 
    const bookings = await res.json();

    if (!res.ok) throw new Error('Failed to load bookings');

    // Check for success message from new booking
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('new_booking')) {
       // Optional: show a toast or alert
       console.log('New booking created:', urlParams.get('new_booking'));
    }

    if (bookings.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5">
        <div class="empty-state">
          <p>You have no bookings yet.</p>
          <p class="filter-reset-button"><a href="/facilities.html" class="btn btn-primary">Browse facilities</a></p>
        </div>
      </td></tr>`;
      return;
    }

    tbody.innerHTML = bookings.map((b) => `
      <tr>
        <td>
          <div class="text-primary-strong">${escHtml(b.facility_name)}</div>
          <div class="facility-thumb-meta">${b.quantity} unit(s) • ${b.guest_count} pax</div>
        </td>
        <td>${new Date(b.date).toLocaleDateString()}</td>
        <td>${b.start_time.substring(0,5)} - ${b.end_time.substring(0,5)}</td>
        <td>
          <span class="status-badge ${getStatusClass(b.status)}">${escHtml(String(b.status).toUpperCase())}</span>
          ${b.payment_status === 'pending' && b.status !== 'cancelled' ? '<br><small class="text-muted text-accent-pending">Payment pending</small>' : ''}
        </td>
        <td>
          <div class="table-actions">
            <a href="/booking-details.html?id=${b.id}" class="btn btn-outline btn-sm">Details</a>
            ${b.payment_status === 'paid' ? `
              <button type="button" class="btn btn-primary btn-sm" title="View QR ticket"
                onclick="viewTicket(${b.id}, '${escHtml(b.facility_name)}', '${new Date(b.date).toLocaleDateString()}', '${b.start_time} - ${b.end_time}')">
                <i class="icon-xs" data-lucide="qr-code" aria-hidden="true"></i> Ticket
              </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `).join('');

    if (window.lucide) lucide.createIcons();

  } catch (err) {
    tbody.innerHTML = `<tr><td class="table-error-centered" colspan="5">Error: ${err.message}</td></tr>`;
  }
}

function getStatusClass(status) {
  switch (String(status || '').toLowerCase()) {
    case 'approved':
      return 'status-approved';
    case 'pending':
      return 'status-pending';
    case 'cancelled':
      return 'status-cancelled';
    default:
      return 'status-pending';
  }
}

function viewTicket(id, facility, date, time) {
  const url = `/view-ticket.html?id=${id}&facility=${encodeURIComponent(facility)}&date=${encodeURIComponent(date)}&time=${encodeURIComponent(time)}`;
  window.location.href = url;
}

function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
