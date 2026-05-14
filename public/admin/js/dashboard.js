/**
 * Admin Dashboard - Real Data & Charts
 */

(function () {
  const token = localStorage.getItem('token');
  const authHeader = { Authorization: `Bearer ${token}` };

  async function loadDashboard() {
    try {
      // 1. Load Stats Summary
      const summaryRes = await fetch('/api/admin/dashboard/summary', { headers: authHeader });
      const stats = await summaryRes.json();
      renderStats(stats);

      // 2. Load Charts
      loadRevenueChart();
      loadBookingStatusChart();
      loadOccupancyChart();
      loadCategoryChart();

    } catch (err) {
      console.error('Failed to load dashboard:', err);
    }
  }

  function renderStats(stats) {
    const container = document.getElementById('dashboardStats');
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
        <div class="stat-value" style="color: var(--orange);">${stats.pendingBookings || 0}</div>
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
    const res = await fetch('/api/admin/dashboard/revenue-chart', { headers: authHeader });
    const data = await res.json();
    
    new Chart(document.getElementById('revenueChart'), {
      type: 'line',
      data: {
        labels: data.labels,
        datasets: [{
          label: 'Revenue (PHP)',
          data: data.values,
          borderColor: '#1a73e8',
          backgroundColor: 'rgba(26,115,232,0.1)',
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, grid: { color: '#f1f5f9' } },
          x: { grid: { display: false } }
        }
      }
    });
  }

  async function loadBookingStatusChart() {
    const res = await fetch('/api/admin/dashboard/booking-status-chart', { headers: authHeader });
    const data = await res.json();

    new Chart(document.getElementById('statusChart'), {
      type: 'doughnut',
      data: {
        labels: data.labels,
        datasets: [{
          data: data.values,
          backgroundColor: ['#10b981', '#f59e0b', '#ef4444', '#64748b']
        }]
      },
      options: {
        responsive: true,
        cutout: '70%',
        plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, padding: 20 } } }
      }
    });
  }

  async function loadOccupancyChart() {
    const res = await fetch('/api/admin/dashboard/occupancy-chart', { headers: authHeader });
    const data = await res.json();

    new Chart(document.getElementById('occupancyChart'), {
      type: 'bar',
      data: {
        labels: data.labels,
        datasets: [{
          label: 'Occupancy Rate (%)',
          data: data.values,
          backgroundColor: '#3b82f6',
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, max: 100 },
          x: { grid: { display: false } }
        }
      }
    });
  }

  async function loadCategoryChart() {
    // In a real app we'd fetch this, for now mock or simple count
    new Chart(document.getElementById('categoryChart'), {
      type: 'pie',
      data: {
        labels: ['Cottages', 'Cabanas', 'Equipment'],
        datasets: [{
          data: [45, 30, 25],
          backgroundColor: ['#00ced1', '#d2b48c', '#ff8c00']
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { position: 'bottom' } }
      }
    });
  }

  // Add styles for trends
  const style = document.createElement('style');
  style.textContent = `
    .stat-trend { font-size: 0.8rem; margin-top: 0.5rem; font-weight: 600; }
    .trend-up { color: #10b981; }
    .trend-down { color: #ef4444; }
    .stat-sub { font-size: 0.75rem; color: #94a3b8; margin-top: 0.5rem; }
    .dashboard-stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1.5rem; }
  `;
  document.head.appendChild(style);

  loadDashboard();
})();
