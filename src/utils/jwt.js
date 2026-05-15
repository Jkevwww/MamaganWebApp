const jwt = require('jsonwebtoken');

let warnedAboutDevSecret = false;

function getJwtSecret() {
  if (process.env.JWT_SECRET) {
    return process.env.JWT_SECRET;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is required in production');
  }

  if (!warnedAboutDevSecret) {
    console.warn('JWT_SECRET is missing. Using a development-only fallback secret.');
    warnedAboutDevSecret = true;
  }

  return 'mamagan-development-jwt-secret-change-me';
}

function signToken(payload) {
  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

function verifyToken(token) {
  return jwt.verify(token, getJwtSecret());
}

module.exports = { signToken, verifyToken };
