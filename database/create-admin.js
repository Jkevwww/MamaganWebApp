require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const { getConnectionOptions } = require('./db-config');

function readAdminEnv() {
  return {
    name: (process.env.ADMIN_NAME || 'System Administrator').trim(),
    email: (process.env.ADMIN_EMAIL || '').trim().toLowerCase(),
    password: process.env.ADMIN_PASSWORD || '',
    phone: (process.env.ADMIN_PHONE || '').trim(),
  };
}

function validateAdminEnv({ email, password }) {
  if (!email || !email.includes('@')) {
    throw new Error('ADMIN_EMAIL must be a valid email address.');
  }
  if (!password || password.length < 8) {
    throw new Error('ADMIN_PASSWORD must be at least 8 characters.');
  }
}

async function logAdminBootstrap(conn, { userId, action }) {
  try {
    await conn.query(
      `INSERT INTO system_logs (user_id, action, module, target_type, target_id, details, ip_address, user_agent)
       VALUES (?, ?, 'AUTH', 'users', ?, ?, NULL, NULL)`,
      [userId, action, String(userId), JSON.stringify({ source: 'create-admin' })]
    );
  } catch (_) {
    // The logging table may not exist before migrations have been run.
  }
}

async function createOrUpdateAdminAccount(conn, options = {}) {
  const admin = readAdminEnv();
  if (options.skipWhenMissing && (!admin.email || !admin.password)) {
    console.log('  Admin bootstrap skipped: ADMIN_EMAIL and ADMIN_PASSWORD are not both set.');
    return { skipped: true };
  }

  validateAdminEnv(admin);

  const passwordHash = await bcrypt.hash(admin.password, 10);
  const [existing] = await conn.query(
    'SELECT id, role, access_tier FROM users WHERE email = ? LIMIT 1',
    [admin.email]
  );

  if (existing.length > 0) {
    const userId = existing[0].id;
    await conn.query(
      `UPDATE users
       SET name = ?, phone = ?, password_hash = ?, password = NULL,
           role = 'ADMIN', access_tier = 'SUPER_ADMIN', active = 1, updated_at = NOW()
       WHERE id = ?`,
      [admin.name, admin.phone, passwordHash, userId]
    );
    await logAdminBootstrap(conn, { userId, action: 'ADMIN_ACCOUNT_UPDATED' });
    console.log(`  Admin account updated: ${admin.email}`);
    return { created: false, updated: true, userId };
  }

  const [result] = await conn.query(
    `INSERT INTO users (name, email, phone, password_hash, password, role, access_tier, active)
     VALUES (?, ?, ?, ?, NULL, 'ADMIN', 'SUPER_ADMIN', 1)`,
    [admin.name, admin.email, admin.phone, passwordHash]
  );
  await logAdminBootstrap(conn, { userId: result.insertId, action: 'ADMIN_ACCOUNT_CREATED' });
  console.log(`  Admin account created: ${admin.email}`);
  return { created: true, updated: false, userId: result.insertId };
}

async function main() {
  const conn = await mysql.createConnection(getConnectionOptions());
  try {
    await createOrUpdateAdminAccount(conn);
  } finally {
    await conn.end();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(`Admin account error: ${err.message}`);
    process.exit(1);
  });
}

module.exports = { createOrUpdateAdminAccount };
