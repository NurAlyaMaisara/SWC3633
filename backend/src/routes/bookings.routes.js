const router = require('express').Router();
const c = require('../controllers/bookings.controller');
const p = require('../controllers/payments.controller');
const v = require('../validators/bookingsPayments.validators');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');

const everyone = authorize('admin', 'organiser', 'staff', 'customer');

router.get('/', authenticate, everyone, validate(v.listBookings), c.listBookings);
router.post('/', authenticate, authorize('customer'), validate(v.bookingBody), c.createBooking);
router.get('/:id', authenticate, everyone, validate(v.idParam), c.getBooking);
router.patch('/:id/cancel', authenticate, authorize('customer', 'admin'), validate(v.idParam), c.cancelBooking);

// Payments of one booking
router.get('/:id/payments', authenticate, everyone, validate(v.idParam), p.listBookingPayments);
router.post('/:id/payments', authenticate, authorize('customer'), validate([...v.idParam, ...v.paymentBody]), p.createPayment);

module.exports = router;
