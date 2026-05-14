const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/payment.controller');
const authMiddleware = require('../middleware/auth');

// POST /api/payments/create-checkout
router.post('/create-checkout', authMiddleware, paymentController.createCheckout);

// POST /api/payments/paymongo/webhook (Public, but verified via signature)
router.post('/paymongo/webhook', paymentController.paymongoWebhook);

// POST /api/payments/mock-success
router.post('/mock-success', authMiddleware, paymentController.mockSuccess);

// GET /api/payments/status/:bookingId
router.get('/status/:bookingId', authMiddleware, paymentController.getStatus);

module.exports = router;
