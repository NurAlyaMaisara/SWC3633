const router = require('express').Router();

// Events & Venues lead
router.use('/categories', require('./categories.routes'));
router.use('/venues', require('./venues.routes'));
router.use('/events', require('./events.routes'));
router.use('/schedules', require('./schedules.routes'));

// Auth & Users lead
router.use('/auth', require('./auth.routes'));
router.use('/users', require('./users.routes'));

// Other leads add theirs here, e.g.:
// router.use('/bookings', require('./bookings.routes'));

router.use('/bookings', require('./bookings.routes'));
router.use('/payments', require('./payments.routes'));

module.exports = router;
