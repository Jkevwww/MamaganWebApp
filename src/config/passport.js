const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

const { pool } = require('../config/db');
const { signToken } = require('../utils/jwt');

// Local util to ensure we don't create admin accounts via OAuth.
const ADMIN_ROLES = new Set(['admin', 'ADMIN', 'STAFF', 'SUPER_ADMIN']);


function normalizeEmail(email) {
  return (email || '').trim().toLowerCase();
}

async function linkOrCreateUserFromGoogle({ profile }) {
  // Enforce verified email.
  // Passport-google-oauth20 includes profile.emails when scope includes `email`.
  const emails = profile.emails || [];
  const verifiedEmail = emails.find((e) => e && e.verified && e.value);
  if (!verifiedEmail) {
    const err = new Error('Google account email is not verified');
    err.statusCode = 400;
    throw err;
  }

  const email = normalizeEmail(verifiedEmail.value);
  if (!email) {
    const err = new Error('Google account email missing');
    err.statusCode = 400;
    throw err;
  }

  const provider = 'GOOGLE';
  const providerUserId = profile.id;

  const providerUserIdStr = String(providerUserId || '').trim();
  if (!providerUserIdStr) {
    const err = new Error('Google provider user id missing');
    err.statusCode = 400;
    throw err;
  }

  const displayName = profile.displayName || profile.name?.givenName || email.split('@')[0];

  // 1) Try to find existing user by email
  const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);

  if (users.length > 0) {
    const user = users[0];
    const active = user.active ?? 1;
    if (!active) {
      const err = new Error('Account is inactive');
      err.statusCode = 403;
      throw err;
    }

    // 2) Link Google provider account (upsert oauth_accounts)
    await pool.query(
      `INSERT INTO oauth_accounts (user_id, provider, provider_user_id, email, created_at, updated_at)
       VALUES (?, ?, ?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE
         user_id = VALUES(user_id),
         email = VALUES(email),
         updated_at = NOW()`,
      [user.id, provider, providerUserIdStr, email]
    );

    // Preserve existing role/access_tier.
    const token = signToken({ id: user.id, role: user.role });
    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        access_tier: user.access_tier,
        avatar_url: user.avatar_url,
        active: user.active,
        last_login_at: user.last_login_at,
        created_at: user.created_at,
        updated_at: user.updated_at,
      },
    };
  }

  // 3) Create new user as GUEST
  const role = 'GUEST';
  const accessTier = 'GUEST';
  const active = 1;

  const [result] = await pool.query(
    `INSERT INTO users (name, email, phone, password_hash, password, role, access_tier, active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      displayName,
      email,
      '', // phone is optional/unknown
      null, // password_hash
      null, // legacy password
      role,
      accessTier,
      active,
    ]
  );

  const userId = result.insertId;

  // Insert oauth_accounts link
  await pool.query(
    `INSERT INTO oauth_accounts (user_id, provider, provider_user_id, email, created_at, updated_at)
     VALUES (?, ?, ?, ?, NOW(), NOW())`,
    [userId, provider, providerUserIdStr, email]
  );

  const token = signToken({ id: userId, role });
  return {
    token,
    user: {
      id: userId,
      name: displayName,
      email,
      phone: '',
      role,
      access_tier: accessTier,
      avatar_url: null,
      active: true,
      last_login_at: null,
      created_at: null,
      updated_at: null,
    },
  };
}

function setUpPassport() {
  // We don't use Passport's persistent sessions for app auth.
  // However, Passport OAuth requires session support for state.
  // We keep passport.serializeUser/deserializeUser minimal.
  passport.serializeUser((user, done) => done(null, user));
  passport.deserializeUser((obj, done) => done(null, obj));

  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          // Never store access/refresh tokens.
          const { token, user } = await linkOrCreateUserFromGoogle({ profile });
          // Attach token/user to req via `done`.
          return done(null, { token, user });
        } catch (err) {
          return done(err);
        }
      }
    )
  );
}

module.exports = { setUpPassport, linkOrCreateUserFromGoogle, ADMIN_ROLES };

