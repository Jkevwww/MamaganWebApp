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
    const values = data?.values || data?.datasets?.flatMap((dataset) => dataset.data || []) || [];
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

  function chartDataset(data) {
    return data.datasets?.[0] || { data: [], backgroundColor: [] };
  }

  function sizeCanvas(canvas) {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(320, Math.floor(rect.width || canvas.parentElement?.clientWidth || 320));
    const height = Math.max(220, Math.floor(rect.height || 240));
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, width, height };
  }

  function drawLegend(ctx, labels, colors, x, y, maxWidth) {
    ctx.font = '12px Arial, sans-serif';
    ctx.textBaseline = 'middle';
    let cursorX = x;
    let cursorY = y;
    labels.forEach((label, index) => {
      const text = String(label);
      const itemWidth = 18 + ctx.measureText(text).width + 16;
      if (cursorX + itemWidth > x + maxWidth) {
        cursorX = x;
        cursorY += 20;
      }
      ctx.fillStyle = colors[index % colors.length] || palette.slate;
      ctx.beginPath();
      ctx.arc(cursorX + 6, cursorY, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#475569';
      ctx.fillText(text, cursorX + 18, cursorY);
      cursorX += itemWidth;
    });
  }

  function drawLineChart(ctx, labels, values, color, width, height) {
    const pad = { top: 18, right: 18, bottom: 46, left: 50 };
    const chartWidth = width - pad.left - pad.right;
    const chartHeight = height - pad.top - pad.bottom;
    const maxValue = Math.max(...values, 1);

    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + (chartHeight / 4) * i;
      ctx.moveTo(pad.left, y);
      ctx.lineTo(width - pad.right, y);
    }
    ctx.stroke();

    ctx.font = '11px Arial, sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
      const value = Math.round(maxValue - (maxValue / 4) * i);
      ctx.fillText(value.toLocaleString(), pad.left - 8, pad.top + (chartHeight / 4) * i + 4);
    }

    const points = values.map((value, index) => {
      const x = pad.left + (labels.length <= 1 ? chartWidth / 2 : (chartWidth / (labels.length - 1)) * index);
      const y = pad.top + chartHeight - (Number(value || 0) / maxValue) * chartHeight;
      return { x, y };
    });

    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    points.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.stroke();

    ctx.fillStyle = color;
    points.forEach((point) => {
      ctx.beginPath();
      ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.fillStyle = '#64748b';
    ctx.textAlign = 'center';
    labels.forEach((label, index) => {
      const x = pad.left + (labels.length <= 1 ? chartWidth / 2 : (chartWidth / (labels.length - 1)) * index);
      ctx.fillText(String(label), x, height - 18);
    });
  }

  function roundedRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(x, y, width, height, r);
      return;
    }
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
  }

  function drawBarChart(ctx, labels, values, color, width, height) {
    const pad = { top: 18, right: 18, bottom: 46, left: 42 };
    const chartWidth = width - pad.left - pad.right;
    const chartHeight = height - pad.top - pad.bottom;
    const maxValue = Math.max(...values, 100);
    const gap = 10;
    const barWidth = Math.max(18, (chartWidth - gap * (values.length - 1)) / Math.max(values.length, 1));

    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + (chartHeight / 4) * i;
      ctx.moveTo(pad.left, y);
      ctx.lineTo(width - pad.right, y);
    }
    ctx.stroke();

    values.forEach((value, index) => {
      const barHeight = (Number(value || 0) / maxValue) * chartHeight;
      const x = pad.left + index * (barWidth + gap);
      const y = pad.top + chartHeight - barHeight;
      ctx.fillStyle = color;
      ctx.beginPath();
      roundedRect(ctx, x, y, barWidth, barHeight, 7);
      ctx.fill();
    });

    ctx.font = '11px Arial, sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.textAlign = 'center';
    labels.forEach((label, index) => {
      const x = pad.left + index * (barWidth + gap) + barWidth / 2;
      ctx.fillText(String(label), x, height - 18);
    });
  }

  function drawCircleChart(ctx, labels, values, colors, type, width, height) {
    const total = values.reduce((sum, value) => sum + Number(value || 0), 0);
    const centerX = width / 2;
    const centerY = Math.max(90, height / 2 - 18);
    const radius = Math.min(width, height - 54) * 0.28;
    let start = -Math.PI / 2;

    values.forEach((value, index) => {
      const slice = (Number(value || 0) / total) * Math.PI * 2;
      ctx.fillStyle = colors[index % colors.length] || palette.slate;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, start, start + slice);
      ctx.closePath();
      ctx.fill();
      start += slice;
    });

    if (type === 'doughnut') {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * 0.58, 0, Math.PI * 2);
      ctx.fill();
    }

    drawLegend(ctx, labels, colors, 18, height - 36, width - 36);
  }

  function renderCanvasFallback(canvas, type, data, emptyMessage) {
    if (!hasChartData(data)) {
      showChartMessage(canvas.closest('.chart-canvas-wrap'), canvas, emptyMessage);
      return;
    }
    clearChartMessage(canvas.closest('.chart-canvas-wrap'), canvas);

    const { ctx, width, height } = sizeCanvas(canvas);
    const labels = data.labels || [];
    const dataset = chartDataset(data);
    const values = (dataset.data || []).map((value) => Number(value || 0));
    const colors = dataset.backgroundColor || [dataset.borderColor || palette.primary];
    ctx.clearRect(0, 0, width, height);

    if (type === 'line') {
      drawLineChart(ctx, labels, values, dataset.borderColor || palette.primary, width, height);
    } else if (type === 'bar') {
      drawBarChart(ctx, labels, values, dataset.backgroundColor || palette.primary, width, height);
    } else {
      drawCircleChart(ctx, labels, values, colors, type, width, height);
    }
  }

  function renderChart(canvasId, type, data, options, emptyMessage) {
    const canvas = document.getElementById(canvasId);
    const wrap = canvas?.closest('.chart-canvas-wrap');
    if (!canvas) return;

    if (!hasChartData(data)) {
      charts.get(canvasId)?.destroy();
      charts.delete(canvasId);
      showChartMessage(wrap, canvas, emptyMessage);
      return;
    }

    clearChartMessage(wrap, canvas);
    if (!window.Chart) {
      charts.get(canvasId)?.destroy?.();
      charts.delete(canvasId);
      renderCanvasFallback(canvas, type, data, emptyMessage);
      return;
    }

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
          backgroundColor: '#ffffff',
          pointBackgroundColor: primary,
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
          fill: false,
          tension: 0.32,
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
