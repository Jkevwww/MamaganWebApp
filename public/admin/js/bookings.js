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

  function normalizeDate(value) {
    if (!value) return '';
    if (/^\d{4}-\d{2}-\d{2}/.test(String(value))) return String(value).slice(0, 10);
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return localDateKey(date);
  }

  function localDateKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function updateSummary(rows) {
    const today = localDateKey();
    const todayRows = rows.filter((row) => normalizeDate(row.date) === today);
    const byBooking = todayRows.reduce((acc, row) => {
      const key = (row.status || 'pending').toLowerCase();
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const byPayment = rows.reduce((acc, row) => {
      const key = (row.payment_status || 'pending').toLowerCase();
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    setText('todayTotal', todayRows.length);
    setText('todayApproved', byBooking.approved || 0);
    setText('todayPending', byBooking.pending || 0);
    setText('todayCancelled', byBooking.cancelled || 0);
    setText('paymentPaid', byPayment.paid || 0);
    setText('paymentPending', byPayment.pending || 0);
    setText('paymentFailed', byPayment.failed || 0);
    setText('paymentRefunded', byPayment.refunded || 0);
  }

  async function loadBookings() {
    const tbody = document.getElementById('adminBookingsTbody');
    if (!tbody) return;
    if (skeleton) skeleton.renderTableSkeleton(tbody, 9, 6);

    try {
      const res = await fetch('/api/admin/bookings', { headers: authHeader });
      const rows = await res.json();
      if (!res.ok) throw new Error(rows.message || 'Failed to load');
      updateSummary(rows);

      if (!rows.length) {
        tbody.innerHTML = `
          <tr><td colspan="9">
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
          <td>${statusBadge(b.status)}</td>
          <td>${paymentBadge(b.payment_status)}</td>
        </tr>`
        )
        .join('');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="9" class="text-center table-error">${esc(err.message)}</td></tr>`;
    }
    if (window.lucide) lucide.createIcons();
  }

  function applyFilters() {
    const bookingStatus = (document.getElementById('bookingStatusFilter')?.value || '').toLowerCase();
    const paymentStatus = (document.getElementById('paymentStatusFilter')?.value || '').toLowerCase();
    const rows = [...document.querySelectorAll('#adminBookingsTbody tr[data-status]')];
    rows.forEach((tr) => {
      const matchesBooking = !bookingStatus || tr.getAttribute('data-status') === bookingStatus;
      const matchesPayment = !paymentStatus || tr.getAttribute('data-payment') === paymentStatus;
      tr.style.display = matchesBooking && matchesPayment ? '' : 'none';
    });
  }

  document.getElementById('bookingStatusFilter')?.addEventListener('change', applyFilters);
  document.getElementById('paymentStatusFilter')?.addEventListener('change', applyFilters);

  loadBookings();
})();
