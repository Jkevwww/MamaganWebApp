/**
 * Admin Dashboard — stats + charts (empty states when no data).
 */
(function () {
  const token = localStorage.getItem('token');
  const authHeader = { Authorization: `Bearer ${token}` };

  const primary = () => {
    const v = getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim();
    return v || '#0d9488';
  };

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

  async function loadDashboard() {
    try {
      const summaryRes = await fetch('/api/admin/dashboard/summary', { headers: authHeader });
      const stats = await summaryRes.json();
      renderStats(stats);

      await Promise.all([
        loadRevenueChart(),
        loadBookingStatusChart(),
        loadOccupancyChart(),
        loadCategoryChart(),
      ]);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    }
  }

  function renderStats(stats) {
    const container = document.getElementById('dashboardStats');
    if (!container) return;
    container.innerHTML = `
      <div class="stat-card">
        <div class="stat-label">Total Bookings</div>
        <div class="stat-value">${stats.totalBookings || 0}</div>
        <div class="stat-trend ${stats.bookingTrend >= 0 ? 'trend-up' : 'trend-down'}">
           ${stats.bookingTrend >= 0 ? '↑' : '↓'} ${Math.abs(stats.bookingTrend || 0)}% from last month
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Pending Reviews</div>
        <div class="stat-value stat-value-accent">${stats.pendingBookings || 0}</div>
        <div class="stat-sub">Action required</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Monthly Revenue</div>
        <div class="stat-value">₱${(stats.monthlyRevenue || 0).toLocaleString()}</div>
        <div class="stat-trend trend-up">↑ 12% vs last month</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Today's Check-ins</div>
        <div class="stat-value">${stats.todayCheckins || 0}</div>
        <div class="stat-sub">${stats.availableUnits || 0} units currently free</div>
      </div>
    `;
  }

  async function loadRevenueChart() {
    const canvas = document.getElementById('revenueChart');
    const wrap = canvas?.closest('.chart-canvas-wrap');
    if (!canvas) return;

    const res = await fetch('/api/admin/dashboard/revenue-chart', { headers: authHeader });
    const data = await res.json();
    const labels = data.labels || [];
    const values = data.values || [];

    if (!labels.length || !values.length) {
      showChartMessage(wrap, canvas, 'No paid revenue data for the selected period yet.');
      return;
    }
    clearChartMessage(wrap, canvas);

    const col = primary();
    new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Revenue (PHP)',
            data: values,
            borderColor: col,
            backgroundColor: col + '22',
            fill: true,
            tension: 0.4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, grid: { color: '#f1f5f9' } },
          x: { grid: { display: false } },
        },
      },
    });
  }

  async function loadBookingStatusChart() {
    const canvas = document.getElementById('statusChart');
    const wrap = canvas?.closest('.chart-canvas-wrap');
    if (!canvas) return;

    const res = await fetch('/api/admin/dashboard/booking-status-chart', { headers: authHeader });
    const data = await res.json();
    const labels = data.labels || [];
    const values = data.values || [];

    if (!labels.length || !values.length) {
      showChartMessage(wrap, canvas, 'No booking status data yet.');
      return;
    }
    clearChartMessage(wrap, canvas);

    new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [
          {
            data: values,
            backgroundColor: ['#10b981', '#f59e0b', '#ef4444', '#64748b', '#0d9488', '#94a3b8'],
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        plugins: {
          legend: { position: 'bottom', labels: { usePointStyle: true, padding: 16 } },
        },
      },
    });
  }

  async function loadOccupancyChart() {
    const canvas = document.getElementById('occupancyChart');
    const wrap = canvas?.closest('.chart-canvas-wrap');
    if (!canvas) return;

    const res = await fetch('/api/admin/dashboard/occupancy-chart', { headers: authHeader });
    const data = await res.json();
    const labels = data.labels || [];
    const values = data.values || [];

    if (!labels.length || !values.length) {
      showChartMessage(wrap, canvas, 'No occupancy data available.');
      return;
    }
    clearChartMessage(wrap, canvas);

    new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Occupancy Rate (%)',
            data: values,
            backgroundColor: primary(),
            borderRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, max: 100 },
          x: { grid: { display: false } },
        },
      },
    });
  }

  async function loadCategoryChart() {
    const canvas = document.getElementById('categoryChart');
    const wrap = canvas?.closest('.chart-canvas-wrap');
    if (!canvas) return;

    clearChartMessage(wrap, canvas);
    new Chart(canvas, {
      type: 'pie',
      data: {
        labels: ['Cottages', 'Cabanas', 'Equipment'],
        datasets: [
          {
            data: [45, 30, 25],
            backgroundColor: ['#14b8a6', '#d4c4a8', '#ea580c'],
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' } },
      },
    });
  }

  loadDashboard();
})();
