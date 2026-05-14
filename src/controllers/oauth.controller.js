const passport = require('passport');

const { getCookieOptions, getTokenCookieName } = require('../utils/authCookie');
const { isAdminRole } = require('../utils/roles');
const {
  oauthFailureRedirect,
  oauthSuccessGuestRedirect,
  oauthSuccessAdminRedirect,
} = require('../utils/safeRedirect');
const { logSystemAction } = require('../utils/logger');

function metaFromReq(req) {
  return {
    ipAddress: req.ip || req.connection?.remoteAddress || null,
    userAgent: req.headers['user-agent'] || null,
  };
}

async function finishOAuthSuccess(req, res, provider, authPayload) {
  const { ipAddress, userAgent } = metaFromReq(req);
  const successAction = provider === 'GOOGLE' ? 'GOOGLE_LOGIN_SUCCESS' : 'GITHUB_LOGIN_SUCCESS';

  res.cookie(getTokenCookieName(), authPayload.token, { ...getCookieOptions() });

  await logSystemAction({
    userId: authPayload.user?.id,
    action: successAction,
    module: 'AUTH',
    targetType: 'users',
    targetId: authPayload.user?.id != null ? String(authPayload.user.id) : null,
    details: { provider },
    ipAddress,
    userAgent,
  });

  const dest = isAdminRole(authPayload.user?.role)
    ? oauthSuccessAdminRedirect()
    : oauthSuccessGuestRedirect();
  return res.redirect(dest);
}

async function finishOAuthFailure(req, res, provider, err) {
  const { ipAddress, userAgent } = metaFromReq(req);
  const failAction = provider === 'GOOGLE' ? 'GOOGLE_LOGIN_FAILED' : 'GITHUB_LOGIN_FAILED';
  await logSystemAction({
    userId: null,
    action: failAction,
    module: 'AUTH',
    targetType: 'oauth',
    targetId: provider,
    details: { message: err?.message || String(err || 'failed') },
    ipAddress,
    userAgent,
  });
  return res.redirect(oauthFailureRedirect());
}

function googleCallback(req, res, next) {
  passport.authenticate('google-oauth20', { session: true }, (err, authPayload) => {
    void (async () => {
      try {
        if (err || !authPayload?.token) {
          await finishOAuthFailure(req, res, 'GOOGLE', err);
          return;
        }
        await finishOAuthSuccess(req, res, 'GOOGLE', authPayload);
      } catch (e) {
        next(e);
      }
    })();
  })(req, res, next);
}

function githubCallback(req, res, next) {
  passport.authenticate('github', { session: true }, (err, authPayload) => {
    void (async () => {
      try {
        if (err || !authPayload?.token) {
          await finishOAuthFailure(req, res, 'GITHUB', err);
          return;
        }
        await finishOAuthSuccess(req, res, 'GITHUB', authPayload);
      } catch (e) {
        next(e);
      }
    })();
  })(req, res, next);
}

function googleStart(req, res, next) {
  if (!process.env.GOOGLE_CLIENT_ID) {
    return res.redirect(oauthFailureRedirect());
  }
  return passport.authenticate('google-oauth20', {
    scope: ['email', 'profile'],
    session: true,
  })(req, res, next);
}

function githubStart(req, res, next) {
  if (!process.env.GITHUB_CLIENT_ID) {
    return res.redirect(oauthFailureRedirect());
  }
  return passport.authenticate('github', {
    scope: ['user:email'],
    session: true,
  })(req, res, next);
}

module.exports = {
  googleCallback,
  githubCallback,
  googleStart,
  githubStart,
};
