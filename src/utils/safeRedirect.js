/**
 * Prevent open redirects: only allow same-site relative paths.
 */
function safeAppPath(value, fallback) {
  if (typeof value !== 'string') return fallback;
  const t = value.trim();
  if (t.startsWith('/') && !t.startsWith('//')) return t;
  return fallback;
}

function oauthFailureRedirect() {
  return safeAppPath(
    process.env.OAUTH_FAILURE_REDIRECT,
    '/login.html?error=oauth_failed'
  );
}

function oauthSuccessGuestRedirect() {
  return safeAppPath(process.env.OAUTH_SUCCESS_GUEST_REDIRECT, '/facilities.html');
}

function oauthSuccessAdminRedirect() {
  return safeAppPath(process.env.OAUTH_SUCCESS_ADMIN_REDIRECT, '/admin/dashboard.html');
}

module.exports = {
  safeAppPath,
  oauthFailureRedirect,
  oauthSuccessGuestRedirect,
  oauthSuccessAdminRedirect,
};
