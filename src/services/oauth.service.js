const { pool } = require('../config/db');
const { signToken } = require('../utils/jwt');
const { logSystemAction } = require('../utils/logger');

function normalizeEmail(email) {
  return (email || '').trim().toLowerCase();
}

function sanitizeUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    access_tier: row.access_tier,
    avatar_url: row.avatar_url,
    active: row.active,
    last_login_at: row.last_login_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function clientMeta(req) {
  if (!req) return { ipAddress: null, userAgent: null };
  return {
    ipAddress: req.ip || req.connection?.remoteAddress || null,
    userAgent: req.headers['user-agent'] || null,
  };
}

/**
 * OAuth login: resolve by linked provider first, then verified email, else create guest.
 * Preserves role/access_tier/phone for existing users; never elevates privileges via OAuth.
 */
async function linkOrCreateOAuthUser({
  provider,
  providerUserId,
  email,
  displayName,
  avatarUrl,
  req,
}) {
  const { ipAddress, userAgent } = clientMeta(req);
  const emailNorm = normalizeEmail(email);
  if (!emailNorm) {
    const err = new Error('OAuth account email missing');
    err.statusCode = 400;
    throw err;
  }

  const providerUserIdStr = String(providerUserId || '').trim();
  if (!providerUserIdStr) {
    const err = new Error('OAuth provider user id missing');
    err.statusCode = 400;
    throw err;
  }

  const display = (displayName || emailNorm.split('@')[0] || 'Guest').trim();

  // 1) Existing provider link
  const [oauthRows] = await pool.query(
    'SELECT user_id FROM oauth_accounts WHERE provider = ? AND provider_user_id = ?',
    [provider, providerUserIdStr]
  );

  if (oauthRows.length > 0) {
    const userId = oauthRows[0].user_id;
    const [users] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
    if (users.length === 0) {
      const err = new Error('Linked user record missing');
      err.statusCode = 500;
      throw err;
    }
    const user = users[0];
    const active = user.active ?? 1;
    if (!active) {
      const err = new Error('Account is inactive');
      err.statusCode = 403;
      err.oauthError = 'account_disabled';
      throw err;
    }

    await pool.query(
      `UPDATE oauth_accounts SET email = ?, updated_at = NOW() WHERE provider = ? AND provider_user_id = ?`,
      [emailNorm, provider, providerUserIdStr]
    );

    if (avatarUrl && !user.avatar_url) {
      await pool.query('UPDATE users SET avatar_url = ?, updated_at = NOW() WHERE id = ?', [avatarUrl, user.id]);
      user.avatar_url = avatarUrl;
    }

    await pool.query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]);

    const token = signToken({ id: user.id, role: user.role, access_tier: user.access_tier });
    return {
      token,
      user: sanitizeUser({ ...user, last_login_at: new Date() }),
      flags: { newUser: false, newProviderLink: false },
    };
  }

  // 2) Match existing user by email — link provider, preserve role/tier/phone
  const [usersByEmail] = await pool.query('SELECT * FROM users WHERE email = ?', [emailNorm]);
  if (usersByEmail.length > 0) {
    const user = usersByEmail[0];
    const active = user.active ?? 1;
    if (!active) {
      const err = new Error('Account is inactive');
      err.statusCode = 403;
      err.oauthError = 'account_disabled';
      throw err;
    }

    await pool.query(
      `INSERT INTO oauth_accounts (user_id, provider, provider_user_id, email, created_at, updated_at)
       VALUES (?, ?, ?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE email = VALUES(email), updated_at = NOW()`,
      [user.id, provider, providerUserIdStr, emailNorm]
    );

    await logSystemAction({
      userId: user.id,
      action: 'OAUTH_ACCOUNT_LINKED',
      module: 'AUTH',
      targetType: 'oauth_accounts',
      targetId: `${provider}:${providerUserIdStr}`,
      details: { provider, email: emailNorm },
      ipAddress,
      userAgent,
    });

    if (avatarUrl && !user.avatar_url) {
      await pool.query('UPDATE users SET avatar_url = ?, updated_at = NOW() WHERE id = ?', [avatarUrl, user.id]);
      user.avatar_url = avatarUrl;
    }

    await pool.query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]);

    const token = signToken({ id: user.id, role: user.role, access_tier: user.access_tier });
    return {
      token,
      user: sanitizeUser({ ...user, last_login_at: new Date() }),
      flags: { newUser: false, newProviderLink: true },
    };
  }

  // 3) New guest user
  const role = 'GUEST';
  const accessTier = 'GUEST';
  const active = 1;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [result] = await conn.query(
      `INSERT INTO users (name, email, phone, password_hash, password, role, access_tier, active, avatar_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [display, emailNorm, '', null, null, role, accessTier, active, avatarUrl || null]
    );
    const userId = result.insertId;

    await conn.query(
      `INSERT INTO oauth_accounts (user_id, provider, provider_user_id, email, created_at, updated_at)
       VALUES (?, ?, ?, ?, NOW(), NOW())`,
      [userId, provider, providerUserIdStr, emailNorm]
    );

    await conn.commit();

    await logSystemAction({
      userId,
      action: 'USER_CREATED_FROM_OAUTH',
      module: 'AUTH',
      targetType: 'users',
      targetId: String(userId),
      details: { provider, email: emailNorm },
      ipAddress,
      userAgent,
    });

    const token = signToken({ id: userId, role, access_tier: accessTier });
    return {
      token,
      user: sanitizeUser({
        id: userId,
        name: display,
        email: emailNorm,
        phone: '',
        role,
        access_tier: accessTier,
        avatar_url: avatarUrl || null,
        active: true,
        last_login_at: new Date(),
        created_at: null,
        updated_at: null,
      }),
      flags: { newUser: true, newProviderLink: true },
    };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

module.exports = { linkOrCreateOAuthUser, normalizeEmail };
