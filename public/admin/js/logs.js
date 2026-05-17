/**
 * Admin system logs monitor.
 */
(function () {
  const token = localStorage.getItem('token');
  const authHeader = token ? { Authorization: `Bearer ${token}` } : {};
  let currentLogs = [];

  function esc(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
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
      second: '2-digit',
    });
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function showAlert(message, type = 'error') {
    const el = document.getElementById('logsAlert');
    if (!el) return;
    el.className = `dashboard-alert ${type === 'success' ? 'dashboard-alert-success' : ''}`;
    el.textContent = message;
  }

  function hideAlert() {
    const el = document.getElementById('logsAlert');
    if (!el) return;
    el.className = 'dashboard-alert is-hidden';
    el.textContent = '';
  }

  async function api(url) {
    const res = await fetch(url, {
      headers: authHeader,
      credentials: 'same-origin',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'Unable to load system logs.');
    return data;
  }

  function getFilterParams() {
    const params = new URLSearchParams();
    const values = {
      search: document.getElementById('logSearch')?.value.trim(),
      actorType: document.getElementById('logActorFilter')?.value,
      module: document.getElementById('logModuleFilter')?.value,
      action: document.getElementById('logActionFilter')?.value,
      startDate: document.getElementById('logStartDate')?.value,
      endDate: document.getElementById('logEndDate')?.value,
      limit: 300,
    };
    Object.entries(values).forEach(([key, value]) => {
      if (value && value !== 'ALL') params.set(key, value);
    });
    return params;
  }

  function actionBadge(action) {
    const value = String(action || '').toUpperCase();
    if (value.includes('FAILED') || value.includes('UNAUTHORIZED') || value.includes('ERROR')) {
      return `<span class="status-badge status-rejected">${esc(action)}</span>`;
    }
    if (value.includes('LOGIN') || value.includes('OAUTH')) {
      return `<span class="status-badge status-confirmed">${esc(action)}</span>`;
    }
    if (value.includes('CREATED') || value.includes('UPDATED') || value.includes('CHECKED_IN')) {
      return `<span class="status-badge status-approved">${esc(action)}</span>`;
    }
    if (value.includes('DELETED') || value.includes('CANCELLED')) {
      return `<span class="status-badge status-cancelled">${esc(action)}</span>`;
    }
    return `<span class="status-badge status-pending">${esc(action || 'ACTION')}</span>`;
  }

  function actorLabel(log) {
    if (!log.user_id) {
      return `
        <div class="text-strong">System / Anonymous</div>
        <div class="text-muted small-muted">No linked user</div>`;
    }
    return `
      <div class="text-strong">${esc(log.user_name || 'Unknown user')}</div>
      <div class="text-muted small-muted">${esc(log.user_email || '')}</div>`;
  }

  function moduleBadge(moduleName) {
    return `<span class="log-module-badge">${esc(moduleName || 'LEGACY')}</span>`;
  }

  function targetLabel(log) {
    const type = log.target_type || '-';
    const id = log.target_id || '-';
    return `
      <div>${esc(type)}</div>
      <div class="text-muted small-muted">${esc(id)}</div>`;
  }

  function parseDetails(details) {
    if (!details) return null;
    if (typeof details === 'object') return details;
    try {
      return JSON.parse(details);
    } catch (_) {
      return details;
    }
  }

  function detailPreview(details) {
    const parsed = parseDetails(details);
    if (!parsed) return '-';
    if (typeof parsed === 'string') return parsed.length > 80 ? `${parsed.slice(0, 80)}...` : parsed;
    const keys = Object.keys(parsed);
    if (!keys.length) return '-';
    return keys.slice(0, 3).map((key) => `${key}: ${String(parsed[key])}`).join(', ');
  }

  function renderSummary(summary = {}) {
    setText('totalLogs', Number(summary.totalLogs || 0).toLocaleString());
    setText('adminLogs', Number(summary.adminLogs || 0).toLocaleString());
    setText('authLogs', Number(summary.authLogs || 0).toLocaleString());
    setText('securityLogs', Number(summary.securityLogs || 0).toLocaleString());
    setText('todayLogs', `${Number(summary.todayLogs || 0).toLocaleString()} today`);
  }

  function populateOptions(options = {}) {
    const actionSelect = document.getElementById('logActionFilter');
    const moduleSelect = document.getElementById('logModuleFilter');
    const currentAction = actionSelect?.value || '';
    const currentModule = moduleSelect?.value || '';

    if (actionSelect) {
      actionSelect.innerHTML = '<option value="">All actions</option>' + (options.actions || [])
        .map((action) => `<option value="${esc(action)}">${esc(action)}</option>`)
        .join('');
      actionSelect.value = currentAction;
    }
    if (moduleSelect) {
      moduleSelect.innerHTML = '<option value="">All modules</option>' + (options.modules || [])
        .map((moduleName) => `<option value="${esc(moduleName)}">${esc(moduleName)}</option>`)
        .join('');
      moduleSelect.value = currentModule;
    }
  }

  function renderLogs(logs) {
    const tbody = document.getElementById('logsTbody');
    if (!tbody) return;

    if (!logs.length) {
      tbody.innerHTML = `
        <tr><td colspan="7">
          <div class="empty-state"><p>No system log records found for the selected filters.</p></div>
        </td></tr>`;
      return;
    }

    tbody.innerHTML = logs.map((log, index) => `
      <tr>
        <td>${esc(formatDate(log.created_at))}</td>
        <td>${actorLabel(log)}</td>
        <td>${actionBadge(log.action)}</td>
        <td>${moduleBadge(log.module)}</td>
        <td>${targetLabel(log)}</td>
        <td>${esc(log.ip_address || '-')}</td>
        <td>
          <button type="button" class="log-detail-button" data-log-index="${index}">
            ${esc(detailPreview(log.details))}
          </button>
        </td>
      </tr>
    `).join('');
  }

  async function loadLogs() {
    hideAlert();
    const tbody = document.getElementById('logsTbody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="text-center">Loading system logs...</td></tr>';
    const data = await api(`/api/admin/logs?${getFilterParams().toString()}`);
    currentLogs = Array.isArray(data.logs) ? data.logs : [];
    renderSummary(data.summary || {});
    populateOptions(data.options || {});
    renderLogs(currentLogs);
    if (window.lucide) lucide.createIcons();
  }

  function openDetails(log) {
    const modal = document.getElementById('logDetailsModal');
    const list = document.getElementById('logDetailsList');
    const raw = document.getElementById('logDetailsRaw');
    if (!modal || !list || !raw) return;

    setText('logDetailsSubtitle', `${log.action || 'Action'} at ${formatDate(log.created_at)}`);
    const actor = log.user_id ? `${log.user_name || 'Unknown'} (${log.user_email || 'no email'})` : 'System / Anonymous';
    const fields = [
      ['Actor', actor],
      ['Access tier', log.user_access_tier || log.user_role || '-'],
      ['Action', log.action || '-'],
      ['Module', log.module || '-'],
      ['Target', `${log.target_type || '-'} ${log.target_id || ''}`.trim()],
      ['IP address', log.ip_address || '-'],
      ['User agent', log.user_agent || '-'],
    ];
    list.innerHTML = fields.map(([label, value]) => `
      <dt>${esc(label)}</dt>
      <dd>${esc(value)}</dd>
    `).join('');

    const parsed = parseDetails(log.details);
    raw.textContent = parsed && typeof parsed === 'object'
      ? JSON.stringify(parsed, null, 2)
      : String(parsed || 'No additional details');

    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
  }

  function closeDetails() {
    const modal = document.getElementById('logDetailsModal');
    modal?.classList.remove('open');
    modal?.setAttribute('aria-hidden', 'true');
  }

  function csvCell(value) {
    const text = String(value ?? '');
    return `"${text.replace(/"/g, '""')}"`;
  }

  function exportCsv() {
    if (!currentLogs.length) {
      showAlert('There are no log records to export.');
      return;
    }
    const headers = ['Date', 'Actor', 'Email', 'Access Tier', 'Action', 'Module', 'Target Type', 'Target ID', 'IP Address', 'Details'];
    const lines = [headers.map(csvCell).join(',')];
    currentLogs.forEach((log) => {
      const details = parseDetails(log.details);
      lines.push([
        formatDate(log.created_at),
        log.user_name || 'System / Anonymous',
        log.user_email || '',
        log.user_access_tier || log.user_role || '',
        log.action || '',
        log.module || '',
        log.target_type || '',
        log.target_id || '',
        log.ip_address || '',
        details && typeof details === 'object' ? JSON.stringify(details) : (details || ''),
      ].map(csvCell).join(','));
    });

    const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `mamagan-system-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showAlert('System logs exported.', 'success');
  }

  document.getElementById('logsFilters')?.addEventListener('submit', (event) => {
    event.preventDefault();
    loadLogs().catch((err) => showAlert(err.message));
  });
  document.getElementById('resetLogsBtn')?.addEventListener('click', () => {
    document.getElementById('logSearch').value = '';
    document.getElementById('logActorFilter').value = 'ALL';
    document.getElementById('logModuleFilter').value = '';
    document.getElementById('logActionFilter').value = '';
    document.getElementById('logStartDate').value = '';
    document.getElementById('logEndDate').value = '';
    loadLogs().catch((err) => showAlert(err.message));
  });
  document.getElementById('exportLogsBtn')?.addEventListener('click', exportCsv);
  document.getElementById('logsTbody')?.addEventListener('click', (event) => {
    const button = event.target.closest('.log-detail-button');
    if (!button) return;
    const log = currentLogs[Number(button.dataset.logIndex)];
    if (log) openDetails(log);
  });
  document.getElementById('closeLogDetailsBtn')?.addEventListener('click', closeDetails);
  document.getElementById('dismissLogDetailsBtn')?.addEventListener('click', closeDetails);
  document.getElementById('logDetailsModal')?.addEventListener('click', (event) => {
    if (event.target?.id === 'logDetailsModal') closeDetails();
  });

  loadLogs().catch((err) => showAlert(err.message));
})();
