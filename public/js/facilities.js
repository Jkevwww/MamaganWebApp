/* ─── facilities.js ─────────────────────────────────────────────────────────── */

// Auth guard
const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user') || '{}');
if (!token) window.location.replace('/login.html');

// Navbar user display
const navUserEl = document.getElementById('navUser');
if (navUserEl && user.name) navUserEl.textContent = user.name;

document.getElementById('navLogout').addEventListener('click', (e) => {
  e.preventDefault();
  localStorage.clear();
  window.location.replace('/login.html');
});

// ─── Load facilities ────────────────────────────────────────────────────────
async function loadFacilities() {
  const grid = document.getElementById('facilityGrid');
  try {
    const res = await fetch('/api/facilities');
    const facilities = await res.json();

    if (!res.ok) throw new Error('Failed to load facilities');

    if (facilities.length === 0) {
      grid.innerHTML = '<p style="color:#777;">No facilities available at the moment.</p>';
      return;
    }

    grid.innerHTML = facilities.map((f) => `
      <div class="facility-card">
        <img src="${f.image_url || 'https://placehold.co/400x200?text=Facility'}" alt="${f.name}" loading="lazy" />
        <div class="card-body">
          <h3>${escHtml(f.name)}</h3>
          <p class="meta">Capacity: ${f.capacity} pax</p>
          <p class="price">₱${Number(f.price_per_hour).toLocaleString()} / hour</p>
          <p>${escHtml(f.description || '')}</p>
          <span class="badge ${f.is_available ? 'badge-available' : 'badge-unavailable'}">
            ${f.is_available ? 'Available' : 'Unavailable'}
          </span>
          ${f.is_available
            ? `<button class="btn btn-primary" style="margin-top:.8rem;width:100%;"
                 onclick="openBookingModal(${f.id}, '${escHtml(f.name)}')">
                 Book Now
               </button>`
            : ''}
        </div>
      </div>
    `).join('');
  } catch (err) {
    grid.innerHTML = `<p style="color:#c62828;">Error: ${err.message}</p>`;
  }
}

// ─── Booking Modal ──────────────────────────────────────────────────────────
const modal = document.getElementById('bookingModal');
const modalFacilityName = document.getElementById('modalFacilityName');
const modalAlert = document.getElementById('modalAlert');
const bookDateInput = document.getElementById('bookDate');

// Set minimum date to today
bookDateInput.min = new Date().toISOString().split('T')[0];

function openBookingModal(facilityId, facilityName) {
  if (!token) { window.location.replace('/login.html'); return; }
  document.getElementById('bookingFacilityId').value = facilityId;
  modalFacilityName.textContent = facilityName;
  modalAlert.className = 'alert';
  document.getElementById('bookingForm').reset();
  bookDateInput.min = new Date().toISOString().split('T')[0];
  modal.classList.add('open');
}

document.getElementById('closeModal').addEventListener('click', () => {
  modal.classList.remove('open');
});

modal.addEventListener('click', (e) => {
  if (e.target === modal) modal.classList.remove('open');
});

document.getElementById('bookingForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  modalAlert.className = 'alert';

  const facilityId = document.getElementById('bookingFacilityId').value;
  const date = document.getElementById('bookDate').value;
  const start_time = document.getElementById('startTime').value;
  const end_time = document.getElementById('endTime').value;
  const notes = document.getElementById('bookNotes').value.trim();

  if (!date || !start_time || !end_time) {
    modalAlert.textContent = 'Please fill in date, start time, and end time.';
    modalAlert.className = 'alert alert-error show';
    return;
  }
  if (start_time >= end_time) {
    modalAlert.textContent = 'End time must be after start time.';
    modalAlert.className = 'alert alert-error show';
    return;
  }

  const submitBtn = document.getElementById('bookSubmitBtn');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Booking...';

  try {
    const res = await fetch(`/api/facilities/${facilityId}/book`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ date, start_time, end_time, notes }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Booking failed');

    modalAlert.textContent = 'Booking submitted! Status: ' + data.status;
    modalAlert.className = 'alert alert-success show';
    setTimeout(() => modal.classList.remove('open'), 2000);
  } catch (err) {
    modalAlert.textContent = err.message;
    modalAlert.className = 'alert alert-error show';
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Confirm Booking';
  }
});

// ─── Helpers ────────────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Init ────────────────────────────────────────────────────────────────────
loadFacilities();
