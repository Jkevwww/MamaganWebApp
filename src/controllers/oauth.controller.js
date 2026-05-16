const passport = require('passport');

const { getCookieOptions, getTokenCookieName } = require('../utils/authCookie');
const { isAdminUser } = require('../utils/roles');
const {
  oauthFailureRedirect,
  oauthSuccessGuestRedirect,
  oauthSuccessAdminRedirect,
} = require('../utils/safeRedirect');
const { googleCallbackUrl, githubCallbackUrl } = require('../utils/oauthConfig');
const { logSystemAction } = require('../utils/logger');

function metaFromReq(req) {
  return {
    ipAddress: req.ip || req.connection?.remoteAddress || null,
    userAgent: req.headers['user-agent'] || null,
  };
}

function hasPassportStrategy(name) {
  if (typeof passport._strategy === 'function' && passport._strategy(name)) {
    return true;
  }
  return Boolean(passport._strategies && passport._strategies[name]);
}

function isGoogleOAuthConfigured() {
  return Boolean(
      process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      googleCallbackUrl() &&
      hasPassportStrategy('google')
  );
}

function isGithubOAuthConfigured() {
  return Boolean(
    process.env.GITHUB_CLIENT_ID &&
      process.env.GITHUB_CLIENT_SECRET &&
      githubCallbackUrl() &&
      hasPassportStrategy('github')
  );
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

  const isAdmin = isAdminUser(authPayload.user);
  const dest = isAdmin
    ? oauthSuccessAdminRedirect()
    : oauthSuccessGuestRedirect();

  await logSystemAction({
    userId: authPayload.user?.id,
    action: isAdmin ? 'LOGIN_REDIRECT_ADMIN' : 'LOGIN_REDIRECT_GUEST',
    module: 'AUTH',
    targetType: 'redirect',
    targetId: dest,
    details: {
      provider,
      role: authPayload.user?.role,
      access_tier: authPayload.user?.access_tier,
    },
    ipAddress,
    userAgent,
  });

  return res.redirect(dest);
}

async function finishOAuthFailure(req, res, provider, err) {
  const { ipAddress, userAgent } = metaFromReq(req);
  const failAction = provider === 'GOOGLE' ? 'GOOGLE_LOGIN_FAILED' : 'GITHUB_LOGIN_FAILED';
  const errorCode = err?.oauthError || (err?.statusCode === 403 ? 'account_disabled' : 'oauth_failed');
  await logSystemAction({
    userId: null,
    action: failAction,
    module: 'AUTH',
    targetType: 'oauth',
    targetId: provider,
    details: { message: err?.message || String(err || 'failed'), error: errorCode },
    ipAddress,
    userAgent,
  });
  return res.redirect(oauthFailureRedirect(errorCode));
}

function googleCallback(req, res, next) {
  if (!isGoogleOAuthConfigured()) {
    return res.redirect(oauthFailureRedirect());
  }
  passport.authenticate('google', { session: true }, (err, authPayload) => {
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
  if (!isGithubOAuthConfigured()) {
    return res.redirect(oauthFailureRedirect());
  }
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
  if (!isGoogleOAuthConfigured()) {
    return res.redirect(oauthFailureRedirect());
  }
  return passport.authenticate('google', {
    scope: ['email', 'profile'],
    session: true,
  })(req, res, next);
}

function githubStart(req, res, next) {
  if (!isGithubOAuthConfigured()) {
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
