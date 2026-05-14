/**
 * Admin Layout System - Reusable Sidebar & Topbar
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
    { name: 'Settings', path: '/admin/settings.html', icon: 'settings' }
  ];

  function injectLayout() {
    if (document.getElementById('admin-layout-injected')) return;

    const currentPath = window.location.pathname;
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    // 1. Sidebar HTML
    const sidebarHtml = `
      <aside class="admin-sidebar" id="adminSidebar">
        <div class="sidebar-header">
          <img src="/admin-logo.svg" alt="Mamagan Admin" height="35">
          <button class="mobile-toggle" id="sidebarClose"><i data-lucide="x"></i></button>
        </div>
        <nav class="sidebar-nav">
          ${sidebarLinks.map(link => `
            <a href="${link.path}" class="nav-link ${currentPath === link.path ? 'active' : ''}">
              <i data-lucide="${link.icon}"></i>
              <span>${link.name}</span>
            </a>
          `).join('')}
        </nav>
        <div class="sidebar-footer">
          <button id="adminLogout" class="logout-btn">
            <i data-lucide="log-out"></i>
            <span>Logout</span>
          </button>
        </div>
      </aside>
    `;

    // 2. Topbar HTML
    const topbarHtml = `
      <header class="admin-topbar">
        <div class="topbar-left">
          <button class="mobile-toggle" id="sidebarOpen"><i data-lucide="menu"></i></button>
          <h2 id="pageTitle">${getPageTitle(currentPath)}</h2>
        </div>
        <div class="topbar-right">
          <div class="admin-profile">
             <div class="profile-info">
               <span class="admin-name">${user.name || 'Administrator'}</span>
               <span class="admin-role">${user.role?.toUpperCase() || 'ADMIN'}</span>
             </div>
             <img src="/default-avatar.svg" alt="Avatar" class="admin-avatar">
          </div>
        </div>
      </header>
    `;

    // 3. Inject CSS
    const style = document.createElement('style');
    style.id = 'admin-layout-styles';
    style.textContent = `
      :root {
        --sidebar-width: 260px;
        --topbar-height: 70px;
        --sidebar-bg: #1e293b;
        --sidebar-hover: #334155;
        --sidebar-active: #1a73e8;
        --text-muted: #94a3b8;
      }
      
      .admin-layout-wrapper { display: flex; min-height: 100vh; background: #f8fafc; }
      .admin-main-content { flex: 1; margin-left: var(--sidebar-width); padding-top: var(--topbar-height); transition: margin-left 0.3s; }
      
      /* Sidebar */
      .admin-sidebar { width: var(--sidebar-width); height: 100vh; background: var(--sidebar-bg); color: #fff; position: fixed; left: 0; top: 0; z-index: 1000; display: flex; flex-direction: column; transition: transform 0.3s; }
      .sidebar-header { padding: 1.5rem; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.05); }
      .sidebar-nav { flex: 1; padding: 1.5rem 0; overflow-y: auto; }
      .nav-link { display: flex; align-items: center; gap: 1rem; padding: 0.8rem 1.5rem; color: var(--text-muted); transition: all 0.2s; font-size: 0.95rem; }
      .nav-link:hover { background: var(--sidebar-hover); color: #fff; }
      .nav-link.active { background: var(--sidebar-active); color: #fff; border-left: 4px solid #fff; }
      .nav-link i { width: 20px; height: 20px; }
      .sidebar-footer { padding: 1.5rem; border-top: 1px solid rgba(255,255,255,0.05); }
      .logout-btn { background: none; border: none; color: var(--text-muted); display: flex; align-items: center; gap: 1rem; cursor: pointer; width: 100%; font-family: inherit; font-size: 0.95rem; }
      .logout-btn:hover { color: #f87171; }
      
      /* Topbar */
      .admin-topbar { height: var(--topbar-height); background: #fff; border-bottom: 1px solid #e2e8f0; position: fixed; right: 0; top: 0; left: var(--sidebar-width); z-index: 900; display: flex; justify-content: space-between; align-items: center; padding: 0 2rem; transition: left 0.3s; }
      .topbar-left { display: flex; align-items: center; gap: 1rem; }
      .topbar-left h2 { font-size: 1.25rem; font-weight: 700; color: #1e293b; }
      .mobile-toggle { display: none; background: none; border: none; cursor: pointer; color: #64748b; }
      
      .admin-profile { display: flex; align-items: center; gap: 1rem; }
      .profile-info { text-align: right; }
      .admin-name { display: block; font-weight: 600; font-size: 0.9rem; color: #1e293b; }
      .admin-role { display: block; font-size: 0.75rem; color: var(--text-muted); font-weight: 700; }
      .admin-avatar { width: 40px; height: 40px; border-radius: 50%; border: 2px solid #e2e8f0; }

      @media (max-width: 1024px) {
        .admin-sidebar { transform: translateX(-100%); }
        .admin-sidebar.open { transform: translateX(0); }
        .admin-main-content { margin-left: 0; }
        .admin-topbar { left: 0; }
        .mobile-toggle { display: block; }
      }
    `;
    document.head.appendChild(style);

    // 4. Wrap body content
    const wrapper = document.createElement('div');
    wrapper.className = 'admin-layout-wrapper';
    wrapper.id = 'admin-layout-injected';
    
    const main = document.createElement('main');
    main.className = 'admin-main-content';
    
    // Move existing body children to main
    while (document.body.firstChild) {
      main.appendChild(document.body.firstChild);
    }
    
    wrapper.innerHTML = sidebarHtml + topbarHtml;
    wrapper.appendChild(main);
    document.body.appendChild(wrapper);

    // 5. Event Listeners
    document.getElementById('sidebarOpen')?.addEventListener('click', () => {
      document.getElementById('adminSidebar').classList.add('open');
    });
    document.getElementById('sidebarClose')?.addEventListener('click', () => {
      document.getElementById('adminSidebar').classList.remove('open');
    });
    document.getElementById('adminLogout')?.addEventListener('click', async () => {
      try {
        await fetch('/api/auth/logout', { method: 'POST' });
      } catch (_) {}
      localStorage.clear();
      window.location.replace('/admin/login.html');
    });

    if (window.lucide) lucide.createIcons();
  }

  function getPageTitle(path) {
    const link = sidebarLinks.find(l => l.path === path);
    return link ? link.name : 'Admin Panel';
  }

  // Initialize on DOM load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectLayout);
  } else {
    injectLayout();
  }

  // Exposed helpers
  window.AdminLayout = {
    setPageTitle: (title) => {
      const el = document.getElementById('pageTitle');
      if (el) el.textContent = title;
    }
  };
})();
