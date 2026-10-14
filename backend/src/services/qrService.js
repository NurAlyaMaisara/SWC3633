// =====================================================================
// QR service (Integration & API Management Lead)
// Generates QR code images through the external qrserver.com API.
// No library is used on purpose: this is a genuine third-party HTTP
// service, so the QR code is generated remotely and returned as PNG.
//
// QR contains a verification URL like:
//   https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=...
// The Staff frontend scans the QR, extracts booking_ref, then calls
// PATCH /api/v1/attendance/:bookingRef/check-in
// =====================================================================
const axios = require('axios');

const QR_API_BASE = 'https://api.qrserver.com/v1/create-qr-code/';
const QR_DEFAULT_SIZE = '300x300';

/**
 * Build the QR code image URL for a booking reference.
 * The QR payload is a small JSON string so future readers can identify
 * the booking without extra lookups.
 */
function buildQRPayload(bookingRef) {
  return JSON.stringify({ type: 'ticket.exe', ref: bookingRef });
}

/**
 * Return the QR image URL (used in <img src="..."> and in email HTML).
 * The URL itself is the "request" to the external service; the PNG is
 * fetched by the browser or by the email client.
 */
function generateQRUrl(bookingRef, size = QR_DEFAULT_SIZE) {
  const data = encodeURIComponent(buildQRPayload(bookingRef));
  return `${QR_API_BASE}?size=${size}&data=${data}`;
}

/**
 * Optionally download the QR as a Buffer, useful if the caller wants to
 * attach the image to an email instead of linking to it.
 */
async function fetchQRImage(bookingRef, size = QR_DEFAULT_SIZE) {
  const url = generateQRUrl(bookingRef, size);
  const response = await axios.get(url, { responseType: 'arraybuffer' });
  return {
    url,
    contentType: response.headers['content-type'] || 'image/png',
    buffer: Buffer.from(response.data),
  };
}

module.exports = { generateQRUrl, fetchQRImage, buildQRPayload };