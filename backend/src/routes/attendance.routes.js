// =====================================================================
// Attendance routes (Integration & API Management Lead)
// Staff check-in workflows: lookup a booking, check in a customer,
// and list all check-ins. Protected by JWT + role check.
// =====================================================================
const express = require('express');
const router = express.Router();

const attendanceController = require('../controllers/attendance.controller');
const { authenticate, authorize } = require('../middleware/auth');

// All attendance routes require a valid JWT
router.use(authenticate);

// GET /api/v1/attendance/lookup/:ref
// Staff or admin looks up a booking before check-in
router.get(
  '/lookup/:ref',
  authorize('admin', 'organiser', 'staff'),
  attendanceController.lookupBooking
);

// PATCH /api/v1/attendance/:ref/check-in
// Staff or admin confirms a check-in
router.patch(
  '/:ref/check-in',
  authorize('admin', 'organiser', 'staff'),
  attendanceController.checkIn
);

// GET /api/v1/attendance
// Summary of all check-ins (admin, organiser, staff)
router.get(
  '/',
  authorize('admin', 'organiser', 'staff'),
  attendanceController.listAttendance
);

module.exports = router;