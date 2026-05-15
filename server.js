require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const { pool, testConnection } = require('./src/config/db');
const { errorHandler } = require('./src/middleware/error');
const { verifyToken } = require('./src/utils/jwt');
const { getTokenCookieName } = require('./src/utils/authCookie');
const { isAdminUser } = require('./src/utils/roles');
const { logSystemAction } = require('./src/utils/logger');

const authRoutes = require('./src/routes/auth.routes');
const facilityRoutes = require('./src/routes/facility.routes');
const adminRoutes = require('./src/routes/admin.routes');
const googleAuthRoutes = require('./src/routes/googleAuth.routes');
const githubAuthRoutes = require('./src/routes/githubAuth.routes');
const paymentRoutes = require('./src/routes/payment.routes');

const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const { setUpPassport } = require('./src/config/passport');

const app = express();
const PORT = process.env.PORT || 10000;

function requireEnv(name) {
  if (!process.env[name]) {
    throw new Error(`${name} is required. Set ${name} in .env or Render Environment Variables.`);
  }
}

requireEnv('JWT_SECRET');
requireEnv('SESSION_SECRET');

app.set('trust proxy', 1);

const corsOrigins = (process.env.CLIENT_URL || process.env.CORS_ORIGIN || 'http://localhost:10000')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

// ─── Middleware ──────────────────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", 'https://unpkg.com'],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'https://lottie.host'],
        frameSrc: ["'self'", 'https://lottie.host'],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
      },
    },
  })
);
app.use(
  cors({
    origin: corsOrigins.length ? corsOrigins : true,
    credentials: true,
  })
);

app.use(cookieParser());
app.use(
  express.json({
    verify: (req, res, buf) => {
      if (req.originalUrl.startsWith('/api/payments/paymongo/webhook')) {
        req.rawBody = buf.toString();
      }
    },
  })
);
app.use(express.urlencoded({ extended: true }));

// ─── OAuth (Passport) setup ───────────────────────────────────────────────────
setUpPassport();

app.use(
  session({
    name: 'oauth_session',
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: new MySQLStore({
      host: process.env.MYSQL_HOST,
      port: Number.isFinite(parseInt(process.env.MYSQL_PORT, 10))
        ? parseInt(process.env.MYSQL_PORT, 10)
        : 3306,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE,
      ssl: process.env.MYSQL_SSL_CA
        ? { ca: process.env.MYSQL_SSL_CA.replace(/\\n/g, '\n') }
        : undefined,
    }),
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 20 * 60 * 1000,
    },
  })
);

const passport = require('passport');
app.use(passport.initialize());
app.use(passport.session());

const authApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests. Please try again later.' },
});

function readAuthToken(req) {
  const cookieName = getTokenCookieName();
  if (req.cookies?.[cookieName]) return req.cookies[cookieName];
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) return authHeader.split(' ')[1];
  return null;
}

function clientMeta(req) {
  return {
    ipAddress: req.ip || req.connection?.remoteAddress || null,
    userAgent: req.headers['user-agent'] || null,
  };
}

function currentAdminPath(req) {
  return req.originalUrl && req.originalUrl.startsWith('/admin/')
    ? req.originalUrl
    : '/admin/dashboard.html';
}

async function loadUserFromRequest(req) {
  const token = readAuthToken(req);
  if (!token) return null;
  const decoded = verifyToken(token);
  const [rows] = await pool.query(
    `SELECT id, name, email, phone, role, access_tier, avatar_url, active, last_login_at, created_at, updated_at
     FROM users
     WHERE id = ?`,
    [decoded.id]
  );
  return rows[0] || null;
}

app.get('/admin/login.html', async (req, res) => {
  const { ipAddress, userAgent } = clientMeta(req);
  await logSystemAction({
    userId: null,
    action: 'ADMIN_LOGIN_PAGE_REDIRECTED',
    module: 'AUTH',
    targetType: 'page',
    targetId: '/admin/login.html',
    details: { redirect_to: '/login.html?next=/admin/dashboard.html' },
    ipAddress,
    userAgent,
  });
  return res.redirect(302, '/login.html?next=/admin/dashboard.html');
});

app.get('/admin/*.html', async (req, res, next) => {
  const { ipAddress, userAgent } = clientMeta(req);
  const loginTarget = `/login.html?next=${encodeURIComponent(currentAdminPath(req))}`;

  try {
    const user = await loadUserFromRequest(req);
    if (!user) {
      return res.redirect(302, loginTarget);
    }

    if (!(user.active ?? 1)) {
      return res.redirect(302, '/login.html?error=inactive');
    }

    if (!isAdminUser(user)) {
      await logSystemAction({
        userId: user.id,
        action: 'UNAUTHORIZED_ADMIN_ACCESS',
        module: 'AUTH',
        targetType: 'admin_page',
        targetId: currentAdminPath(req),
        details: { role: user.role, access_tier: user.access_tier },
        ipAddress,
        userAgent,
      });
      return res.redirect(302, '/facilities.html?error=admin_permission');
    }

    return next();
  } catch (err) {
    await logSystemAction({
      userId: null,
      action: 'UNAUTHORIZED_ADMIN_ACCESS',
      module: 'AUTH',
      targetType: 'admin_page',
      targetId: currentAdminPath(req),
      details: { message: err.message },
      ipAddress,
      userAgent,
    });
    return res.redirect(302, loginTarget);
  }
});

// ─── Static Files ────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// ─── API Routes ──────────────────────────────────────────────────────────────
app.use('/api/auth', authApiLimiter, authRoutes);
app.use('/api/auth/google', authApiLimiter, googleAuthRoutes);
app.use('/api/auth/github', authApiLimiter, githubAuthRoutes);

app.use('/api/facilities', facilityRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/payments', paymentRoutes);

// ─── SPA-style routes for a few clean URLs ───────────────────────────────────
const frontendRoutes = ['/login', '/register', '/facilities'];
frontendRoutes.forEach((route) => {
  app.get(route, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', `${route}.html`));
  });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use(errorHandler);

// ─── Start Server ─────────────────────────────────────────────────────────────
async function start() {
  await testConnection();
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
  });
}

start();
