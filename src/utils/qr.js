const crypto = require('crypto');
const QRCode = require('qrcode');

/**
 * Generate a secure, unique token for a booking ticket
 */
function generateQrToken(bookingId) {
  return crypto.randomBytes(32).toString('hex') + '-' + bookingId;
}

/**
 * Generate a staff-friendly reference number for manual ticket audit.
 */
function generateTicketReference(bookingId) {
  const suffix = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `MAM-${bookingId}-${suffix}`;
}

/**
 * Generate the private payload encoded into the QR image.
 */
function getQrPayload(qrToken, referenceNumber) {
  const payload = `mamagan-ticket://${qrToken}`;
  return referenceNumber ? `${payload}?ref=${encodeURIComponent(referenceNumber)}` : payload;
}

/**
 * Extract ticket identifiers from a QR scan.
 */
function parseQrPayload(payload) {
  const value = String(payload || '').trim();
  const prefix = 'mamagan-ticket://';

  if (value.startsWith(prefix)) {
    const withoutPrefix = value.slice(prefix.length);
    const [qrToken, query = ''] = withoutPrefix.split('?');
    const params = new URLSearchParams(query);
    return {
      qrToken,
      referenceNumber: params.get('ref') || null,
      isTicketPayload: true,
      raw: value
    };
  }

  return {
    qrToken: value,
    referenceNumber: value,
    isTicketPayload: false,
    raw: value
  };
}

/**
 * Generate a scannable QR image as a Data URL.
 */
async function generateQrDataUrl(qrToken, referenceNumber) {
  return QRCode.toDataURL(getQrPayload(qrToken, referenceNumber), {
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
  generateTicketReference,
  generateQrDataUrl,
  getQrPayload,
  parseQrPayload
};
