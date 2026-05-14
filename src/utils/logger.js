const { pool } = require('../config/db');

function stringifyDetails(details) {
  if (details == null) return null;
  if (typeof details === 'string') return details;
  try {
    return JSON.stringify(details);
  } catch {
    return String(details);
  }
}

/**
 * Insert a system log row. Uses extended columns when present (post-migration 014).
 */
async function logSystemAction({
  userId,
  action,
  module = 'AUTH',
  targetType,
  targetId,
  details,
  ipAddress,
  userAgent,
}) {
  const detailsStr = stringifyDetails(details);
  const targetIdStr = targetId == null ? null : String(targetId);

  try {
    await pool.query(
      `INSERT INTO system_logs (user_id, action, module, target_type, target_id, details, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId ?? null,
        action,
        module,
        targetType ?? null,
        targetIdStr,
        detailsStr,
        ipAddress || null,
        userAgent || null,
      ]
    );
  } catch (err) {
    try {
      await pool.query(
        `INSERT INTO system_logs (user_id, action, entity_type, entity_id, details, ip_address)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          userId ?? null,
          action,
          targetType ?? null,
          targetIdStr && /^\d+$/.test(targetIdStr) ? parseInt(targetIdStr, 10) : null,
          detailsStr,
          ipAddress || null,
        ]
      );
    } catch (err2) {
      console.error('Logging failed:', err2.message);
    }
  }
}

/** @deprecated prefer logSystemAction */
async function logAction({ userId, action, entityType, entityId, details, ipAddress }) {
  return logSystemAction({
    userId,
    action,
    module: 'LEGACY',
    targetType: entityType,
    targetId: entityId == null ? null : String(entityId),
    details,
    ipAddress,
    userAgent: null,
  });
}

module.exports = { logSystemAction, logAction };
