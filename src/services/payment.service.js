const { pool } = require('../config/db');
const { AppError } = require('../middleware/error');
const qrUtils = require('../utils/qr');
const crypto = require('crypto');
const axios = require('axios');

const PAYMONGO_SECRET_KEY = process.env.PAYMONGO_SECRET_KEY;
const PAYMONGO_WEBHOOK_SECRET = process.env.PAYMONGO_WEBHOOK_SECRET;
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';
const MOCK_PAYMENTS = process.env.MOCK_PAYMENTS === 'true';

function paymongoHeaders() {
  return {
    Authorization: `Basic ${Buffer.from(PAYMONGO_SECRET_KEY + ':').toString('base64')}`,
    'Content-Type': 'application/json'
  };
}

function getPaymentFromCheckoutSession(session) {
  const payments = session?.attributes?.payments || [];
  return payments.find((payment) => payment?.attributes?.status === 'paid') || payments[0] || null;
}

function getPaymentMethod(payment) {
  return payment?.attributes?.source?.type
    || payment?.attributes?.payment_method?.type
    || payment?.attributes?.payment_method_type
    || null;
}

async function markBookingPaid(conn, { bookingId, checkoutId, payment, rawPayload }) {
  const paymentId = payment?.id || null;
  const paymentMethod = getPaymentMethod(payment);
  const payloadJson = rawPayload ? JSON.stringify(rawPayload) : null;

  if (checkoutId) {
    await conn.query(
      `UPDATE payments SET 
       provider_payment_id = COALESCE(?, provider_payment_id), 
       payment_method = COALESCE(?, payment_method), 
       status = 'paid', 
       raw_payload = COALESCE(?, raw_payload) 
       WHERE provider_checkout_id = ?`,
      [paymentId, paymentMethod, payloadJson, checkoutId]
    );
  }

  await conn.query(
    "UPDATE bookings SET status = 'approved', payment_status = 'paid' WHERE id = ?",
    [bookingId]
  );

  const qrToken = qrUtils.generateQrToken(bookingId);
  await conn.query(
    "INSERT INTO tickets (booking_id, qr_token, status) VALUES (?, ?, 'valid') ON DUPLICATE KEY UPDATE status='valid'",
    [bookingId, qrToken]
  );
}

/**
 * Create a PayMongo Checkout Session
 */
async function createCheckoutSession(bookingId, userId) {
  // 1. Get booking details
  const [bookings] = await pool.query(
    `SELECT b.*, f.name as facility_name 
     FROM bookings b 
     JOIN facilities f ON f.id = b.facility_id 
     WHERE b.id = ? AND b.user_id = ?`,
    [bookingId, userId]
  );

  if (bookings.length === 0) {
    throw new AppError('Booking not found', 404);
  }

  const booking = bookings[0];

  if (booking.status === 'cancelled') {
    throw new AppError('Cannot pay for a cancelled booking', 400);
  }

  if (booking.payment_status === 'paid') {
    throw new AppError('Booking is already paid', 400);
  }

  if (await syncPaidCheckoutSession(bookingId, userId)) {
    throw new AppError('Booking is already paid', 400);
  }

  // 2. If Mock Payments are enabled, we just return a mock URL
  if (MOCK_PAYMENTS && !PAYMONGO_SECRET_KEY) {
    return {
      checkout_url: `${SERVER_URL}/payment-success.html?booking_id=${bookingId}&mock=true`,
      id: 'mock_checkout_' + Date.now()
    };
  }

  // 3. Create PayMongo Checkout Session
  const amountCentavos = Math.round(booking.total_amount * 100);

  try {
    const response = await axios.post(
      'https://api.paymongo.com/v1/checkout_sessions',
      {
        data: {
          attributes: {
            send_email_receipt: true,
            show_description: true,
            show_line_items: true,
            line_items: [
              {
                amount: amountCentavos,
                currency: 'PHP',
                description: `Mamagan Resort Reservation: ${booking.facility_name}`,
                name: booking.facility_name,
                quantity: booking.quantity
              }
            ],
            payment_method_types: ['gcash', 'paymaya', 'grab_pay', 'card'],
            success_url: `${SERVER_URL}/payment-success.html?booking_id=${bookingId}`,
            cancel_url: `${SERVER_URL}/payment-cancel.html?booking_id=${bookingId}`,
            description: `Booking #${bookingId} at Mamagan Resort`
          }
        }
      },
      {
        headers: paymongoHeaders()
      }
    );

    const session = response.data.data;

    // 4. Save checkout session info
    await pool.query(
      `INSERT INTO payments (booking_id, provider_checkout_id, amount, status) 
       VALUES (?, ?, ?, 'pending')`,
      [bookingId, session.id, booking.total_amount]
    );

    return {
      checkout_url: session.attributes.checkout_url,
      id: session.id
    };
  } catch (err) {
    console.error('PayMongo Error:', err.response?.data || err.message);
    throw new AppError('Failed to create payment session', 500);
  }
}

/**
 * Handle PayMongo Webhook
 */
