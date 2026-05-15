const jwt = require('jsonwebtoken');

function getJwtSecret() {
  if (process.env.JWT_SECRET) {
    return process.env.JWT_SECRET;
  }
  throw new Error('JWT_SECRET is required. Set JWT_SECRET in .env or Render Environment Variables.');
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
