/* bookings.js */

let user = null;
const skeleton = window.Skeleton;
const bookingActionState = {
  bookingId: null,
  trigger: null,
  busy: false
};
const DELETE_LOTTIE_URL = 'https://lottie.host/embed/218949da-56b9-495b-ad6c-6f19de6d32e4/Av64mblLSy.lottie';
const CONFIRM_LOTTIE_URL = 'https://lottie.host/embed/b2fee4e8-7844-428a-adcc-3c8f7f698ef7/PxVN7fb25I.lottie';
let paymentSyncInProgress = false;

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

    if (await syncPendingPayments(bookings)) {
      await loadMyBookings();
      return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('new_booking')) {
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

    tbody.innerHTML = bookings.map((b) => {
      const dateText = new Date(b.date).toLocaleDateString();
      const timeText = `${String(b.start_time).substring(0, 5)} - ${String(b.end_time).substring(0, 5)}`;
      const canDelete = b.payment_status !== 'paid';

      return `
      <tr>
        <td>
          <div class="text-primary-strong">${escHtml(b.facility_name)}</div>
          <div class="facility-thumb-meta">${b.quantity} unit(s) - ${b.guest_count} pax</div>
        </td>
        <td>${escHtml(dateText)}</td>
        <td>${escHtml(timeText)}</td>
        <td>
          <span class="status-badge ${getStatusClass(b.status)}">${escHtml(String(b.status).toUpperCase())}</span>
          ${b.payment_status === 'pending' && b.status !== 'cancelled' ? '<br><small class="text-muted text-accent-pending">Payment pending</small>' : ''}
        </td>
        <td>
          <div class="table-actions">
            <a href="/booking-details.html?id=${encodeURIComponent(b.id)}" class="btn btn-outline btn-sm">Details</a>
            ${b.payment_status === 'paid' ? `
              <button type="button" class="btn btn-primary btn-sm" title="View QR ticket"
                data-ticket-id="${escAttr(b.id)}"
                data-ticket-facility="${escAttr(b.facility_name)}"
                data-ticket-date="${escAttr(dateText)}"
                data-ticket-time="${escAttr(timeText)}">
                <i class="icon-xs" data-lucide="qr-code" aria-hidden="true"></i> Ticket
              </button>
            ` : ''}
            ${canDelete ? `
              <button type="button" class="btn btn-danger btn-sm" title="Delete booking"
                data-delete-booking-id="${escAttr(b.id)}"
                data-delete-booking-name="${escAttr(b.facility_name)}"
                data-delete-booking-date="${escAttr(dateText)}"
                data-delete-booking-time="${escAttr(timeText)}">
                <i class="icon-xs" data-lucide="trash-2" aria-hidden="true"></i> Delete
              </button>
            ` : ''}
          </div>
        </td>
      </tr>`;
    }).join('');

    if (window.lucide) lucide.createIcons();
  } catch (err) {
    tbody.innerHTML = `<tr><td class="table-error-centered" colspan="5">Error: ${escHtml(err.message)}</td></tr>`;
  }
}

