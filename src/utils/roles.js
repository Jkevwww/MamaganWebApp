const ADMIN_ROLES = new Set(['admin', 'ADMIN', 'STAFF', 'SUPER_ADMIN']);

function isAdminRole(role) {
  return ADMIN_ROLES.has(role);
}

module.exports = { ADMIN_ROLES, isAdminRole };
