const { pool } = require('../config/db');
const { hashPassword, comparePassword } = require('../utils/hash');
const { signToken } = require('../utils/jwt');
const { AppError } = require('../middleware/error');

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

async function register({ name, email, phone, password }) {
  if (!name || !email || !phone || !password) {
    throw new AppError('Name, email, phone, and password are required', 400);
  }

  // prevent duplicate emails
  const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
  if (existing.length > 0) {
    throw new AppError('Email already registered', 409);
  }

  const hashed = await hashPassword(password);

  // Requirements: new registered users must be role GUEST.
  // access_tier should be GUEST if the field exists; safely force it here.
  const role = 'GUEST';
  const accessTier = 'GUEST';

  const [result] = await pool.query(
    `INSERT INTO users (name, email, phone, password_hash, password, role, access_tier, active)
     VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE(?, TRUE))`,
    [name, email, phone, hashed, null, role, accessTier, 1]
  );

  const token = signToken({ id: result.insertId, role, access_tier: accessTier });

  return {
    token,
    user: sanitizeUser({
      id: result.insertId,
      name,
      email,
      phone,
      role,
      access_tier: accessTier,
      avatar_url: null,
      active: true,
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

  const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
  if (rows.length === 0) {
    throw new AppError('Invalid email or password', 401);
  }

  const user = rows[0];
  const active = user.active ?? 1;
  if (!active) {
    throw new AppError('Account is inactive', 403);
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
    'SELECT id, name, email, phone, role, access_tier, avatar_url, active, last_login_at, created_at, updated_at FROM users WHERE id = ?',
    [userId]
  );
  if (rows.length === 0) {
    throw new AppError('User not found', 404);
  }
  return sanitizeUser(rows[0]);
}

module.exports = { register, login, getMe };
