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

module.exports = { getCookieOptions, getTokenCookieName };

