const ADMIN_ROLES = new Set(['SUPER_ADMIN', 'ADMIN', 'STAFF', 'VIEWER']);

function normalizeRole(value) {
  return String(value || '').trim().toUpperCase();
}

function isAdminRole(role) {
  return ADMIN_ROLES.has(normalizeRole(role));
}

function isAdminUser(user) {
  if (!user) return false;
  return isAdminRole(user.role) || isAdminRole(user.access_tier);
}

module.exports = { ADMIN_ROLES, normalizeRole, isAdminRole, isAdminUser };
