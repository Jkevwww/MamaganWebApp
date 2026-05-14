const express = require('express');
const passport = require('passport');

const { getCookieOptions, getTokenCookieName } = require('../utils/authCookie');

function safeRedirectUrl(envVar) {
  // Avoid open redirects: only allow redirects to known relative app paths.
  const candidate = process.env[envVar];
  if (!candidate) return null;
  if (candidate.startsWith('/') && !candidate.startsWith('//')) return candidate;
  return null;
}

const router = express.Router();

// GET /api/auth/google
router.get('/', (req, res, next) => {
  passport.authenticate('google-oauth20', {
    scope: ['email', 'profile'],
    session: true, // OAuth state uses Passport session middleware
  })(req, res, next);
});

// GET /api/auth/google/callback
router.get(
  '/callback',
  passport.authenticate('google-oauth20', {
    session: true,
    failureRedirect: '/login.html?error=oauth_failed',
  }),
  (req, res) => {
    const authData = req.user;
    const token = authData?.token;

    if (!token) return res.redirect('/login.html?error=oauth_failed');

    res.cookie(getTokenCookieName(), token, { ...getCookieOptions() });

    const role = authData?.user?.role;
    const isAdminArea = ['admin', 'ADMIN', 'STAFF', 'SUPER_ADMIN'].includes(role);

    const redirectUrl = safeRedirectUrl(
      isAdminArea ? 'OAUTH_SUCCESS_ADMIN_REDIRECT' : 'OAUTH_SUCCESS_GUEST_REDIRECT'
    );

    return res.redirect(redirectUrl || '/login.html?error=oauth_failed');
  }
);

module.exports = router;

