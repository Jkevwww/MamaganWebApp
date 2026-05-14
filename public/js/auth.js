/* ─── Shared auth helpers ────────────────────────────────────────────────────── */

function showAlert(id, message, type = 'error') {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = message;
  el.className = `alert alert-${type} show`;
}

function hideAlert(id) {
  const el = document.getElementById(id);
  if (el) el.className = 'alert';
}

function setLoading(btnId, isLoading) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled = isLoading;
  btn.textContent = isLoading ? 'Please wait...' : btn.dataset.originalText || btn.textContent;
}

const ADMIN_ROLES = new Set(['admin', 'ADMIN', 'STAFF', 'SUPER_ADMIN']);

function isAdminRole(role) {
  return ADMIN_ROLES.has(role);
}

function showOAuthError(alertId) {
  try {
    const params = new URLSearchParams(window.location.search);
    const error = params.get('error');
    if (error === 'oauth_failed') {
      showAlert(
        alertId,
        'Sign-in with Google or GitHub did not complete. Please try again or use email and password.',
        'error'
      );
    }
  } catch (_) {
    // ignore
  }
}

/* ─── User login ────────────────────────────────────────────────────────────── */
function initLoginForm(formId, alertId, btnId) {
  const btn = document.getElementById(btnId);
  if (btn) btn.dataset.originalText = btn.textContent;

  showOAuthError(alertId);

  (async () => {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
      if (res.ok) {
        const data = await res.json();
        const role = data?.role;
        if (role === 'GUEST') window.location.replace('/facilities.html');
        else if (isAdminRole(role)) window.location.replace('/admin/dashboard.html');
        else window.location.replace('/facilities.html');
      }
    } catch (_) {
      // ignore
    }
  })();

  const formEl = document.getElementById(formId);
  if (!formEl) return;

  formEl.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert(alertId);
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    if (!email || !password) {
      showAlert(alertId, 'Please fill in all fields.');
      return;
    }

    setLoading(btnId, true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Login failed');

      const role = data?.user?.role;
      if (role === 'GUEST') window.location.replace('/facilities.html');
      else if (isAdminRole(role)) window.location.replace('/admin/dashboard.html');
      else window.location.replace('/facilities.html');
    } catch (err) {
      showAlert(alertId, err.message);
    } finally {
      setLoading(btnId, false);
    }
  });
}

/* ─── User register ─────────────────────────────────────────────────────────── */
function initRegisterForm(formId, alertId, btnId) {
  const btn = document.getElementById(btnId);
  if (btn) btn.dataset.originalText = btn.textContent;

  (async () => {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
      if (res.ok) {
        const data = await res.json();
        const role = data?.role;
        if (role === 'GUEST') window.location.replace('/facilities.html');
        else if (isAdminRole(role)) window.location.replace('/admin/dashboard.html');
        else window.location.replace('/facilities.html');
      }
    } catch (_) {
      // ignore
    }
  })();

  const formEl = document.getElementById(formId);
  if (!formEl) return;

  formEl.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert(alertId);
    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const password = document.getElementById('password').value;

    if (!name || !email || !phone || !password) {
      showAlert(alertId, 'Please fill in all fields.');
      return;
    }

    if (password.length < 8) {
      showAlert(alertId, 'Password must be at least 8 characters.');
      return;
    }

    setLoading(btnId, true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ name, email, phone, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Registration failed');

      const role = data?.user?.role;
      if (role === 'GUEST') window.location.replace('/facilities.html');
      else if (isAdminRole(role)) window.location.replace('/admin/dashboard.html');
      else window.location.replace('/facilities.html');
    } catch (err) {
      showAlert(alertId, err.message);
    } finally {
      setLoading(btnId, false);
    }
  });
}

/* ─── Admin login ───────────────────────────────────────────────────────────── */
function initAdminLoginForm(formId, alertId, btnId) {
  const btn = document.getElementById(btnId);
  if (btn) btn.dataset.originalText = btn.textContent;

  showOAuthError(alertId);

  (async () => {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
      if (res.ok) {
        const data = await res.json();
        if (isAdminRole(data?.role)) {
          window.location.replace('/admin/dashboard.html');
        }
      }
    } catch (_) {
      // ignore
    }
  })();

  const formEl = document.getElementById(formId);
  if (!formEl) return;

  formEl.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert(alertId);
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    if (!email || !password) {
      showAlert(alertId, 'Please fill in all fields.');
      return;
    }

    setLoading(btnId, true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Login failed');
      if (!isAdminRole(data.user.role)) {
        throw new Error('Access denied: not an admin account');
      }
      window.location.replace('/admin/dashboard.html');
    } catch (err) {
      showAlert(alertId, err.message);
    } finally {
      setLoading(btnId, false);
    }
  });
}

/* ─── Logout helper ─────────────────────────────────────────────────────────── */
async function logout(redirectTo = '/login.html') {
  try {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
  } catch (_) {
    // ignore
  }
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.replace(redirectTo);
}

/* ─── Auth guard helper (call at top of protected pages) ────────────────────── */
function requireAuth(redirectTo = '/login.html') {
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.replace(redirectTo);
    return null;
  }
  return token;
}

function requireAdmin(redirectTo = '/admin/login.html') {
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  if (!token || !isAdminRole(user.role)) {
    window.location.replace(redirectTo);
    return null;
  }
  return token;
}
