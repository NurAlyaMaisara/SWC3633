// Validation rules for the Bookings & Payments module (/bookings, /payments)
const { body, param, query } = require('express-validator');

const MAX_TICKETS_PER_BOOKING = 10;

const idParam = [
  param('id').isInt({ min: 1 }).withMessage('id must be a positive integer').toInt(),
];

const pagingRules = [
  query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('limit must be between 1 and 50'),
  query('order').optional().isIn(['asc', 'desc']).withMessage("order must be 'asc' or 'desc'"),
];

// ---------- Bookings ----------
const bookingBody = [
  body('schedule_id').isInt({ min: 1 }).withMessage('schedule_id must be a positive integer').toInt(),
  body('quantity').isInt({ min: 1, max: MAX_TICKETS_PER_BOOKING })
    .withMessage(`quantity must be a whole number from 1 to ${MAX_TICKETS_PER_BOOKING}`).toInt(),
];

const listBookings = [
  ...pagingRules,
  query('status').optional().isIn(['pending', 'confirmed', 'cancelled'])
    .withMessage('status must be one of: pending, confirmed, cancelled'),
  query('schedule_id').optional().isInt({ min: 1 }).withMessage('schedule_id must be a positive integer').toInt(),
  query('event_id').optional().isInt({ min: 1 }).withMessage('event_id must be a positive integer').toInt(),
  query('customer_id').optional().isInt({ min: 1 }).withMessage('customer_id must be a positive integer').toInt(),
  query('search').optional().isString().withMessage('search must be text').trim()
    .isLength({ max: 100 }).withMessage('search must be at most 100 characters'),
  query('sort').optional().isIn(['created_at', 'total_amount', 'start_time', 'status'])
    .withMessage('sort must be one of: created_at, total_amount, start_time, status'),
];

// ---------- Payments ----------
const paymentBody = [
  body('method').isIn(['card', 'fpx', 'ewallet']).withMessage('method must be one of: card, fpx, ewallet'),
  // Simulated gateway: "fail" lets testers and the demo show a declined payment
  body('simulate').optional().isIn(['success', 'fail']).withMessage("simulate must be 'success' or 'fail'"),
];

const listPayments = [
  ...pagingRules,
  query('status').optional().isIn(['pending', 'paid', 'failed', 'refunded'])
    .withMessage('status must be one of: pending, paid, failed, refunded'),
  query('method').optional().isIn(['card', 'fpx', 'ewallet']).withMessage('method must be one of: card, fpx, ewallet'),
  query('booking_id').optional().isInt({ min: 1 }).withMessage('booking_id must be a positive integer').toInt(),
  query('sort').optional().isIn(['created_at', 'amount', 'paid_at'])
    .withMessage('sort must be one of: created_at, amount, paid_at'),
];

module.exports = {
  MAX_TICKETS_PER_BOOKING, idParam, bookingBody, listBookings, paymentBody, listPayments,
};
