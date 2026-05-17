/**
 * Admin clients/users directory.
 */
(function () {
  const token = localStorage.getItem('token');
  const authHeader = token ? { Authorization: `Bearer ${token}` } : {};
  let currentUsers = [];

  function esc(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function money(value) {
    return `PHP ${Number(value || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  function formatDate(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function showAlert(message, type = 'error') {
    const el = document.getElementById('usersAlert');
    if (!el) return;
    el.className = `dashboard-alert ${type === 'success' ? 'dashboard-alert-success' : ''}`;
    el.textContent = message;
  }

  function hideAlert() {
    const el = document.getElementById('usersAlert');
    if (!el) return;
    el.className = 'dashboard-alert is-hidden';
    el.textContent = '';
  }

  function setButtonLoading(id, isLoading) {
    const btn = document.getElementById(id);
    if (!btn) return;
    if (!btn.dataset.originalText) btn.dataset.originalText = btn.textContent;
    btn.disabled = isLoading;
    btn.textContent = isLoading ? 'Please wait...' : btn.dataset.originalText;
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
    if (!res.ok) throw new Error(data.message || 'Request failed');
    return data;
  }

  function getFilterParams() {
    const params = new URLSearchParams();
    const values = {
      search: document.getElementById('userSearch')?.value.trim(),
      type: document.getElementById('userTypeFilter')?.value,
      accessTier: document.getElementById('accessTierFilter')?.value,
      active: document.getElementById('activeFilter')?.value,
    };
    Object.entries(values).forEach(([key, value]) => {
      if (value && value !== 'ALL') params.set(key, value);
    });
    return params;
  }

  function userType(user) {
    const tier = String(user.access_tier || user.role || 'GUEST').toUpperCase();
    return tier === 'GUEST' ? 'Client' : 'Staff/User';
  }

  function accessBadge(tier) {
    const normalized = String(tier || 'GUEST').toUpperCase();
    const label = normalized.replace(/_/g, ' ');
    if (normalized === 'GUEST') return `<span class="status-badge status-confirmed">${label}</span>`;
    if (normalized === 'SUPER_ADMIN' || normalized === 'ADMIN') return `<span class="status-badge status-approved">${label}</span>`;
    if (normalized === 'STAFF') return `<span class="status-badge status-paid">${label}</span>`;
    return `<span class="status-badge status-pending">${label}</span>`;
  }

  function activeBadge(active) {
    return active
      ? '<span class="status-badge status-approved">Active</span>'
      : '<span class="status-badge status-cancelled">Inactive</span>';
  }

  function verifiedBadge(user) {
    return user.email_verified_at
      ? '<span class="user-inline-badge user-inline-badge-ok">Verified</span>'
      : '<span class="user-inline-badge">Unverified</span>';
  }

  function renderSummary(summary = {}) {
    setText('totalUsers', Number(summary.totalUsers || 0).toLocaleString());
    setText('clientCount', Number(summary.clientCount || 0).toLocaleString());
    setText('staffCount', Number(summary.staffCount || 0).toLocaleString());
    setText('inactiveCount', Number(summary.inactiveCount || 0).toLocaleString());
    setText('activeCount', `${Number(summary.activeCount || 0).toLocaleString()} active accounts`);
    setText('verifiedUsers', `${Number(summary.verifiedCount || 0).toLocaleString()} verified emails`);
  }

  function renderUsers(users) {
    const tbody = document.getElementById('usersTbody');
    if (!tbody) return;

    if (!users.length) {
      tbody.innerHTML = `
        <tr><td colspan="9">
          <div class="empty-state"><p>No users found for the selected filters.</p></div>
        </td></tr>`;
      return;
    }

    tbody.innerHTML = users.map((user) => `
      <tr>
        <td>
          <div class="user-directory-person">
            <div class="user-avatar-small">${esc(String(user.name || user.email || 'U').charAt(0).toUpperCase())}</div>
            <div>
              <div class="text-strong">${esc(user.name)}</div>
              <div class="text-muted small-muted">#${esc(user.id)} ${verifiedBadge(user)}</div>
            </div>
          </div>
        </td>
        <td>
          <div>${esc(user.email)}</div>
          <div class="text-muted small-muted">${esc(user.phone || '-')}</div>
        </td>
        <td>${esc(userType(user))}</td>
        <td>${accessBadge(user.access_tier || user.role)}</td>
        <td>${activeBadge(user.active)}</td>
        <td>${Number(user.booking_count || 0).toLocaleString()}</td>
        <td>${money(user.paid_revenue)}</td>
        <td>${esc(formatDate(user.last_login_at))}</td>
        <td>
          <div class="table-actions">
            <select class="form-select user-access-select" data-user-id="${esc(user.id)}" aria-label="Change access tier for ${esc(user.name)}">
              ${['GUEST', 'VIEWER', 'STAFF', 'ADMIN', 'SUPER_ADMIN'].map((tier) => `
                <option value="${tier}" ${String(user.access_tier || user.role).toUpperCase() === tier ? 'selected' : ''}>${tier.replace(/_/g, ' ')}</option>
              `).join('')}
            </select>
            <button type="button" class="btn-sm ${user.active ? 'btn-cancel' : 'btn-approve'} user-status-btn" data-user-id="${esc(user.id)}" data-active="${user.active ? '0' : '1'}">
              ${user.active ? 'Deactivate' : 'Activate'}
            </button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  async function loadUsers() {
    hideAlert();
    const tbody = document.getElementById('usersTbody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="9" class="text-center">Loading users...</td></tr>';
    const params = getFilterParams();
    const data = await api(`/api/admin/users?${params.toString()}`);
    currentUsers = Array.isArray(data.users) ? data.users : [];
    renderSummary(data.summary || {});
    renderUsers(currentUsers);
    if (window.lucide) lucide.createIcons();
  }

  async function updateUserAccess(userId, patch) {
    await api(`/api/admin/users/${encodeURIComponent(userId)}/access`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    showAlert('User account updated.', 'success');
    await loadUsers();
  }

  function openStaffModal() {
    hideAlert();
    document.getElementById('staffForm')?.reset();
    const modal = document.getElementById('staffModal');
    modal?.classList.add('open');
    modal?.setAttribute('aria-hidden', 'false');
    document.getElementById('staffName')?.focus();
  }

  function closeStaffModal() {
    const modal = document.getElementById('staffModal');
    modal?.classList.remove('open');
    modal?.setAttribute('aria-hidden', 'true');
  }

  async function submitStaffForm(event) {
    event.preventDefault();
    hideAlert();
    const password = document.getElementById('staffPassword').value;
    const confirmPassword = document.getElementById('staffConfirmPassword').value;
    if (password !== confirmPassword) {
      showAlert('Staff password and confirmation do not match.');
      return;
    }

    setButtonLoading('saveStaffBtn', true);
    try {
      await api('/api/admin/users/staff', {
        method: 'POST',
        body: JSON.stringify({
          name: document.getElementById('staffName').value.trim(),
          email: document.getElementById('staffEmail').value.trim(),
          phone: document.getElementById('staffPhone').value.trim(),
          access_tier: document.getElementById('staffAccessTier').value,
          password,
        }),
      });
      closeStaffModal();
      showAlert('Staff account created.', 'success');
      await loadUsers();
    } catch (err) {
      showAlert(err.message);
    } finally {
      setButtonLoading('saveStaffBtn', false);
    }
  }

  document.getElementById('usersFilters')?.addEventListener('submit', (event) => {
    event.preventDefault();
    loadUsers().catch((err) => showAlert(err.message));
  });
  document.getElementById('resetUsersBtn')?.addEventListener('click', () => {
    document.getElementById('userSearch').value = '';
    document.getElementById('userTypeFilter').value = 'ALL';
    document.getElementById('accessTierFilter').value = '';
    document.getElementById('activeFilter').value = '';
    loadUsers().catch((err) => showAlert(err.message));
  });
  document.getElementById('openStaffModalBtn')?.addEventListener('click', openStaffModal);
  document.getElementById('closeStaffModalBtn')?.addEventListener('click', closeStaffModal);
  document.getElementById('cancelStaffBtn')?.addEventListener('click', closeStaffModal);
  document.getElementById('staffModal')?.addEventListener('click', (event) => {
    if (event.target?.id === 'staffModal') closeStaffModal();
  });
  document.getElementById('staffForm')?.addEventListener('submit', submitStaffForm);

  document.getElementById('usersTbody')?.addEventListener('change', (event) => {
    const select = event.target.closest('.user-access-select');
    if (!select) return;
    updateUserAccess(select.dataset.userId, { access_tier: select.value }).catch((err) => {
      showAlert(err.message);
      loadUsers().catch((loadErr) => showAlert(loadErr.message));
    });
  });

  document.getElementById('usersTbody')?.addEventListener('click', (event) => {
    const button = event.target.closest('.user-status-btn');
    if (!button) return;
    updateUserAccess(button.dataset.userId, { active: button.dataset.active }).catch((err) => showAlert(err.message));
  });

  loadUsers().catch((err) => showAlert(err.message));
})();
