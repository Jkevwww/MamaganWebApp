const { pool } = require('../config/db');
const { hashPassword, comparePassword } = require('../utils/hash');
const { signToken } = require('../utils/jwt');
const { AppError } = require('../middleware/error');
const crypto = require('crypto');
const { sendVerificationCode } = require('./email.service');

const REGISTRATION_PURPOSE = 'REGISTRATION';
const CODE_TTL_MINUTES = 10;
const MAX_VERIFY_ATTEMPTS = 5;

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
    email_verified_at: row.email_verified_at,
    last_login_at: row.last_login_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function makeCode() {
  return String(crypto.randomInt(100000, 1000000));
}

function hashCode(email, code) {
  const secret = process.env.EMAIL_VERIFICATION_SECRET || process.env.JWT_SECRET || 'dev-email-verification-secret';
  return crypto
    .createHmac('sha256', secret)
    .update(`${normalizeEmail(email)}:${String(code).trim()}`)
    .digest('hex');
}

function makeAccountNotFoundError() {
  const err = new AppError('Account not found', 404);
  err.code = 'ACCOUNT_NOT_FOUND';
  return err;
}

function nameFromEmail(email) {
  const localPart = String(email || '').split('@')[0] || 'Guest';
  return localPart
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase()) || 'Guest';
}

async function createVerificationRecord({ name, email, phone, password }) {
  const emailNorm = normalizeEmail(email);
  if (!emailNorm || !emailNorm.includes('@')) {
    throw new AppError('Invalid email', 400);
  }
  if (!password || String(password).length < 8) {
    throw new AppError('Password must be at least 8 characters', 400);
  }

  const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [emailNorm]);
  if (existing.length > 0) {
    throw new AppError('Email already registered', 409);
  }

  const hashed = await hashPassword(password);
  const code = makeCode();
  const codeHash = hashCode(emailNorm, code);

  await pool.query(
    `UPDATE email_verification_codes
     SET consumed_at = NOW()
     WHERE email = ? AND purpose = ? AND consumed_at IS NULL`,
    [emailNorm, REGISTRATION_PURPOSE]
  );

  await pool.query(
    `INSERT INTO email_verification_codes
      (email, name, phone, password_hash, code_hash, purpose, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))`,
    [emailNorm, name, phone, hashed, codeHash, REGISTRATION_PURPOSE, CODE_TTL_MINUTES]
  );

  const delivery = await sendVerificationCode(emailNorm, code);

  return {
    email: emailNorm,
    expires_in_minutes: CODE_TTL_MINUTES,
    delivery,
    dev_code: process.env.NODE_ENV === 'production' ? undefined : code,
  };
}

async function startRegistration({ name, email, phone, password }) {
  if (!name || !email || !phone || !password) {
    throw new AppError('Name, email, phone, and password are required', 400);
  }

  return createVerificationRecord({
    name: String(name).trim(),
    email,
    phone: String(phone).trim(),
    password,
  });
}

async function startLoginRegistration({ email, password }) {
  const emailNorm = normalizeEmail(email);
  return createVerificationRecord({
    name: nameFromEmail(emailNorm),
    email: emailNorm,
    phone: '',
    password,
  });
}

async function verifyRegistration({ email, code }) {
  const emailNorm = normalizeEmail(email);
  const cleanCode = String(code || '').trim();
  if (!emailNorm || !cleanCode) {
    throw new AppError('Email and verification code are required', 400);
  }

  const [rows] = await pool.query(
    `SELECT evc.*, (evc.expires_at <= NOW()) AS is_expired
     FROM email_verification_codes evc
     WHERE email = ? AND purpose = ? AND consumed_at IS NULL
     ORDER BY created_at DESC, id DESC
     LIMIT 1`,
    [emailNorm, REGISTRATION_PURPOSE]
  );
  if (rows.length === 0) {
    throw new AppError('Verification code not found. Please register again.', 404);
  }

  const record = rows[0];
  if (Number(record.is_expired || 0) === 1) {
    throw new AppError('Verification code expired. Please request a new code.', 400);
  }
  if (Number(record.attempts || 0) >= MAX_VERIFY_ATTEMPTS) {
    throw new AppError('Too many incorrect verification attempts. Please register again.', 429);
  }
  if (record.code_hash !== hashCode(emailNorm, cleanCode)) {
    await pool.query('UPDATE email_verification_codes SET attempts = attempts + 1 WHERE id = ?', [record.id]);
    throw new AppError('Invalid verification code', 400);
  }

  const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [emailNorm]);
  if (existing.length > 0) {
    await pool.query('UPDATE email_verification_codes SET consumed_at = NOW() WHERE id = ?', [record.id]);
    throw new AppError('Email already registered', 409);
  }

  const role = 'GUEST';
  const accessTier = 'GUEST';
  const conn = await pool.getConnection();
  let userId;
  try {
    await conn.beginTransaction();
    const [result] = await conn.query(
      `INSERT INTO users (name, email, phone, password_hash, password, role, access_tier, active, email_verified_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE(?, TRUE), NOW())`,
      [record.name, emailNorm, record.phone, record.password_hash, null, role, accessTier, 1]
    );
    userId = result.insertId;
    await conn.query('UPDATE email_verification_codes SET consumed_at = NOW() WHERE id = ?', [record.id]);
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  const token = signToken({ id: userId, role, access_tier: accessTier });

  return {
    token,
    user: sanitizeUser({
      id: userId,
      name: record.name,
      email: emailNorm,
      phone: record.phone,
      role,
      access_tier: accessTier,
      avatar_url: null,
      active: true,
      email_verified_at: new Date(),
      last_login_at: null,
      created_at: null,
      updated_at: null,
    }),
  };
}

async function login({ email, password }) {
  if (!email || !password) {
    throw new AppError('Email and password are required', 400);
  }

  const emailNorm = normalizeEmail(email);
  const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [emailNorm]);
  if (rows.length === 0) {
    throw makeAccountNotFoundError();
  }

  const user = rows[0];
  const active = user.active ?? 1;
  if (!active) {
    throw new AppError('Account is inactive', 403);
  }
  if (!user.email_verified_at) {
    throw new AppError('Please verify your email before logging in', 403);
  }

  // bcrypt compare against password_hash if present; otherwise fallback to legacy `password`
  const storedHash = user.password_hash || user.password;

  if (!storedHash) {
    throw new AppError('Invalid email or password', 401);
  }

  const isMatch = await comparePassword(password, storedHash);
  if (!isMatch) {
    throw new AppError('Invalid email or password', 401);
  }

  await pool.query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]);

  const token = signToken({ id: user.id, role: user.role, access_tier: user.access_tier });

  const fresh = {
    ...user,
    last_login_at: new Date(),
  };

  return {
    token,
    user: sanitizeUser(fresh),
  };
}

async function getMe(userId) {
  const [rows] = await pool.query(
    'SELECT id, name, email, phone, role, access_tier, avatar_url, active, email_verified_at, last_login_at, created_at, updated_at FROM users WHERE id = ?',
    [userId]
  );
  if (rows.length === 0) {
    throw new AppError('User not found', 404);
  }
  return sanitizeUser(rows[0]);
}

module.exports = { startRegistration, startLoginRegistration, verifyRegistration, login, getMe };
