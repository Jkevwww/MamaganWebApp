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

const ADMIN_TIERS = new Set(['SUPER_ADMIN', 'ADMIN', 'STAFF', 'VIEWER']);

function normalizeRole(value) {
  return String(value || '').trim().toUpperCase();
}

function isAdminRole(role) {
  return ADMIN_TIERS.has(normalizeRole(role));
}

function isAdminUser(user) {
  return Boolean(user && (isAdminRole(user.role) || isAdminRole(user.access_tier)));
}

function isSafeInternalPath(value) {
  if (!value || typeof value !== 'string') return false;
  if (!value.startsWith('/') || value.startsWith('//')) return false;
  try {
    const parsed = new URL(value, window.location.origin);
    return parsed.origin === window.location.origin;
  } catch (_) {
    return false;
  }
}

function getSafeNextPath() {
  const params = new URLSearchParams(window.location.search);
  const next = params.get('next');
  return isSafeInternalPath(next) ? next : null;
}

function canUseNextPath(user, next) {
  if (!next) return false;
  if (next.startsWith('/admin/')) return isAdminUser(user);
  return true;
}

function defaultRedirectForUser(user) {
  return isAdminUser(user) ? '/admin/dashboard.html' : '/facilities.html';
}

function redirectForUser(user) {
  const next = getSafeNextPath();
  if (canUseNextPath(user, next)) return next;
  return defaultRedirectForUser(user);
}

function rememberUser(user) {
  try {
    localStorage.setItem('user', JSON.stringify(user || {}));
  } catch (_) {
    // ignore storage failures
  }
}

function showLoginQueryMessage(alertId) {
  const params = new URLSearchParams(window.location.search);
  const error = params.get('error');
  if (error === 'oauth_failed') {
    showAlert(
      alertId,
      'Sign-in with Google or GitHub did not complete. Please try again or use email and password.',
      'error'
    );
  } else if (error === 'email_required') {
    showAlert(alertId, 'Your OAuth account must have a verified primary email address.', 'error');
  } else if (error === 'account_disabled') {
    showAlert(alertId, 'This account is disabled. Please contact an administrator.', 'error');
  } else if (error === 'unauthorized') {
    showAlert(alertId, 'Please sign in before continuing.', 'error');
  } else if (error === 'inactive') {
    showAlert(alertId, 'This account is inactive. Please contact an administrator.', 'error');
  } else if (error === 'admin_permission') {
    showAlert(alertId, 'You do not have permission to access the admin panel.', 'error');
  }
}

function initPasswordToggles() {
  document.querySelectorAll('.password-toggle').forEach((button) => {
    if (button.dataset.toggleBound === 'true') return;
    button.dataset.toggleBound = 'true';

    button.addEventListener('click', () => {
      const inputId = button.dataset.target;
      const input = inputId ? document.getElementById(inputId) : null;
      if (!input) return;

      const shouldShow = input.type === 'password';
      input.type = shouldShow ? 'text' : 'password';
      button.setAttribute('aria-label', shouldShow ? 'Hide password' : 'Show password');

      const iconName = shouldShow ? 'eye-off' : 'eye';
      if (button.querySelector('[data-lucide]')) {
        button.innerHTML = `<i data-lucide="${iconName}"></i>`;
        if (window.lucide && typeof window.lucide.createIcons === 'function') {
          window.lucide.createIcons();
        }
      }
    });
  });
}

async function redirectIfAlreadyLoggedIn(alertId) {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
    if (!res.ok) return;
    const user = await res.json();
    rememberUser(user);
    window.location.replace(redirectForUser(user));
  } catch (_) {
    // ignore
  }
}

function initLoginForm(formId, alertId, btnId) {
  const btn = document.getElementById(btnId);
  if (btn) btn.dataset.originalText = btn.textContent;

  showLoginQueryMessage(alertId);
  redirectIfAlreadyLoggedIn(alertId);

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

      rememberUser(data.user);
      window.location.replace(redirectForUser(data.user));
    } catch (err) {
      showAlert(alertId, err.message);
    } finally {
      setLoading(btnId, false);
    }
  });
}

function initRegisterForm(formId, alertId, btnId) {
  const btn = document.getElementById(btnId);
  if (btn) btn.dataset.originalText = btn.textContent;

  redirectIfAlreadyLoggedIn(alertId);

  const formEl = document.getElementById(formId);
  if (!formEl) return;

  formEl.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert(alertId);
    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const password = document.getElementById('password').value;
    const confirmPasswordEl = document.getElementById('confirmPassword');
    const confirmPassword = confirmPasswordEl ? confirmPasswordEl.value : password;

    if (!name || !email || !phone || !password || !confirmPassword) {
      showAlert(alertId, 'Please fill in all fields.');
      return;
    }

    if (password.length < 8) {
      showAlert(alertId, 'Password must be at least 8 characters.');
      return;
    }

    if (password !== confirmPassword) {
      showAlert(alertId, 'Password and confirm password do not match.');
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

      rememberUser(data.user);
      window.location.replace('/facilities.html');
    } catch (err) {
      showAlert(alertId, err.message);
    } finally {
      setLoading(btnId, false);
    }
  });
}

function initAdminLoginForm() {
  window.location.replace('/login.html?next=/admin/dashboard.html');
}

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

function requireAuth(redirectTo = '/login.html') {
  window.location.replace(redirectTo);
  return null;
}

function requireAdmin(redirectTo = '/login.html?next=/admin/dashboard.html') {
  window.location.replace(redirectTo);
  return null;
}
