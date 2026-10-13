const router = require('express').Router();
const p = require('../controllers/payments.controller');
const v = require('../validators/bookingsPayments.validators');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');

const canSeePayments = authorize('admin', 'organiser', 'customer');

router.get('/', authenticate, canSeePayments, validate(v.listPayments), p.listPayments);
router.get('/:id', authenticate, canSeePayments, validate(v.idParam), p.getPayment);

module.exports = router;
