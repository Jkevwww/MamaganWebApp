/**
 * Admin dashboard: live stats and charts with empty/error states.
 */
(function () {
  const token = localStorage.getItem('token');
  const authHeader = token ? { Authorization: `Bearer ${token}` } : {};
  const charts = new Map();

  const palette = {
    primary: '#0d9488',
    teal: '#14b8a6',
    green: '#10b981',
    amber: '#f59e0b',
    red: '#ef4444',
    blue: '#2563eb',
    slate: '#64748b',
    gray: '#94a3b8',
  };

  function cssVar(name, fallback) {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || fallback;
  }

  function money(value) {
    return `PHP ${Number(value || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  function showAlert(message, type = 'error') {
    const el = document.getElementById('dashboardAlert');
    if (!el) return;
    el.className = `dashboard-alert dashboard-alert-${type}`;
    el.textContent = message;
  }

  function hideAlert() {
    const el = document.getElementById('dashboardAlert');
    if (!el) return;
    el.className = 'dashboard-alert is-hidden';
    el.textContent = '';
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  async function api(url) {
    const res = await fetch(url, {
      headers: authHeader,
      credentials: 'same-origin',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || `Request failed: ${url}`);
    return data;
  }

  function hasChartData(data) {
    const labels = data?.labels || [];
    const values = data?.values || [];
    return labels.length > 0 && values.some((value) => Number(value || 0) > 0);
  }

  function showChartMessage(wrap, canvas, message) {
    if (!wrap || !canvas) return;
    canvas.style.visibility = 'hidden';
    let el = wrap.querySelector('.chart-empty-msg');
    if (!el) {
      el = document.createElement('p');
      el.className = 'chart-empty-msg';
      wrap.appendChild(el);
    }
    el.textContent = message;
  }

  function clearChartMessage(wrap, canvas) {
    if (!wrap || !canvas) return;
    canvas.style.visibility = 'visible';
    wrap.querySelector('.chart-empty-msg')?.remove();
  }

  function renderChart(canvasId, type, data, options, emptyMessage) {
    const canvas = document.getElementById(canvasId);
    const wrap = canvas?.closest('.chart-canvas-wrap');
    if (!canvas) return;

    if (!window.Chart) {
      showChartMessage(wrap, canvas, 'Charts are unavailable. Please check the network connection.');
      return;
    }

    if (!hasChartData(data)) {
      charts.get(canvasId)?.destroy();
      charts.delete(canvasId);
      showChartMessage(wrap, canvas, emptyMessage);
      return;
    }

    clearChartMessage(wrap, canvas);
    charts.get(canvasId)?.destroy();
    charts.set(canvasId, new Chart(canvas, { type, data, options }));
  }

  function renderStats(stats) {
    const container = document.getElementById('dashboardStats');
    if (!container) return;

    const trend = Number(stats.bookingTrend || 0);
    const trendClass = trend >= 0 ? 'trend-up' : 'trend-down';
    const trendSymbol = trend >= 0 ? 'Up' : 'Down';

    container.innerHTML = `
      <div class="stat-card">
        <div class="stat-label">Total bookings</div>
        <div class="stat-value">${Number(stats.totalBookings || 0).toLocaleString()}</div>
        <div class="stat-trend ${trendClass}">${trendSymbol} ${Math.abs(trend)}% from last month</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Pending bookings</div>
        <div class="stat-value stat-value-accent">${Number(stats.pendingBookings || 0).toLocaleString()}</div>
        <div class="stat-sub">${Number(stats.approvedBookings || 0).toLocaleString()} approved bookings</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Monthly revenue</div>
        <div class="stat-value">${money(stats.monthlyRevenue)}</div>
        <div class="stat-sub">${Number(stats.paidBookings || 0).toLocaleString()} paid bookings</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Today</div>
        <div class="stat-value">${Number(stats.todayBookings || 0).toLocaleString()}</div>
        <div class="stat-sub">${Number(stats.todayCheckins || 0).toLocaleString()} checked in</div>
      </div>
    `;

    setText('focusPendingBookings', Number(stats.pendingBookings || 0).toLocaleString());
    setText('focusPendingPayments', Number(stats.pendingPayments || 0).toLocaleString());
    setText('focusFailedPayments', Number(stats.failedPayments || 0).toLocaleString());
  }

  async function loadRevenueChart() {
    const data = await api('/api/admin/dashboard/revenue-chart');
    const primary = cssVar('--color-primary', palette.primary);
    renderChart(
      'revenueChart',
      'line',
      {
        labels: data.labels || [],
        datasets: [{
          label: 'Revenue',
          data: data.values || [],
          borderColor: primary,
          backgroundColor: `${primary}22`,
          fill: true,
          tension: 0.35,
        }],
      },
      {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, grid: { color: '#f1f5f9' } },
          x: { grid: { display: false } },
        },
      },
      'No paid revenue data yet.'
    );
  }

  async function loadBookingStatusChart() {
    const data = await api('/api/admin/dashboard/booking-status-chart');
    renderChart(
      'statusChart',
      'doughnut',
      {
        labels: data.labels || [],
        datasets: [{
          data: data.values || [],
          backgroundColor: [palette.green, palette.amber, palette.red, palette.slate],
        }],
      },
      {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '68%',
        plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, padding: 14 } } },
      },
      'No booking status data yet.'
    );
  }

  async function loadPaymentStatusChart() {
    const data = await api('/api/admin/dashboard/payment-status-chart');
    renderChart(
      'paymentStatusChart',
      'doughnut',
      {
        labels: data.labels || [],
        datasets: [{
          data: data.values || [],
          backgroundColor: [palette.green, palette.amber, palette.red, palette.blue, palette.gray],
        }],
      },
      {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '68%',
        plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, padding: 14 } } },
      },
      'No payment status data yet.'
    );
  }

  async function loadOccupancyChart() {
    const data = await api('/api/admin/dashboard/occupancy-chart');
    renderChart(
      'occupancyChart',
      'bar',
      {
        labels: data.labels || [],
        datasets: [{
          label: 'Occupancy rate',
          data: data.values || [],
          backgroundColor: cssVar('--color-primary', palette.primary),
          borderRadius: 7,
        }],
      },
      {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, max: 100, ticks: { callback: (value) => `${value}%` } },
          x: { grid: { display: false } },
        },
      },
      'No occupancy data for the next 7 days.'
    );
  }

  async function loadCategoryChart() {
    const data = await api('/api/admin/dashboard/category-usage-chart');
    renderChart(
      'categoryChart',
      'pie',
      {
        labels: data.labels || [],
        datasets: [{
          data: data.values || [],
          backgroundColor: [palette.teal, palette.blue, palette.amber, palette.slate],
        }],
      },
      {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, padding: 14 } } },
      },
      'No category usage data yet.'
    );
  }

  async function loadDashboard() {
    try {
      hideAlert();
      const stats = await api('/api/admin/dashboard/summary');
      renderStats(stats);

      await Promise.all([
        loadRevenueChart(),
        loadBookingStatusChart(),
        loadPaymentStatusChart(),
        loadOccupancyChart(),
        loadCategoryChart(),
      ]);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
      showAlert(err.message || 'Unable to load dashboard data.');
    }
  }

  loadDashboard();
})();
