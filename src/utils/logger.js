const { pool } = require('../config/db');

/**
 * Log a system event
 */
async function logAction({ userId, action, entityType, entityId, details, ipAddress }) {
  try {
    await pool.query(
      `INSERT INTO system_logs (user_id, action, entity_type, entity_id, details, ip_address) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, action, entityType, entityId, JSON.stringify(details), ipAddress || null]
    );
  } catch (err) {
    console.error('Logging failed:', err.message);
  }
}

module.exports = { logAction };
