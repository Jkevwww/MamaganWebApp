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

const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const { setUpPassport } = require('./src/config/passport');





const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ──────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || true,
  credentials: true,
}));

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── OAuth (Passport) setup ───────────────────────────────────────────────
setUpPassport();

// OAuth requires session middleware so Passport can maintain the login state.
// JWT remains the main app auth mechanism (set after OAuth completes).
app.use(
  session({

    name: 'oauth_session',
    secret: process.env.SESSION_SECRET || 'dev_session_secret_change_me',
    resave: false,
    saveUninitialized: false,
    store: new MySQLStore({
      // Uses same MySQL env vars as the app
      host: process.env.MYSQL_HOST,
      port: parseInt(process.env.MYSQL_PORT) || 3306,
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
    },
  })
);

const passport = require('passport');
app.use(passport.initialize());
app.use(passport.session());



const authLimiter = rateLimit({

  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests. Please try again later.' },
});


// ─── Static Files ────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ─── API Routes ──────────────────────────────────────────────────────────────
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/auth/google', googleAuthRoutes);



// In production, frontend may rely on secure cookies; CORS should allow credentials.
// (If CORS is configured differently elsewhere, adjust there.)
app.use('/api/facilities', facilityRoutes);
app.use('/api/admin', adminRoutes);


// ─── SPA Fallback: serve HTML for known frontend routes ──────────────────────
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