async function handleWebhook(payload, signature) {
  // 1. Verify signature
  if (!verifySignature(payload, signature)) {
    throw new AppError('Invalid webhook signature', 400);
  }

  const event = JSON.parse(payload);
  const eventId = event.data.id;
  const eventType = event.data.attributes.type;

  // 2. Check for duplicate processing (idempotency)
  const [existing] = await pool.query('SELECT id FROM webhook_events WHERE event_id = ?', [eventId]);
  if (existing.length > 0) {
    return { status: 'already_processed' };
  }

  // 3. Process event
  const conn = await pool.getConnection();
  await conn.beginTransaction();

  try {
    if (eventType === 'checkout_session.payment.paid') {
      const session = event.data.attributes.data;
      const checkoutId = session.id;
      const payment = getPaymentFromCheckoutSession(session);

      // Get booking ID
      const [paymentRows] = await conn.query('SELECT booking_id FROM payments WHERE provider_checkout_id = ?', [checkoutId]);
      if (paymentRows.length > 0) {
        const bookingId = paymentRows[0].booking_id;
        await markBookingPaid(conn, { bookingId, checkoutId, payment, rawPayload: event });
      }
    }

    // Record processed event
    await conn.query(
      `INSERT INTO webhook_events (provider, event_id, event_type, raw_payload) 
       VALUES ('paymongo', ?, ?, ?)`,
      [eventId, eventType, JSON.stringify(event)]
    );

    await conn.commit();
    return { status: 'success' };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * Simulate Mock Success
 */
async function processMockSuccess(bookingId, userId) {
  if (!MOCK_PAYMENTS) {
    throw new AppError('Mock payments not allowed in this environment', 403);
  }

  const conn = await pool.getConnection();
  await conn.beginTransaction();

  try {
    // 1. Verify booking ownership and status
    const [bookings] = await conn.query(
      "SELECT * FROM bookings WHERE id = ? AND user_id = ? AND payment_status != 'paid'",
      [bookingId, userId]
    );

    if (bookings.length === 0) {
      throw new AppError('Booking not found or already paid', 404);
    }

    // 2. Create/Update payment record
    await conn.query(
      `INSERT INTO payments (booking_id, provider, payment_method, provider_payment_id, amount, status) 
       VALUES (?, 'mock', 'gcash', ?, ?, 'paid') 
       ON DUPLICATE KEY UPDATE status = 'paid', provider_payment_id = VALUES(provider_payment_id)`,
      [bookingId, 'mock_pay_' + Date.now(), bookings[0].total_amount]
    );

    // 3. Update booking
    await conn.query(
      "UPDATE bookings SET status = 'approved', payment_status = 'paid' WHERE id = ?",
      [bookingId]
    );

    // 4. Generate Ticket
    const qrToken = qrUtils.generateQrToken(bookingId);
    await conn.query(
      "INSERT INTO tickets (booking_id, qr_token, status) VALUES (?, ?, 'valid') ON DUPLICATE KEY UPDATE status='valid'",
      [bookingId, qrToken]
    );

    await conn.commit();
    return { status: 'success', bookingId };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * Verify PayMongo Signature
 */
function verifySignature(payload, signatureHeader) {
  if (!PAYMONGO_WEBHOOK_SECRET) return true; // Safety for dev if not set, though risky

  const [timestampPart, signaturePart] = signatureHeader.split(',');
  const timestamp = timestampPart.split('=')[1];
  const signature = signaturePart.split('=')[1];

  const baseString = timestamp + '.' + payload;
  const hash = crypto
    .createHmac('sha256', PAYMONGO_WEBHOOK_SECRET)
    .update(baseString)
    .digest('hex');

  return hash === signature;
}

async function getPaymentStatus(bookingId, userId) {
  const [rows] = await pool.query(
    "SELECT payment_status, status FROM bookings WHERE id = ? AND user_id = ?",
    [bookingId, userId]
  );
  const booking = rows[0] || null;
  if (!booking || booking.payment_status === 'paid') return booking;

  const synced = await syncPaidCheckoutSession(bookingId, userId);
  if (!synced) return booking;

  return { payment_status: 'paid', status: 'approved', synced: true };
}

async function syncPaidCheckoutSession(bookingId, userId) {
  if (!PAYMONGO_SECRET_KEY) return false;

  const [paymentRows] = await pool.query(
    `SELECT p.provider_checkout_id
     FROM payments p
     JOIN bookings b ON b.id = p.booking_id
     WHERE p.booking_id = ? AND b.user_id = ? AND p.provider = 'paymongo' AND p.provider_checkout_id IS NOT NULL
     ORDER BY p.created_at DESC, p.id DESC
     LIMIT 1`,
    [bookingId, userId]
  );

  const checkoutId = paymentRows[0]?.provider_checkout_id;
  if (!checkoutId) return false;

  let session;
  try {
    const response = await axios.get(
      `https://api.paymongo.com/v1/checkout_sessions/${encodeURIComponent(checkoutId)}`,
      { headers: paymongoHeaders() }
    );
    session = response.data.data;
  } catch (err) {
    console.error('PayMongo checkout sync error:', err.response?.data || err.message);
    return false;
  }

  const payment = getPaymentFromCheckoutSession(session);
  const paymentStatus = payment?.attributes?.status;
  if (!payment || (paymentStatus && paymentStatus !== 'paid')) return false;

  const conn = await pool.getConnection();
  await conn.beginTransaction();

  try {
    await markBookingPaid(conn, {
      bookingId,
      checkoutId,
      payment,
      rawPayload: { source: 'checkout_sync', data: session }
    });
    await conn.commit();
    return true;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = {
  createCheckoutSession,
  handleWebhook,
  processMockSuccess,
  getPaymentStatus
};
