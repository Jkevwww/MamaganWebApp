/* ─── bookings.js ─────────────────────────────────────────────────────────── */

let user = null;
const skeleton = window.Skeleton;

async function checkAuth() {
  try {
    const res = await fetch('/api/auth/me');
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
      await fetch('/api/auth/logout', { method: 'POST' });
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
    const res = await fetch('/api/facilities/my-bookings'); 
    const bookings = await res.json();

    if (!res.ok) throw new Error('Failed to load bookings');

    // Check for success message from new booking
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('new_booking')) {
       // Optional: show a toast or alert
       console.log('New booking created:', urlParams.get('new_booking'));
    }

    if (bookings.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 4rem; color: #777;">You have no bookings yet. <br><br> <a href="/facilities.html" class="btn btn-primary">Book a facility now!</a></td></tr>';
      return;
    }

    tbody.innerHTML = bookings.map((b) => `
      <tr>
        <td>
          <div style="font-weight:600; color: var(--primary);">${escHtml(b.facility_name)}</div>
          <div style="font-size: 0.75rem; color: #64748b;">${b.quantity} unit(s) • ${b.guest_count} pax</div>
        </td>
        <td>${new Date(b.date).toLocaleDateString()}</td>
        <td>${b.start_time.substring(0,5)} - ${b.end_time.substring(0,5)}</td>
        <td>
          <span class="badge ${getStatusClass(b.status)}">${b.status.toUpperCase()}</span>
          ${b.payment_status === 'pending' && b.status !== 'cancelled' ? '<br><small style="color:var(--orange); font-weight:600;">Payment Pending</small>' : ''}
        </td>
        <td>
          <div style="display:flex; gap: 0.5rem;">
            <a href="/booking-details.html?id=${b.id}" class="btn btn-secondary" style="padding: 0.3rem 0.6rem; font-size: 0.8rem;">
              Details
            </a>
            ${b.payment_status === 'paid' ? `
              <button class="btn btn-primary" style="padding: 0.3rem 0.6rem; font-size: 0.8rem;" 
                onclick="viewTicket(${b.id}, '${escHtml(b.facility_name)}', '${new Date(b.date).toLocaleDateString()}', '${b.start_time} - ${b.end_time}')">
                <i data-lucide="qr-code" style="width:14px; vertical-align:middle;"></i> Ticket
              </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `).join('');

    if (window.lucide) lucide.createIcons();

  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 3rem; color: var(--error);">Error: ${err.message}</td></tr>`;
  }
}

function getStatusClass(status) {
  switch (status.toLowerCase()) {
    case 'approved': return 'status-approved';
    case 'pending': return 'status-pending';
    case 'cancelled': return 'status-cancelled';
    default: return '';
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
