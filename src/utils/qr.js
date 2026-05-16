const crypto = require('crypto');
const QRCode = require('qrcode');

/**
 * Generate a secure, unique token for a booking ticket
 */
function generateQrToken(bookingId) {
  return crypto.randomBytes(32).toString('hex') + '-' + bookingId;
}

/**
 * Generate the private payload encoded into the QR image.
 */
function getQrPayload(qrToken) {
  return `mamagan-ticket://${qrToken}`;
}

/**
 * Generate a scannable QR image as a Data URL.
 */
async function generateQrDataUrl(qrToken) {
  return QRCode.toDataURL(getQrPayload(qrToken), {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 320,
    color: {
      dark: '#0f172a',
      light: '#ffffff'
    }
  });
}

module.exports = {
  generateQrToken,
  generateQrDataUrl,
  getQrPayload
};
