const { verifyToken } = require('../utils/jwt');
const { getTokenCookieName } = require('../utils/authCookie');
const { pool } = require('../config/db');
const { isAdminUser, normalizeRole } = require('../utils/roles');
const { logSystemAction } = require('../utils/logger');

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

  void (async () => {
    try {
      const decoded = verifyToken(token);
      const user = await loadActiveUser(decoded.id);
      if (user) req.user = user;
    } catch (err) {
      // Optional auth should not fail the request.
    }
    return next();
  })();
}

function requireAuth(req, res, next) {
  const token = getToken(req);
  if (!token) {
    return res.status(401).json({ message: 'Unauthorized: Not logged in' });
  }

  void (async () => {
    try {
      const decoded = verifyToken(token);
      const user = await loadActiveUser(decoded.id);
      if (!user) {
        return res.status(401).json({ message: 'Unauthorized: Invalid or inactive account' });
      }
      req.user = user;
      return next();
    } catch (err) {
      return res.status(401).json({ message: 'Unauthorized: Invalid or expired token' });
    }
  })();
}

function requireAdmin(req, res, next) {
  void (async () => {
    if (!req.user) {
      const token = getToken(req);
      if (!token) {
        return res.status(401).json({ message: 'Unauthorized: Not logged in' });
      }
      try {
        const decoded = verifyToken(token);
        req.user = await loadActiveUser(decoded.id);
      } catch (err) {
        return res.status(401).json({ message: 'Unauthorized: Invalid or expired token' });
      }
    }

    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized: Invalid or inactive account' });
    }

    if (!isAdminUser(req.user)) {
      await logSystemAction({
        userId: req.user.id,
        action: 'UNAUTHORIZED_ADMIN_ACCESS',
        module: 'AUTH',
        targetType: 'admin_api',
        targetId: req.originalUrl,
        details: { role: req.user.role, access_tier: req.user.access_tier },
        ipAddress: req.ip || req.connection?.remoteAddress || null,
        userAgent: req.headers['user-agent'] || null,
      });
      return res.status(403).json({ message: 'Forbidden: Admin access required' });
    }

    return next();
  })();
}

function requirePermission(allowedTiers = []) {
  const allowed = new Set(allowedTiers.map(normalizeRole));
  return function permissionMiddleware(req, res, next) {
    if (!req.user) {
      return requireAdmin(req, res, () => permissionMiddleware(req, res, next));
    }
    if (!isAdminUser(req.user)) {
      return res.status(403).json({ message: 'Forbidden: Admin access required' });
    }
    if (allowed.size === 0 || allowed.has(normalizeRole(req.user.access_tier)) || allowed.has(normalizeRole(req.user.role))) {
      return next();
    }
    return res.status(403).json({ message: 'Forbidden: Insufficient permission' });
  };
}

async function loadActiveUser(userId) {
  if (!userId) return null;
  const [rows] = await pool.query(
    `SELECT id, name, email, phone, role, access_tier, avatar_url, active, last_login_at, created_at, updated_at
     FROM users
     WHERE id = ?`,
    [userId]
  );
  if (rows.length === 0) return null;
  const user = rows[0];
  if (!(user.active ?? 1)) return null;
  return user;
}

// Backward-compat default export
module.exports = requireAuth;
module.exports.requireAuth = requireAuth;
module.exports.optionalAuth = optionalAuth;
module.exports.requireAdmin = requireAdmin;
module.exports.requirePermission = requirePermission;

