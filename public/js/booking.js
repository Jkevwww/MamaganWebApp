/* ─── booking.js ───────────────────────────────────────────────────────────── */

let user = null;
let currentFacility = null;
const facilityId = new URLSearchParams(window.location.search).get('id');

async function checkAuth() {
  try {
    const res = await fetch('/api/auth/me');
    if (!res.ok) {
      window.location.replace(`/login.html?redirect=/booking.html?id=${facilityId}`);
      return;
    }
    user = await res.json();
    const navUserEl = document.getElementById('navUser');
    if (navUserEl && user?.name) navUserEl.textContent = user.name;
  } catch (_) {
    window.location.replace('/login.html');
  }
}

async function loadFacility() {
  if (!facilityId) {
    showError('Missing Facility ID', 'Please select a facility from the list.');
    return;
  }

  try {
    const res = await fetch(`/api/facilities/${facilityId}`);
    if (!res.ok) throw new Error('Facility not found');
    currentFacility = await res.json();

    if (!currentFacility.is_bookable) {
      showError('Facility Unavailable', currentFacility.unavailable_reason || 'This facility is not currently available for booking.');
      return;
    }

    renderFacilityInfo();
    setupForm();
  } catch (err) {
    showError('Error', err.message);
  }
}

function renderFacilityInfo() {
  const header = document.getElementById('facilityHeader');
  header.innerHTML = `
    <h1 class="text-primary-heading">${escHtml(currentFacility.name)}</h1>
    <p class="booking-description">${escHtml(currentFacility.description)}</p>
    <div class="booking-badge-row">
      <span class="badge badge-warm"><i class="icon-xs-middle" data-lucide="users"></i> Up to ${currentFacility.capacity_max} pax</span>
      <span class="badge badge-info"><i class="icon-xs-middle" data-lucide="package"></i> ${currentFacility.inventory_count} units available</span>
      <span class="badge badge-muted">${currentFacility.category}</span>
    </div>
  `;
  
  if (currentFacility.category === 'Room') {
    document.getElementById('bookingTypeGroup').style.display = 'block';
  }

  document.getElementById('bookingForm').style.display = 'block';
  if (window.lucide) lucide.createIcons();
}

function setupForm() {
  const dateInput = document.getElementById('bookDate');
  const today = new Date().toISOString().split('T')[0];
  dateInput.min = today;
  dateInput.value = today;

  // Set default times
  document.getElementById('startTime').value = '08:00';
  document.getElementById('endTime').value = '17:00';

  // Listen for changes to recalculate and check availability
  ['bookDate', 'startTime', 'endTime', 'quantity', 'guestCount'].forEach(id => {
    document.getElementById(id).addEventListener('change', updateState);
  });
  
  document.querySelectorAll('input[name="bookingType"]').forEach(radio => {
    radio.addEventListener('change', updateState);
  });

  updateState();
}

async function updateState() {
  const date = document.getElementById('bookDate').value;
  const startTime = document.getElementById('startTime').value;
  const endTime = document.getElementById('endTime').value;
  const quantity = parseInt(document.getElementById('quantity').value) || 1;
  const guestCount = parseInt(document.getElementById('guestCount').value) || 1;
  const bookingType = document.querySelector('input[name="bookingType"]:checked')?.value || 'DAY';

  if (!date || !startTime || !endTime) return;

  // 1. Check client-side constraints
  if (startTime >= endTime) {
    showAvailabilityStatus('End time must be after start time', 'error');
    setSubmitEnabled(false);
    return;
  }
  
  if (guestCount > (currentFacility.capacity_max * quantity)) {
    showAvailabilityStatus(`Guest count exceeds capacity (${currentFacility.capacity_max * quantity} pax total)`, 'error');
    setSubmitEnabled(false);
    return;
  }

  // 2. Check server-side availability
  try {
    const res = await fetch(`/api/facilities/${facilityId}/availability?date=${date}&startTime=${startTime}&endTime=${endTime}&quantity=${quantity}`);
    const result = await res.json();

    if (result.available) {
      showAvailabilityStatus(`Available! ${result.remaining} unit(s) remaining for this slot.`, 'success');
      setSubmitEnabled(true);
      
      // Calculate Total
      calculateTotalDisplay(quantity, guestCount, startTime, endTime, bookingType);
    } else {
      showAvailabilityStatus(result.reason, 'error');
      setSubmitEnabled(false);
      resetTotal();
    }
  } catch (err) {
    showAvailabilityStatus('Failed to check availability', 'error');
    setSubmitEnabled(false);
  }
}

