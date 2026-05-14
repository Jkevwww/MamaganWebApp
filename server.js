require('dotenv').config();

const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const passport = require('passport');

const { initAuth } = require('./src/auth');
const { sequelize } = require('./src/db');
const { ensureAuth } = require('./src/middleware/auth');



const app = express();

app.use(helmet());
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(cookieParser());

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'dev_session_secret_change_me',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'lax' : 'lax'
    }
  })
);

app.use(passport.initialize());
app.use(passport.session());

initAuth(passport);

// OAuth routes (defined here so they always exist)
app.get('/auth/google', (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID) return res.status(500).send('Google OAuth not configured.');
  passport.authenticate('google', { scope: ['profile', 'email'], prompt: 'select_account' })(req, res, next);
});

app.get('/auth/google/callback', (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID) return res.status(500).send('Google OAuth not configured.');
  passport.authenticate('google', { failureRedirect: '/' }, (err) => {
    if (err) return next(err);
    res.redirect('/');
  })(req, res, next);
});

app.get('/auth/github', (req, res, next) => {
  if (!process.env.GITHUB_CLIENT_ID) return res.status(500).send('GitHub OAuth not configured.');
  passport.authenticate('github', { scope: ['user:email'] })(req, res, next);
});

app.get('/auth/github/callback', (req, res, next) => {
  if (!process.env.GITHUB_CLIENT_ID) return res.status(500).send('GitHub OAuth not configured.');
  passport.authenticate('github', { failureRedirect: '/' }, (err) => {
    if (err) return next(err);
    res.redirect('/');
  })(req, res, next);
});


app.use(express.static(path.join(__dirname, 'public')));

app.get('/auth/me', ensureAuth, async (req, res) => {
  res.json({ user: req.user });
});

app.get('/auth/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    req.session.destroy(() => {
      res.redirect('/');
    });
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check
app.get('/health', (req, res) => res.json({ ok: true }));

const port = process.env.PORT || 3000;

(async () => {
  try {
    // Ensure DB connection is ready (models sync is intentionally omitted for safety).
    await sequelize.authenticate();
    console.log('DB connected');
  } catch (e) {
    console.warn('DB connection check failed (continuing for scaffold).', e.message);
  }

  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
})();

