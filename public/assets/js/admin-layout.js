/**
 * Admin layout — sidebar, topbar, mobile overlay.
 * Styles live in /css/admin.css (no inline CSS injection).
 */
(function () {
  const sidebarLinks = [
    { name: 'Dashboard', path: '/admin/dashboard.html', icon: 'layout-dashboard' },
    { name: 'Manage Facilities', path: '/admin/facilities.html', icon: 'palmtree' },
    { name: 'Rates & Promos', path: '/admin/rates.html', icon: 'tags' },
    { name: 'Calendar', path: '/admin/calendar.html', icon: 'calendar' },
    { name: 'Bookings', path: '/admin/bookings.html', icon: 'book-open' },
    { name: 'Check-in / QR', path: '/admin/check-in.html', icon: 'qr-code' },
    { name: 'Reports', path: '/admin/reports.html', icon: 'bar-chart-3' },
    { name: 'Clients / Users', path: '/admin/users.html', icon: 'users' },
    { name: 'System Logs', path: '/admin/logs.html', icon: 'scroll-text' },
    { name: 'Settings', path: '/admin/settings.html', icon: 'settings' },
  ];

  function getPageTitle(path) {
    const link = sidebarLinks.find((l) => l.path === path);
    return link ? link.name : 'Admin Panel';
  }

  function closeSidebar() {
    document.getElementById('adminSidebar')?.classList.remove('open');
    document.getElementById('sidebarOverlay')?.classList.remove('visible');
  }

  function openSidebar() {
    document.getElementById('adminSidebar')?.classList.add('open');
    document.getElementById('sidebarOverlay')?.classList.add('visible');
  }

  function injectLayout() {
    if (document.getElementById('admin-layout-injected')) return;

    const currentPath = window.location.pathname;
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    const sidebarHtml = `
      <aside class="admin-sidebar" id="adminSidebar" aria-label="Admin navigation">
        <div class="sidebar-header">
          <img src="/admin-logo.svg" alt="Mamagan Admin" height="35">
          <button type="button" class="mobile-toggle" id="sidebarClose" aria-label="Close menu">
            <i data-lucide="x"></i>
          </button>
        </div>
        <nav class="sidebar-nav" role="navigation">
          ${sidebarLinks
            .map(
              (link) => `
            <a href="${link.path}" class="nav-link sidebar-link ${
                currentPath === link.path ? 'active' : ''
              }">
              <i data-lucide="${link.icon}" aria-hidden="true"></i>
              <span>${link.name}</span>
            </a>
          `
            )
            .join('')}
        </nav>
        <div class="sidebar-footer">
          <button type="button" id="adminLogout" class="logout-btn">
            <i data-lucide="log-out" aria-hidden="true"></i>
            <span>Logout</span>
          </button>
        </div>
      </aside>
    `;

    const topbarHtml = `
      <div class="sidebar-overlay" id="sidebarOverlay" aria-hidden="true"></div>
      <header class="admin-topbar">
        <div class="topbar-left">
          <button type="button" class="mobile-toggle mobile-menu-btn" id="sidebarOpen" aria-label="Open menu">
            <i data-lucide="menu"></i>
          </button>
          <h2 id="pageTitle">${getPageTitle(currentPath)}</h2>
        </div>
        <div class="topbar-right">
          <div class="admin-profile">
            <div class="profile-info">
              <span class="admin-name">${user.name || 'Staff'}</span>
              <span class="admin-role">${(user.role || 'ADMIN').toString().toUpperCase()}</span>
            </div>
            <img src="/default-avatar.svg" alt="" class="admin-avatar" width="40" height="40">
          </div>
        </div>
      </header>
    `;

    const wrapper = document.createElement('div');
    wrapper.className = 'admin-shell admin-layout-wrapper';
    wrapper.id = 'admin-layout-injected';

    const main = document.createElement('main');
    main.className = 'admin-content admin-main-content';

    while (document.body.firstChild) {
      main.appendChild(document.body.firstChild);
    }

    wrapper.insertAdjacentHTML('afterbegin', sidebarHtml);
    wrapper.insertAdjacentHTML('beforeend', topbarHtml);
    wrapper.appendChild(main);
    document.body.appendChild(wrapper);

    document.getElementById('sidebarOpen')?.addEventListener('click', openSidebar);
    document.getElementById('sidebarClose')?.addEventListener('click', closeSidebar);
    document.getElementById('sidebarOverlay')?.addEventListener('click', closeSidebar);

    document.getElementById('adminLogout')?.addEventListener('click', async () => {
      try {
        await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
      } catch (_) {
        /* ignore */
      }
      localStorage.clear();
      window.location.replace('/admin/login.html');
    });

    if (window.lucide) lucide.createIcons();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectLayout);
  } else {
    injectLayout();
  }

  window.AdminLayout = {
    setPageTitle: (title) => {
      const el = document.getElementById('pageTitle');
      if (el) el.textContent = title;
    },
  };
})();
