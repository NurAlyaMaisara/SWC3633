const crypto = require('crypto');
const pool = require('../config/db');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const withTransaction = require('../utils/transaction');
const { sendSuccess } = require('../utils/response');
const { getPagination, getOrderBy, buildMeta, likePattern } = require('../utils/queryHelper');
const {
  BOOKING_SELECT, findBooking, findVisibleBooking, scopeFilter, getBookingPayments,
} = require('../helpers/bookings.helpers');

// e.g. BK-20261013-7F3A9C (date in Malaysia time + 6 random hex characters)
function newBookingRef() {
  const today = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10).replace(/-/g, '');
  return `BK-${today}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

// Locks the schedule row so two customers cannot buy the same last tickets at once
async function lockSchedule(conn, scheduleId) {
  const [rows] = await conn.query(
    `SELECT s.id, s.start_time, s.ticket_price, s.total_tickets, s.available_tickets, s.status,
            e.status AS event_status, e.title AS event_title
       FROM schedules s
       JOIN events e ON e.id = s.event_id
      WHERE s.id = ? FOR UPDATE`,
    [scheduleId]
  );
  return rows[0];
}

const SORTS = {
  created_at: 'b.created_at',
  total_amount: 'b.total_amount',
  start_time: 's.start_time',
  status: 'b.status',
};

// GET /bookings?status=&schedule_id=&event_id=&customer_id=&search=&sort=&order=&page=&limit=
// Customers see their own bookings, organisers the bookings of their events,
// admin and staff see all of them.
exports.listBookings = asyncHandler(async (req, res) => {
  const q = req.query;
  const { page, limit, offset } = getPagination(q);
  const scope = scopeFilter(req.user);
  const where = [scope.sql];
  const params = [...scope.params];

  if (q.status) { where.push('b.status = ?'); params.push(q.status); }
  if (q.schedule_id) { where.push('b.schedule_id = ?'); params.push(q.schedule_id); }
  if (q.event_id) { where.push('s.event_id = ?'); params.push(q.event_id); }
  if (q.customer_id && req.user.role !== 'customer') { where.push('b.customer_id = ?'); params.push(q.customer_id); }
  if (q.search) {
    const pattern = likePattern(q.search);
    where.push('(b.booking_ref LIKE ? OR e.title LIKE ? OR u.full_name LIKE ? OR u.email LIKE ?)');
    params.push(pattern, pattern, pattern, pattern);
  }

  const whereSql = `WHERE ${where.join(' AND ')}`;
  const orderBy = getOrderBy(q, SORTS, 'created_at', 'desc');

  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total
       FROM bookings b
       JOIN users u     ON u.id = b.customer_id
       JOIN schedules s ON s.id = b.schedule_id
       JOIN events e    ON e.id = s.event_id
     ${whereSql}`,
    params
  );
  const [rows] = await pool.query(
    `${BOOKING_SELECT} ${whereSql} ORDER BY ${orderBy}, b.id DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  sendSuccess(res, {
    message: 'Bookings retrieved successfully',
    data: rows,
    meta: buildMeta(page, limit, total),
  });
});

// GET /bookings/:id  (with its payment attempts)
exports.getBooking = asyncHandler(async (req, res) => {
  const booking = await findVisibleBooking(req.params.id, req.user);
  booking.payments = await getBookingPayments(booking.id);
  sendSuccess(res, { message: 'Booking retrieved successfully', data: booking });
});

// POST /bookings  { schedule_id, quantity }
// Creates a pending booking and holds the tickets until it is paid or cancelled.
exports.createBooking = asyncHandler(async (req, res) => {
  const { schedule_id, quantity } = req.body;

  const bookingId = await withTransaction(async (conn) => {
    const schedule = await lockSchedule(conn, schedule_id);

    // Drafts are hidden from customers, so a draft's schedule "does not exist" for them
    if (!schedule || schedule.event_status === 'draft') {
      throw ApiError.validation([{ field: 'schedule_id', message: `Schedule ${schedule_id} does not exist` }]);
    }
    if (schedule.event_status === 'cancelled') {
      throw ApiError.conflict('This event has been cancelled and cannot be booked');
    }
    if (schedule.status === 'closed') {
      throw ApiError.conflict('Bookings for this date are closed');
    }
    if (new Date(schedule.start_time) <= new Date()) {
      throw ApiError.conflict('This date has already started and can no longer be booked');
    }
    // Business rule: never sell more tickets than are left (no overselling)
    if (schedule.available_tickets < quantity) {
      throw ApiError.conflict(
        schedule.available_tickets === 0 ? 'This date is sold out' : `Only ${schedule.available_tickets} tickets are left`,
        [{ field: 'quantity', message: `available_tickets is ${schedule.available_tickets}` }]
      );
    }

    const unitPrice = Number(schedule.ticket_price);
    const total = Math.round(unitPrice * quantity * 100) / 100;
    const [result] = await conn.query(
      `INSERT INTO bookings (booking_ref, customer_id, schedule_id, quantity, unit_price, total_amount, status)
       VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
      [newBookingRef(), req.user.id, schedule.id, quantity, unitPrice, total]
    );

    // Hold the tickets; the date becomes sold_out when the last ticket is taken
    const left = schedule.available_tickets - quantity;
    await conn.query(
      'UPDATE schedules SET available_tickets = ?, status = ? WHERE id = ?',
      [left, left === 0 ? 'sold_out' : schedule.status, schedule.id]
    );
    return result.insertId;
  });

  const booking = await findBooking(bookingId);
  res.location(`/api/v1/bookings/${bookingId}`);
  sendSuccess(res, {
    statusCode: 201,
    message: 'Booking created. Pay within the session to confirm your tickets.',
    data: booking,
  });
});

