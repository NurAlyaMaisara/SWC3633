// =====================================================================
// Central router (Integration & API Management Lead)
// Every module mounts its own sub-router here, all under /api/v1.
// =====================================================================
const router = require('express').Router();

// Events & Venues lead
router.use('/categories', require('./categories.routes'));
router.use('/venues', require('./venues.routes'));
router.use('/events', require('./events.routes'));
router.use('/schedules', require('./schedules.routes'));

// Auth & Users lead
router.use('/auth', require('./auth.routes'));
router.use('/users', require('./users.routes'));

// Bookings & Payments lead (Zul)
router.use('/bookings', require('./bookings.routes'));
router.use('/payments', require('./payments.routes'));

// Integration & API Management lead (kau)
router.use('/attendance', require('./attendance.routes'));

module.exports = router;