require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const { testConnection } = require('./src/config/db');
const { errorHandler } = require('./src/middleware/error');

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

const corsOrigins = (process.env.CLIENT_URL || process.env.CORS_ORIGIN || 'http://localhost:10000')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

// ─── Middleware ──────────────────────────────────────────────────────────────
app.use(helmet());
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
    secret: process.env.SESSION_SECRET || 'dev_session_secret_change_me',
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
