/**
 * Admin bookings list
 */
(function () {
  const token = localStorage.getItem('token');
  const authHeader = { Authorization: `Bearer ${token}` };
  const skeleton = window.Skeleton;

  function esc(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function paymentBadge(ps) {
    const p = (ps || 'pending').toLowerCase();
    if (p === 'paid') return '<span class="status-badge status-paid">Paid</span>';
    if (p === 'refunded') return '<span class="status-badge status-cancelled">Refunded</span>';
    if (p === 'failed') return '<span class="status-badge status-rejected">Failed</span>';
    return '<span class="status-badge status-pending">Pending</span>';
  }

  function statusBadge(st) {
    const s = (st || '').toLowerCase();
    if (s === 'approved') return '<span class="status-badge status-approved">Approved</span>';
    if (s === 'cancelled') return '<span class="status-badge status-cancelled">Cancelled</span>';
    return '<span class="status-badge status-pending">Pending</span>';
  }

  async function loadBookings() {
    const tbody = document.getElementById('adminBookingsTbody');
    if (!tbody) return;
    if (skeleton) skeleton.renderTableSkeleton(tbody, 8, 6);

    try {
      const res = await fetch('/api/admin/bookings', { headers: authHeader });
      const rows = await res.json();
      if (!res.ok) throw new Error(rows.message || 'Failed to load');

      if (!rows.length) {
        tbody.innerHTML = `
          <tr><td colspan="8">
            <div class="empty-state">
              <p>No reservations found yet.</p>
            </div>
          </td></tr>`;
        return;
      }

      tbody.innerHTML = rows
        .map(
          (b) => `
        <tr data-status="${esc((b.status || '').toLowerCase())}" data-payment="${esc((b.payment_status || '').toLowerCase())}">
          <td>#${b.id}</td>
          <td><div class="text-strong">${esc(b.facility_name)}</div></td>
          <td>
            <div class="text-strong">${esc(b.user_name)}</div>
            <div class="text-muted small-muted">${esc(b.user_email)}</div>
          </td>
          <td>${esc(b.date)}</td>
          <td>${String(b.start_time).slice(0, 5)} – ${String(b.end_time).slice(0, 5)}</td>
          <td>${b.quantity} / ${b.guest_count} pax</td>
          <td>₱${Number(b.total_amount || 0).toLocaleString()}</td>
          <td>${paymentBadge(b.payment_status)} ${statusBadge(b.status)}</td>
        </tr>`
        )
        .join('');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center table-error">${esc(err.message)}</td></tr>`;
    }
    if (window.lucide) lucide.createIcons();
  }

  const statusFilter = document.getElementById('bookingStatusFilter');
  if (statusFilter) {
    statusFilter.addEventListener('change', () => {
      const v = (statusFilter.value || '').toLowerCase();
      const rows = [...document.querySelectorAll('#adminBookingsTbody tr[data-status]')];
      rows.forEach((tr) => {
        if (!v) tr.style.display = '';
        else tr.style.display = tr.getAttribute('data-status') === v ? '' : 'none';
      });
    });
  }

  loadBookings();
})();
