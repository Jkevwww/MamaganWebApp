const paymentService = require('../services/payment.service');

async function createCheckout(req, res, next) {
  try {
    const { bookingId } = req.body;
    if (!bookingId) {
      return res.status(400).json({ message: 'bookingId is required' });
    }
    const result = await paymentService.createCheckoutSession(bookingId, req.user.id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

async function paymongoWebhook(req, res, next) {
  try {
    const signature = req.headers['paymongo-signature'];
    if (!signature) {
      return res.status(400).json({ message: 'Missing signature' });
    }
    const result = await paymentService.handleWebhook(req.rawBody, signature);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

async function mockSuccess(req, res, next) {
  try {
    const { bookingId } = req.body;
    if (!bookingId) {
      return res.status(400).json({ message: 'bookingId is required' });
    }
    const result = await paymentService.processMockSuccess(bookingId, req.user.id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

async function getStatus(req, res, next) {
  try {
    const result = await paymentService.getPaymentStatus(req.params.bookingId, req.user.id);
    if (!result) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createCheckout,
  paymongoWebhook,
  mockSuccess,
  getStatus
};
