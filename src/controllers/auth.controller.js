const authService = require('../services/auth.service');
const { getCookieOptions, getTokenCookieName, getClearCookieOptions } = require('../utils/authCookie');
const { logSystemAction } = require('../utils/logger');
const { isAdminUser } = require('../utils/roles');

function reqMeta(req) {
  return {
    ipAddress: req.ip || req.connection?.remoteAddress || null,
    userAgent: req.headers['user-agent'] || null,
  };
}

function validateRegisterBody({ name, email, phone, password }) {
  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    return 'Invalid name';
  }
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return 'Invalid email';
  }
  if (!phone || typeof phone !== 'string' || phone.trim().length < 7) {
    return 'Invalid phone';
  }
  if (!password || typeof password !== 'string' || password.length < 8) {
    return 'Password must be at least 8 characters';
  }
  return null;
}

async function register(req, res, next) {
  try {
    const { name, email, phone, password } = req.body;
    const errMsg = validateRegisterBody({ name, email, phone, password });
    if (errMsg) return res.status(400).json({ message: errMsg });

    const { token, user } = await authService.register({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      password,
    });

    res.cookie(getTokenCookieName(), token, { ...getCookieOptions() });
    return res.status(201).json({ user });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  const { ipAddress, userAgent } = reqMeta(req);
  const rawEmail = req.body?.email;
  const emailNorm = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';

  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const { token, user } = await authService.login({
      email: emailNorm,
      password,
    });

    await logSystemAction({
      userId: user.id,
      action: 'LOCAL_LOGIN_SUCCESS',
      module: 'AUTH',
      targetType: 'users',
      targetId: String(user.id),
      details: { method: 'password' },
      ipAddress,
      userAgent,
    });

    const redirectTo = isAdminUser(user) ? '/admin/dashboard.html' : '/facilities.html';
    await logSystemAction({
      userId: user.id,
      action: isAdminUser(user) ? 'LOGIN_REDIRECT_ADMIN' : 'LOGIN_REDIRECT_GUEST',
      module: 'AUTH',
      targetType: 'redirect',
      targetId: redirectTo,
      details: { method: 'password', role: user.role, access_tier: user.access_tier },
      ipAddress,
      userAgent,
    });

    res.cookie(getTokenCookieName(), token, { ...getCookieOptions() });
    return res.status(200).json({ user, redirect_to: redirectTo });
  } catch (err) {
    await logSystemAction({
      userId: null,
      action: 'LOCAL_LOGIN_FAILED',
      module: 'AUTH',
      targetType: 'users',
      targetId: null,
      details: { email: emailNorm || null, message: err.message },
      ipAddress,
      userAgent,
    });
    next(err);
  }
}

async function logout(req, res, next) {
  try {
    const { ipAddress, userAgent } = reqMeta(req);
    const userId = req.user?.id ?? null;

    await logSystemAction({
      userId,
      action: 'LOGOUT',
      module: 'AUTH',
      targetType: 'users',
      targetId: userId != null ? String(userId) : null,
      details: { method: 'cookie' },
      ipAddress,
      userAgent,
    });

    res.clearCookie(getTokenCookieName(), getClearCookieOptions());

    if (typeof req.logout === 'function') {
      await new Promise((resolve) => {
        req.logout(() => resolve());
      });
    }

    return res.status(200).json({ message: 'Logged out' });
  } catch (err) {
    next(err);
  }
}

async function getMe(req, res, next) {
  try {
    const user = await authService.getMe(req.user.id);
    return res.status(200).json(user);
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login, logout, getMe };
