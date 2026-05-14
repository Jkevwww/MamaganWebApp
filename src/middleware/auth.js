const { verifyToken } = require('../utils/jwt');
const { getTokenCookieName } = require('../utils/authCookie');

function getToken(req) {
  // 1. Check Cookie
  const cookieName = getTokenCookieName();
  if (req.cookies && req.cookies[cookieName]) {
    return req.cookies[cookieName];
  }
  // 2. Check Authorization Header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.split(' ')[1];
  }
  return null;
}

function optionalAuth(req, res, next) {
  const token = getToken(req);
  if (!token) return next();

  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    return next();
  } catch (err) {
    return next();
  }
}

function requireAuth(req, res, next) {
  const token = getToken(req);
  if (!token) {
    return res.status(401).json({ message: 'Unauthorized: Not logged in' });
  }

  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    return next();
  } catch (err) {
    return res.status(401).json({ message: 'Unauthorized: Invalid or expired token' });
  }
}

function requireAdmin(req, res, next) {
  const token = getToken(req);
  if (!token) {
    return res.status(401).json({ message: 'Unauthorized: Not logged in' });
  }

  try {
    const decoded = verifyToken(token);
    const adminRoles = ['admin', 'ADMIN', 'STAFF', 'SUPER_ADMIN'];
    if (!adminRoles.includes(decoded.role)) {
      return res.status(403).json({ message: 'Forbidden: Admin access required' });
    }
    req.user = decoded;
    return next();
  } catch (err) {
    return res.status(401).json({ message: 'Unauthorized: Invalid or expired token' });
  }
}

// Backward-compat default export
module.exports = requireAuth;
module.exports.requireAuth = requireAuth;
module.exports.optionalAuth = optionalAuth;
module.exports.requireAdmin = requireAdmin;