async function syncPendingPayments(bookings) {
  if (paymentSyncInProgress) return false;

  const pendingBookings = bookings.filter((b) =>
    b.payment_status === 'pending' && b.status !== 'cancelled'
  );
  if (pendingBookings.length === 0) return false;

  paymentSyncInProgress = true;
  try {
    const results = await Promise.allSettled(
      pendingBookings.map((b) =>
        fetch(`/api/payments/status/${encodeURIComponent(b.id)}`, { credentials: 'same-origin' })
          .then((res) => res.ok ? res.json() : null)
      )
    );
    return results.some((result) =>
      result.status === 'fulfilled' && result.value?.payment_status === 'paid'
    );
  } finally {
    paymentSyncInProgress = false;
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

document.addEventListener('click', (event) => {
  const ticketBtn = event.target.closest('[data-ticket-id]');
  if (ticketBtn) {
    viewTicket(
      ticketBtn.dataset.ticketId,
      ticketBtn.dataset.ticketFacility,
      ticketBtn.dataset.ticketDate,
      ticketBtn.dataset.ticketTime
    );
    return;
  }

  const deleteBtn = event.target.closest('[data-delete-booking-id]');
  if (deleteBtn) {
    openDeleteDialog(deleteBtn);
  }
});

document.getElementById('bookingActionClose')?.addEventListener('click', closeBookingAction);
document.getElementById('bookingActionCancel')?.addEventListener('click', closeBookingAction);
document.getElementById('bookingActionConfirm')?.addEventListener('click', confirmDeleteBooking);
document.getElementById('bookingActionOverlay')?.addEventListener('click', (event) => {
  if (event.target.id === 'bookingActionOverlay') closeBookingAction();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeBookingAction();
});

function viewTicket(id, facility, date, time) {
  const url = `/view-ticket.html?id=${encodeURIComponent(id)}&facility=${encodeURIComponent(facility)}&date=${encodeURIComponent(date)}&time=${encodeURIComponent(time)}`;
  window.location.href = url;
}

function openDeleteDialog(btn) {
  bookingActionState.bookingId = btn.dataset.deleteBookingId;
  bookingActionState.trigger = btn;
  bookingActionState.busy = false;

  setBookingActionContent({
    title: 'Delete Booking?',
    message: 'This booking will be permanently removed from your list.',
    animationUrl: DELETE_LOTTIE_URL,
    fallbackIcon: 'trash-2',
    variant: 'danger',
    meta: `
      <strong>${escHtml(btn.dataset.deleteBookingName || 'Booking')}</strong>
      <div class="text-muted">${escHtml(btn.dataset.deleteBookingDate || '')}${btn.dataset.deleteBookingTime ? ' - ' + escHtml(btn.dataset.deleteBookingTime) : ''}</div>
    `,
    confirmText: 'Confirm Delete',
    cancelText: 'Cancel',
    showConfirm: true,
    showCancel: true
  });

  openBookingAction();
}

function openBookingAction() {
  const overlay = document.getElementById('bookingActionOverlay');
  if (!overlay) return;
  overlay.classList.add('open');
  overlay.setAttribute('aria-hidden', 'false');
  document.getElementById('bookingActionConfirm')?.focus();
  window.lucide?.createIcons();
}

function closeBookingAction() {
  if (bookingActionState.busy) return;

  const overlay = document.getElementById('bookingActionOverlay');
  if (!overlay?.classList.contains('open')) return;
  overlay.classList.remove('open');
  overlay.setAttribute('aria-hidden', 'true');

  const trigger = bookingActionState.trigger;
  bookingActionState.bookingId = null;
  bookingActionState.trigger = null;
  if (trigger && document.body.contains(trigger)) trigger.focus();
}

function setBookingActionContent({ title, message, animationUrl, fallbackIcon, variant, meta, confirmText, cancelText, showConfirm, showCancel }) {
  const titleEl = document.getElementById('bookingActionTitle');
  const messageEl = document.getElementById('bookingActionMessage');
  const metaEl = document.getElementById('bookingActionMeta');
  const visualEl = document.getElementById('bookingActionVisual');
  const confirmBtn = document.getElementById('bookingActionConfirm');
  const cancelBtn = document.getElementById('bookingActionCancel');

  if (titleEl) titleEl.textContent = title;
  if (messageEl) messageEl.textContent = message;
  if (metaEl) metaEl.innerHTML = meta || '';
  if (visualEl) {
    visualEl.className = `booking-action-visual booking-action-visual--${variant}`;
    visualEl.innerHTML = animationUrl
      ? `<iframe src="${escAttr(animationUrl)}" title="" aria-hidden="true"></iframe>`
      : `<span class="booking-action-icon booking-action-icon--${variant}"><i data-lucide="${escAttr(fallbackIcon)}"></i></span>`;
  }
  if (confirmBtn) {
    confirmBtn.textContent = confirmText;
    confirmBtn.className = variant === 'danger' ? 'btn btn-danger' : 'btn btn-primary';
    confirmBtn.disabled = false;
    confirmBtn.style.display = showConfirm ? '' : 'none';
  }
  if (cancelBtn) {
    cancelBtn.textContent = cancelText;
    cancelBtn.disabled = false;
    cancelBtn.style.display = showCancel ? '' : 'none';
  }
  window.lucide?.createIcons();
}

async function confirmDeleteBooking() {
  const id = bookingActionState.bookingId;
  const confirmBtn = document.getElementById('bookingActionConfirm');
  const cancelBtn = document.getElementById('bookingActionCancel');
  if (bookingActionState.busy) return;
  if (!id) {
    closeBookingAction();
    return;
  }

  bookingActionState.busy = true;
  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Deleting...';
  }
  if (cancelBtn) cancelBtn.disabled = true;

  try {
    const res = await fetch(`/api/facilities/bookings/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      credentials: 'same-origin'
    });
    if (res.status === 401 || res.status === 403) {
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.replace(`/login.html?next=${next}`);
      return;
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'Failed to delete booking');
    await loadMyBookings();
    bookingActionState.busy = false;
    bookingActionState.bookingId = null;
    bookingActionState.trigger = null;
    setBookingActionContent({
      title: 'Booking deleted',
      message: 'The booking was removed from your list.',
      animationUrl: CONFIRM_LOTTIE_URL,
      fallbackIcon: 'check-circle',
      variant: 'success',
      meta: '',
      confirmText: 'Done',
      cancelText: 'Cancel',
      showConfirm: true,
      showCancel: false
    });
  } catch (err) {
    bookingActionState.busy = false;
    setBookingActionContent({
      title: 'Delete failed',
      message: err.message,
      animationUrl: '',
      fallbackIcon: 'alert-triangle',
      variant: 'warning',
      meta: '',
      confirmText: 'Try Again',
      cancelText: 'Close',
      showConfirm: true,
      showCancel: true
    });
  }
}

function escHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escAttr(str) {
  return escHtml(str);
}
