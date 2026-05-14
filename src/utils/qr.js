const crypto = require('crypto');

/**
 * Generate a secure, unique token for a booking ticket
 */
function generateQrToken(bookingId) {
  return crypto.randomBytes(32).toString('hex') + '-' + bookingId;
}

/**
 * Generate a QR Data URL (placeholder for actual image generation)
 * In a real app, we might use a library like 'qrcode'
 * For now, we'll return a structured data string that can be used by frontend
 */
function generateQrDataUrl(qrToken) {
  // Structure: mamagan-ticket://<token>
  return `mamagan-ticket://${qrToken}`;
}

module.exports = {
  generateQrToken,
  generateQrDataUrl
};
