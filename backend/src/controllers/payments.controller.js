const crypto = require('crypto');
const pool = require('../config/db');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const withTransaction = require('../utils/transaction');
const { sendSuccess } = require('../utils/response');
const { getPagination, getOrderBy, buildMeta } = require('../utils/queryHelper');
const {
  findBooking, findVisibleBooking, scopeFilter, getBookingPayments,
} = require('../helpers/bookings.helpers');

const PAYMENT_SELECT = `
  SELECT p.id, p.booking_id, b.booking_ref, p.amount, p.method, p.transaction_ref, p.status,
         p.paid_at, b.customer_id, u.full_name AS customer_name, e.id AS event_id,
         e.title AS event_title, e.organiser_id, p.created_at, p.updated_at
    FROM payments p
    JOIN bookings b  ON b.id = p.booking_id
    JOIN users u     ON u.id = b.customer_id
    JOIN schedules s ON s.id = b.schedule_id
    JOIN events e    ON e.id = s.event_id`;

// e.g. TXN-CARD-M2X8K1-4F9A2C
function newTransactionRef(method) {
  return `TXN-${method.toUpperCase()}-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

function canViewPayment(user, payment) {
  if (user.role === 'admin') return true;
  if (user.role === 'customer') return Number(user.id) === Number(payment.customer_id);
  if (user.role === 'organiser') return Number(user.id) === Number(payment.organiser_id);
  return false;
}

const SORTS = { created_at: 'p.created_at', amount: 'p.amount', paid_at: 'p.paid_at' };

// GET /payments?status=&method=&booking_id=&sort=&order=&page=&limit=
// Admin sees all, a customer their own, an organiser the payments for their events.
exports.listPayments = asyncHandler(async (req, res) => {
  const q = req.query;
  const { page, limit, offset } = getPagination(q);
  const scope = scopeFilter(req.user);
  const where = [scope.sql];
  const params = [...scope.params];

  if (q.status) { where.push('p.status = ?'); params.push(q.status); }
  if (q.method) { where.push('p.method = ?'); params.push(q.method); }
  if (q.booking_id) { where.push('p.booking_id = ?'); params.push(q.booking_id); }

  const whereSql = `WHERE ${where.join(' AND ')}`;
  const orderBy = getOrderBy(q, SORTS, 'created_at', 'desc');

  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total
       FROM payments p
       JOIN bookings b  ON b.id = p.booking_id
       JOIN schedules s ON s.id = b.schedule_id
       JOIN events e    ON e.id = s.event_id
     ${whereSql}`,
    params
  );
  const [rows] = await pool.query(
    `${PAYMENT_SELECT} ${whereSql} ORDER BY ${orderBy}, p.id DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  sendSuccess(res, {
    message: 'Payments retrieved successfully',
    data: rows,
    meta: buildMeta(page, limit, total),
  });
});

// GET /payments/:id
exports.getPayment = asyncHandler(async (req, res) => {
  const [rows] = await pool.query(`${PAYMENT_SELECT} WHERE p.id = ?`, [req.params.id]);
  if (!rows.length) throw ApiError.notFound(`Payment with id ${req.params.id} not found`);
  if (!canViewPayment(req.user, rows[0])) {
    throw ApiError.forbidden('You can only view your own payments');
  }
  sendSuccess(res, { message: 'Payment retrieved successfully', data: rows[0] });
});

// GET /bookings/:id/payments  (every payment attempt for one booking)
exports.listBookingPayments = asyncHandler(async (req, res) => {
  const booking = await findVisibleBooking(req.params.id, req.user);
  sendSuccess(res, {
    message: 'Payments retrieved successfully',
    data: await getBookingPayments(booking.id),
  });
});

// POST /bookings/:id/payments  { method, simulate? }
// Simulated payment gateway: success confirms the booking; "fail" records a
// declined attempt and keeps the booking pending so the customer can try again.
exports.createPayment = asyncHandler(async (req, res) => {
  const booking = await findBooking(req.params.id);
  if (Number(req.user.id) !== Number(booking.customer_id)) {
    throw ApiError.forbidden('You can only pay for your own bookings');
  }

  const { method } = req.body;
  const approved = req.body.simulate !== 'fail';

  const paymentId = await withTransaction(async (conn) => {
    // Lock the booking so a double click cannot pay for it twice
    const [[current]] = await conn.query(
      'SELECT status, total_amount FROM bookings WHERE id = ? FOR UPDATE',
      [booking.id]
    );
    if (current.status === 'confirmed') throw ApiError.conflict('This booking is already paid');
    if (current.status === 'cancelled') throw ApiError.conflict('This booking is cancelled and cannot be paid');
    if (new Date(booking.start_time) <= new Date()) {
      throw ApiError.conflict('This date has already started and can no longer be paid for');
    }

    const [result] = await conn.query(
      `INSERT INTO payments (booking_id, amount, method, transaction_ref, status, paid_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        booking.id, current.total_amount, method,
        approved ? newTransactionRef(method) : null,
        approved ? 'paid' : 'failed',
        approved ? new Date() : null,
      ]
    );
    if (approved) {
      await conn.query("UPDATE bookings SET status = 'confirmed' WHERE id = ?", [booking.id]);
      // The Integration lead hooks the QR ticket and confirmation email in here.
    }
    return result.insertId;
  });

  const [[payment]] = await pool.query(`${PAYMENT_SELECT} WHERE p.id = ?`, [paymentId]);

  if (!approved) {
    // The failed attempt is saved (committed above) and the client gets a clear error
    throw new ApiError(402, 'PAYMENT_FAILED',
      'Payment was declined. Your tickets are still held; try again or cancel the booking.',
      [{ field: 'payment_id', message: `Failed attempt saved as payment ${payment.id}` }]);
  }

  res.location(`/api/v1/payments/${paymentId}`);
  sendSuccess(res, {
    statusCode: 201,
    message: 'Payment successful. Your booking is confirmed.',
    data: { payment, booking: await findBooking(booking.id) },
  });
});
