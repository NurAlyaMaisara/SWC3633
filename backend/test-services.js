require('dotenv').config();

const { generateQRUrl } = require('./src/services/qrService');
const { sendBookingConfirmation } = require('./src/services/emailService');

const TEST_EMAIL = 'kl2412017270@student.uptm.edu.my';

(async () => {
  const qrUrl = generateQRUrl('BK-20261001-0001');
  console.log('');
  console.log('=== QR URL ===');
  console.log(qrUrl);

  console.log('');
  console.log('=== Sending email to ' + TEST_EMAIL + ' ===');
  try {
    const result = await sendBookingConfirmation({
      to: TEST_EMAIL,
      customerName: 'Test Customer',
      booking: {
        booking_ref: 'BK-20261001-0001',
        quantity: 2,
        total_amount: 240.0,
      },
      event: { title: 'Malaysia Jazz Night 2026' },
      venue: { name: 'Dewan Filharmonik Petronas', city: 'Kuala Lumpur' },
      schedule: { start_time: '2026-11-14T20:00:00+08:00' },
    });
    console.log('Email sent. Resend response:', result);
  } catch (err) {
    console.error('Email failed:', err.message);
  }
})();