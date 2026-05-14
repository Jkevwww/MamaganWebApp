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

/* ─── User login ────────────────────────────────────────────────────────────── */
function initLoginForm(formId, alertId, btnId) {
  const btn = document.getElementById(btnId);
  if (btn) btn.dataset.originalText = btn.textContent;

  // Redirect if already logged in (cookie-based)
  (async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        const role = data?.role;
        if (role === 'GUEST') window.location.replace('/facilities.html');
        else window.location.replace('/admin/dashboard.html');
        return;
      }
    } catch (_) {
      // ignore
    }
  })();



  document.getElementById(formId).addEventListener('submit', async (e) => {
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
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Login failed');

      const role = data?.user?.role;
      if (role === 'GUEST') window.location.replace('/facilities.html');
      else window.location.replace('/admin/dashboard.html');

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

  // If already logged in, attempt to redirect based on /me.
  (async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        const role = data?.role;
        if (role === 'GUEST') window.location.replace('/facilities.html');
        else window.location.replace('/admin/dashboard.html');
        return;
      }
    } catch (_) {
      // ignore
    }
  })();





  document.getElementById(formId).addEventListener('submit', async (e) => {
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
        body: JSON.stringify({ name, email, phone, password }),

      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Registration failed');

      const role = data?.user?.role;
      if (role === 'GUEST') window.location.replace('/facilities.html');
      else window.location.replace('/admin/dashboard.html');

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

  // If already logged in as admin, redirect to dashboard
  // If already logged in, redirect based on /me.
  try {
    const res = await fetch('/api/auth/me');
    if (res.ok) {
      const data = await res.json();
      const role = data?.role;
      if (role && role !== 'GUEST') window.location.replace('/admin/dashboard.html');
      return;
    }
  } catch (_) {
    // ignore
  }


  document.getElementById(formId).addEventListener('submit', async (e) => {
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
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Login failed');
      if (data.user.role !== 'admin') throw new Error('Access denied: not an admin account');

      const role = data?.user?.role;
      if (role !== 'ADMIN' && role !== 'admin') {
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
    await fetch('/api/auth/logout', { method: 'POST' });
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
  if (!token || user.role !== 'admin') {
    window.location.replace(redirectTo);
    return null;
  }
  return token;
}
