const TOKEN_COOKIE_NAME = 'auth_token';

function getCookieOptions() {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd, // true in production, false in development
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // ~7 days
    path: '/',
  };
}

function getTokenCookieName() {
  return TOKEN_COOKIE_NAME;
}

function getClearCookieOptions() {
  const o = getCookieOptions();
  return {
    path: o.path,
    httpOnly: o.httpOnly,
    secure: o.secure,
    sameSite: o.sameSite,
  };
}

module.exports = { getCookieOptions, getTokenCookieName, getClearCookieOptions };

