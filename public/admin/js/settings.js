/**
 * Admin settings page.
 */
(function () {
  const token = localStorage.getItem('token');
  const authHeader = token ? { Authorization: `Bearer ${token}` } : {};

  function esc(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function showAlert(message, type = 'error') {
    const el = document.getElementById('settingsAlert');
    if (!el) return;
    el.className = `dashboard-alert ${type === 'success' ? 'dashboard-alert-success' : ''}`;
    el.textContent = message;
  }

  function hideAlert() {
    const el = document.getElementById('settingsAlert');
    if (!el) return;
    el.className = 'dashboard-alert is-hidden';
    el.textContent = '';
  }

  function setLoading(isLoading) {
    const btn = document.getElementById('saveSettingsBtn');
    if (!btn) return;
    if (!btn.dataset.originalText) btn.dataset.originalText = btn.textContent;
    btn.disabled = isLoading;
    btn.textContent = isLoading ? 'Saving...' : btn.dataset.originalText;
  }

  function setValue(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value ?? '';
  }

  function setChecked(id, value) {
    const el = document.getElementById(id);
    if (el) el.checked = Boolean(value);
  }

  function getValue(id) {
    return document.getElementById(id)?.value.trim() || '';
  }

  function getNumber(id) {
    return Number.parseInt(document.getElementById(id)?.value || '0', 10);
  }

  function getChecked(id) {
    return Boolean(document.getElementById(id)?.checked);
  }

  async function api(url, options = {}) {
    const headers = {
      ...authHeader,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    };
    const res = await fetch(url, {
      credentials: 'same-origin',
      ...options,
      headers,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'Settings request failed');
    return data;
  }

  function formatDate(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function integrationRow(label, item, detail) {
    const ok = Boolean(item?.configured);
    return `
      <div class="settings-integration-row">
        <div>
          <strong>${esc(label)}</strong>
          <span>${esc(detail || item?.provider || '')}</span>
        </div>
        <span class="status-badge ${ok ? 'status-approved' : 'status-pending'}">${ok ? 'Configured' : 'Needs setup'}</span>
      </div>`;
  }

  function renderIntegrations(integrations = {}) {
    const list = document.getElementById('integrationList');
    if (!list) return;
    list.innerHTML = [
      integrationRow('Email delivery', integrations.email, integrations.email?.from || integrations.email?.provider),
      integrationRow('Google OAuth', integrations.google_oauth, integrations.google_oauth?.callback_url),
      integrationRow('GitHub OAuth', integrations.github_oauth, integrations.github_oauth?.callback_url),
      integrationRow('Payments', integrations.payments, integrations.payments?.provider),
    ].join('');
  }

  function populate(data) {
    const settings = data.settings || {};
    const resort = settings.resort_profile || {};
    const booking = settings.booking_rules || {};
    const notifications = settings.notifications || {};

    setValue('resortName', resort.resort_name);
    setValue('supportEmail', resort.support_email);
    setValue('supportPhone', resort.support_phone);
    setValue('websiteUrl', resort.website_url);
    setValue('resortAddress', resort.address);
    setValue('businessHours', resort.business_hours);

    setValue('checkInTime', booking.check_in_time || '08:00');
    setValue('checkOutTime', booking.check_out_time || '18:00');
    setValue('minAdvanceHours', booking.min_advance_hours ?? 2);
    setValue('maxGuestPerBooking', booking.max_guest_per_booking ?? 50);
    setChecked('autoApprovePaidBookings', booking.auto_approve_paid_bookings);
    setChecked('requirePaidCheckIn', booking.require_paid_check_in);

    setValue('adminEmail', notifications.admin_email);
    setChecked('bookingAlerts', notifications.booking_alerts);
    setChecked('paymentUpdates', notifications.payment_updates);
    setChecked('checkInAlerts', notifications.check_in_alerts);
    setChecked('dailySummary', notifications.daily_summary);

    renderIntegrations(data.integrations);
    const updated = document.getElementById('settingsUpdatedAt');
    if (updated) updated.textContent = `Last updated: ${formatDate(data.updated_at)}`;
    if (window.lucide) lucide.createIcons();
  }

  function collectPayload() {
    return {
      resort_profile: {
        resort_name: getValue('resortName'),
        support_email: getValue('supportEmail'),
        support_phone: getValue('supportPhone'),
        address: getValue('resortAddress'),
        business_hours: getValue('businessHours'),
        website_url: getValue('websiteUrl'),
      },
      booking_rules: {
        check_in_time: getValue('checkInTime'),
        check_out_time: getValue('checkOutTime'),
        min_advance_hours: getNumber('minAdvanceHours'),
        max_guest_per_booking: getNumber('maxGuestPerBooking'),
        auto_approve_paid_bookings: getChecked('autoApprovePaidBookings'),
        require_paid_check_in: getChecked('requirePaidCheckIn'),
      },
      notifications: {
        booking_alerts: getChecked('bookingAlerts'),
        payment_updates: getChecked('paymentUpdates'),
        check_in_alerts: getChecked('checkInAlerts'),
        daily_summary: getChecked('dailySummary'),
        admin_email: getValue('adminEmail'),
      },
    };
  }

  async function loadSettings() {
    hideAlert();
    const data = await api('/api/admin/settings');
    populate(data);
  }

  async function saveSettings(event) {
    event.preventDefault();
    hideAlert();
    setLoading(true);
    try {
      const data = await api('/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify(collectPayload()),
      });
      populate(data);
      showAlert('Settings saved.', 'success');
    } catch (err) {
      showAlert(err.message);
    } finally {
      setLoading(false);
    }
  }

  document.getElementById('settingsForm')?.addEventListener('submit', saveSettings);
  document.getElementById('reloadSettingsBtn')?.addEventListener('click', () => {
    loadSettings().catch((err) => showAlert(err.message));
  });

  loadSettings().catch((err) => showAlert(err.message));
})();
