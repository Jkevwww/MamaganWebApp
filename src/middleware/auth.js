const { verifyToken } = require('../utils/jwt');
const { getTokenCookieName } = require('../utils/authCookie');

function optionalAuth(req, res, next) {
  const token = req.cookies?.[getTokenCookieName()];
  if (!token) return next();

  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    return next();
  } catch (err) {
    // invalid cookie -> treat as not logged in
    return next();
  }
}

function requireAuth(req, res, next) {
  const token = req.cookies?.[getTokenCookieName()];
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
  const token = req.cookies?.[getTokenCookieName()];
  if (!token) {
    return res.status(401).json({ message: 'Unauthorized: Not logged in' });
  }

  try {
    const decoded = verifyToken(token);
    if (!['admin', 'ADMIN', 'STAFF', 'SUPER_ADMIN'].includes(decoded.role)) {
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