// PATCH /bookings/:id/cancel
// The customer who made the booking (or an admin) cancels it before the event starts.
// The tickets go back on sale and a paid payment is marked refunded.
exports.cancelBooking = asyncHandler(async (req, res) => {
  const booking = await findBooking(req.params.id);
  const isOwner = req.user.role === 'customer' && Number(req.user.id) === Number(booking.customer_id);
  if (!isOwner && req.user.role !== 'admin') {
    throw ApiError.forbidden('You can only cancel your own bookings');
  }
  if (booking.status === 'cancelled') {
    throw ApiError.conflict('This booking is already cancelled');
  }
  if (new Date(booking.start_time) <= new Date()) {
    throw ApiError.conflict('Bookings cannot be cancelled after the event has started');
  }

  await withTransaction(async (conn) => {
    const schedule = await lockSchedule(conn, booking.schedule_id);
    // Re-read the booking inside the lock, in case it changed since the check above
    const [[current]] = await conn.query('SELECT status, quantity FROM bookings WHERE id = ? FOR UPDATE', [booking.id]);
    if (current.status === 'cancelled') throw ApiError.conflict('This booking is already cancelled');

    await conn.query(
      "UPDATE bookings SET status = 'cancelled', cancelled_at = NOW() WHERE id = ?",
      [booking.id]
    );

    const back = Math.min(schedule.available_tickets + current.quantity, schedule.total_tickets);
    await conn.query(
      'UPDATE schedules SET available_tickets = ?, status = ? WHERE id = ?',
      [back, schedule.status === 'sold_out' ? 'open' : schedule.status, schedule.id]
    );

    await conn.query("UPDATE payments SET status = 'refunded' WHERE booking_id = ? AND status = 'paid'", [booking.id]);
    await conn.query("UPDATE payments SET status = 'failed' WHERE booking_id = ? AND status = 'pending'", [booking.id]);
  });

  const updated = await findBooking(booking.id);
  updated.payments = await getBookingPayments(booking.id);
  sendSuccess(res, {
    message: booking.status === 'confirmed'
      ? 'Booking cancelled. The payment has been refunded.'
      : 'Booking cancelled',
    data: updated,
  });
});
