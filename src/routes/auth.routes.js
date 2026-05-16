const express = require('express');
const rateLimit = require('express-rate-limit');

const authController = require('../controllers/auth.controller');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { oauthFailureRedirect } = require('../utils/safeRedirect');

const loginRegisterLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many login attempts. Please try again later.' },
});

const router = express.Router();

router.post('/register', loginRegisterLimiter, authController.register);
router.post('/register/verify', loginRegisterLimiter, authController.verifyRegistration);
router.post('/login', loginRegisterLimiter, authController.login);
router.post('/logout', optionalAuth, authController.logout);
router.get('/me', requireAuth, authController.getMe);

router.get('/oauth/failure', (req, res) => {
  res.redirect(oauthFailureRedirect());
});

module.exports = router;
