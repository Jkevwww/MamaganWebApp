const authService = require('../services/auth.service');
const { getCookieOptions, getTokenCookieName } = require('../utils/authCookie');




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
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const { token, user } = await authService.login({
      email: email.trim().toLowerCase(),
      password,
    });

    res.cookie(getTokenCookieName(), token, { ...getCookieOptions() });
    return res.status(200).json({ user });
  } catch (err) {
    next(err);
  }
}

async function logout(req, res, next) {
  try {
    res.clearCookie(getTokenCookieName(), { path: '/' });
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