function calculateTotalDisplay(quantity, guestCount, startTime, endTime, bookingType) {
  let total = 0;
  let breakdown = '';

  if (currentFacility.category === 'Cottage') {
    total = currentFacility.price_min * quantity;
    breakdown = `₱${currentFacility.price_min.toLocaleString()} x ${quantity} unit(s)`;
  } 
  else if (currentFacility.category === 'Room') {
    total = currentFacility.price_min * quantity;
    breakdown = `Base: ₱${currentFacility.price_min.toLocaleString()} x ${quantity} unit(s)`;
    if (bookingType === 'NIGHT') {
      const surcharge = guestCount > 6 ? 500 : 200;
      total += (surcharge * quantity);
      breakdown += `<br>Night Surcharge: ₱${surcharge.toLocaleString()} x ${quantity}`;
    }
  } 
  else if (currentFacility.category === 'Equipment') {
    const start = new Date(`1970-01-01T${startTime}`);
    const end = new Date(`1970-01-01T${endTime}`);
    const hours = Math.ceil((end - start) / (1000 * 60 * 60));
    
    // Check if daily (approx 8+ hours)
    if (hours >= 8) {
      total = currentFacility.price_max * quantity;
      breakdown = `Daily Rate: ₱${currentFacility.price_max.toLocaleString()} x ${quantity}`;
    } else {
      total = currentFacility.price_min * hours * quantity;
      breakdown = `Hourly: ₱${currentFacility.price_min.toLocaleString()} x ${hours} hr(s) x ${quantity}`;
    }
  }

  document.getElementById('totalAmount').textContent = `₱${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
  document.getElementById('summaryDetails').innerHTML = `
    <div class="summary-breakdown">
      <div class="facility-price"><strong>${escHtml(currentFacility.name)}</strong></div>
      <div class="summary-breakdown-lines">${breakdown}</div>
    </div>
  `;
}

function showAvailabilityStatus(msg, type) {
  const el = document.getElementById('availabilityStatus');
  el.textContent = msg;
  el.style.display = 'block';
  el.style.background = type === 'success' ? '#f0f9ff' : '#fef2f2';
  el.style.color = type === 'success' ? '#0369a1' : '#991b1b';
  el.style.border = `1px solid ${type === 'success' ? '#bae6fd' : '#fecaca'}`;
}

function setSubmitEnabled(enabled) {
  document.getElementById('submitBooking').disabled = !enabled;
}

function resetTotal() {
  document.getElementById('totalAmount').textContent = '₱0.00';
  document.getElementById('summaryDetails').innerHTML = '<p class="text-muted-small">Fill in the details to see the total amount.</p>';
}

function showError(title, msg) {
  document.getElementById('errorOverlay').classList.add('open');
  document.getElementById('errorTitle').textContent = title;
  document.getElementById('errorMsg').textContent = msg;
}

function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ─── Submit Booking ─────────────────────────────────────────────────────────

document.getElementById('submitBooking').addEventListener('click', async () => {
  const btn = document.getElementById('submitBooking');
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Processing...';

  const payload = {
    date: document.getElementById('bookDate').value,
    start_time: document.getElementById('startTime').value,
    end_time: document.getElementById('endTime').value,
    quantity: document.getElementById('quantity').value,
    guest_count: document.getElementById('guestCount').value,
    notes: document.getElementById('notes').value,
    bookingType: document.querySelector('input[name="bookingType"]:checked')?.value || 'DAY'
  };

  try {
    const res = await fetch(`/api/facilities/${facilityId}/book`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Booking failed');

    // Success! Redirect to my bookings or a confirmation page
    window.location.href = `/my-bookings.html?new_booking=${data.bookingId}`;
    
  } catch (err) {
    alert('Error: ' + err.message);
    btn.disabled = false;
    btn.textContent = originalText;
  }
});

// ─── Init ───────────────────────────────────────────────────────────────────
checkAuth().then(loadFacility);
