/**
 * Admin layout — sidebar, topbar, mobile overlay.
 * Styles live in /css/admin.css (no inline CSS injection).
 */
(function () {
  const sidebarLinks = [
    { name: 'Dashboard', path: '/admin/dashboard.html', icon: 'dashboard-panel.svg' },
    { name: 'Manage Facilities', path: '/admin/facilities.html', icon: 'apartment.svg' },
    { name: 'Rates & Promos', path: '/admin/rates.html', icon: 'tags.svg' },
    { name: 'Calendar', path: '/admin/calendar.html', icon: 'calendar.svg' },
    { name: 'Bookings', path: '/admin/bookings.html', icon: 'book-alt.svg' },
    { name: 'Check-In/QR', path: '/admin/check-in.html', icon: 'qr.svg' },
    { name: 'Reports', path: '/admin/reports.html', icon: 'data-report.svg' },
    { name: 'Clients/Users', path: '/admin/users.html', icon: 'target-audience.svg' },
    { name: 'System Logs', path: '/admin/logs.html', icon: 'log-file.svg' },
    { name: 'Settings', path: '/admin/settings.html', icon: 'settings.svg' },
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

  function isMobileSidebar() {
    return window.matchMedia('(max-width: 1024px)').matches;
  }

  function applySidebarCollapsed(collapsed) {
    const wrapper = document.getElementById('admin-layout-injected');
    const toggle = document.getElementById('sidebarCollapseToggle');
    if (!wrapper) return;

    wrapper.classList.toggle('sidebar-collapsed', collapsed && !isMobileSidebar());
    if (toggle) {
      toggle.setAttribute('aria-pressed', collapsed && !isMobileSidebar() ? 'true' : 'false');
      toggle.setAttribute('title', collapsed && !isMobileSidebar() ? 'Expand sidebar' : 'Collapse sidebar');
    }
  }

  function toggleSidebar() {
    if (isMobileSidebar()) {
      openSidebar();
      return;
    }

    const wrapper = document.getElementById('admin-layout-injected');
    const collapsed = !wrapper?.classList.contains('sidebar-collapsed');
    try {
      localStorage.setItem('adminSidebarCollapsed', collapsed ? '1' : '0');
    } catch (_) {
      // ignore storage failures
    }
    applySidebarCollapsed(collapsed);
  }

  const ADMIN_TIERS = new Set(['SUPER_ADMIN', 'ADMIN', 'STAFF', 'VIEWER']);

  function isAdminUser(user) {
    const role = String(user?.role || '').trim().toUpperCase();
    const tier = String(user?.access_tier || '').trim().toUpperCase();
    return ADMIN_TIERS.has(role) || ADMIN_TIERS.has(tier);
  }

  async function getCurrentAdminUser() {
    const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
    if (res.status === 401) {
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.replace(`/login.html?next=${next}`);
      return null;
    }
    if (!res.ok) {
      window.location.replace('/login.html');
      return null;
    }
    const user = await res.json();
    if (!isAdminUser(user)) {
      window.location.replace('/facilities.html?error=admin_permission');
      return null;
    }
    try {
      localStorage.setItem('user', JSON.stringify(user));
    } catch (_) {
      // ignore storage failures
    }
    return user;
  }

  async function injectLayout() {
    if (document.getElementById('admin-layout-injected')) return;

    const user = await getCurrentAdminUser();
    if (!user) return;

    const currentPath = window.location.pathname;

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
              }" title="${link.name}">
              <img class="sidebar-link-icon" src="/assets/icons/${link.icon}" alt="" aria-hidden="true">
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
          <button type="button" class="sidebar-collapse-toggle" id="sidebarCollapseToggle" aria-label="Toggle sidebar" aria-pressed="false">
            <img src="/assets/icons/menu-burger.svg" alt="" aria-hidden="true">
          </button>
          <h2 id="pageTitle">${getPageTitle(currentPath)}</h2>
        </div>
        <div class="topbar-right">
          <div class="admin-profile">
            <div class="profile-info">
              <span class="admin-name">${user.name || 'Staff'}</span>
              <span class="admin-role">${(user.role || 'ADMIN').toString().toUpperCase()}</span>
            </div>
            <img src="${user.avatar_url || '/default-avatar.svg'}" alt="" class="admin-avatar" width="40" height="40">
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

    let collapsed = false;
    try {
      collapsed = localStorage.getItem('adminSidebarCollapsed') === '1';
    } catch (_) {
      collapsed = false;
    }
    applySidebarCollapsed(collapsed);

    document.getElementById('sidebarCollapseToggle')?.addEventListener('click', toggleSidebar);
    document.getElementById('sidebarClose')?.addEventListener('click', closeSidebar);
    document.getElementById('sidebarOverlay')?.addEventListener('click', closeSidebar);
    window.addEventListener('resize', () => {
      let shouldCollapse = false;
      try {
        shouldCollapse = localStorage.getItem('adminSidebarCollapsed') === '1';
      } catch (_) {
        shouldCollapse = false;
      }
      applySidebarCollapsed(shouldCollapse);
    });

    document.getElementById('adminLogout')?.addEventListener('click', async () => {
      try {
        await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
      } catch (_) {
        /* ignore */
      }
      localStorage.clear();
      window.location.replace('/login.html');
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
