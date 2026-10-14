// =====================================================================
// Attendance controller (Integration & API Management Lead)
// Handles staff check-in of ticket holders at the venue:
//   - Look up a booking by booking_ref or QR content
//   - Mark it as checked-in (idempotent: repeated calls return the same)
//   - List all check-ins for a schedule (attendance report)
// =====================================================================
const pool = require('../config/db');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/response');

const checkInLog = new Map(); // booking_ref -> { booking_id, staff_id, checked_in_at }

function extractBookingRef(raw) {
  if (!raw) return null;
  const value = String(raw).trim();
  try {
    const parsed = JSON.parse(value);
    if (parsed && parsed.ref) return String(parsed.ref).trim();
  } catch (_) {
    /* not JSON - fall through */
  }
  return value;
}

// GET /api/v1/attendance/lookup/:ref
exports.lookupBooking = asyncHandler(async (req, res) => {
  const ref = extractBookingRef(req.params.ref);

  const [rows] = await pool.query(
    `SELECT b.id, b.booking_ref, b.quantity, b.status, b.total_amount,
            s.id AS schedule_id, s.start_time, s.end_time,
            e.title AS event_title,
            v.name AS venue_name, v.city AS venue_city,
            u.full_name AS customer_name
     FROM bookings b
     JOIN schedules s ON s.id = b.schedule_id
     JOIN events e ON e.id = s.event_id
     JOIN venues v ON v.id = s.venue_id
     JOIN users u ON u.id = b.customer_id
     WHERE b.booking_ref = ?
     LIMIT 1`,
    [ref]
  );

  if (rows.length === 0) {
    throw ApiError.notFound('Booking not found for this reference');
  }

  const booking = rows[0];
  const existing = checkInLog.get(booking.booking_ref);

  return sendSuccess(res, {
    message: 'Booking found',
    data: {
      booking: {
        id: booking.id,
        booking_ref: booking.booking_ref,
        customer_name: booking.customer_name,
        event_title: booking.event_title,
        venue_name: booking.venue_name,
        venue_city: booking.venue_city,
        start_time: booking.start_time,
        end_time: booking.end_time,
        quantity: booking.quantity,
        total_amount: booking.total_amount,
        status: booking.status,
      },
      checked_in: Boolean(existing),
      checked_in_at: existing ? existing.checked_in_at : null,
    },
  });
});

// PATCH /api/v1/attendance/:ref/check-in
exports.checkIn = asyncHandler(async (req, res) => {
  const ref = extractBookingRef(req.params.ref);

  const [rows] = await pool.query(
    `SELECT b.id, b.booking_ref, b.status, b.quantity,
            e.title AS event_title
     FROM bookings b
     JOIN schedules s ON s.id = b.schedule_id
     JOIN events e ON e.id = s.event_id
     WHERE b.booking_ref = ?
     LIMIT 1`,
    [ref]
  );

  if (rows.length === 0) {
    throw ApiError.notFound('Booking not found for this reference');
  }

  const booking = rows[0];

  if (booking.status === 'cancelled') {
    throw ApiError.conflict('This booking has been cancelled');
  }
  if (booking.status !== 'confirmed') {
    throw ApiError.conflict('Only confirmed bookings can be checked in');
  }

  const existing = checkInLog.get(booking.booking_ref);
  if (existing) {
    return sendSuccess(res, {
      message: 'Booking already checked in',
      data: {
        booking_ref: booking.booking_ref,
        event_title: booking.event_title,
        quantity: booking.quantity,
        checked_in: true,
        checked_in_at: existing.checked_in_at,
        already_checked_in: true,
      },
    });
  }

  const entry = {
    booking_id: booking.id,
    staff_id: req.user.id,
    checked_in_at: new Date().toISOString(),
  };
  checkInLog.set(booking.booking_ref, entry);

  return sendSuccess(res, {
    message: 'Check-in successful',
    data: {
      booking_ref: booking.booking_ref,
      event_title: booking.event_title,
      quantity: booking.quantity,
      checked_in: true,
      checked_in_at: entry.checked_in_at,
      already_checked_in: false,
    },
  });
});

// GET /api/v1/attendance
exports.listAttendance = asyncHandler(async (req, res) => {
  const items = Array.from(checkInLog.entries()).map(([ref, entry]) => ({
    booking_ref: ref,
    booking_id: entry.booking_id,
    staff_id: entry.staff_id,
    checked_in_at: entry.checked_in_at,
  }));

  return sendSuccess(res, {
    message: 'Attendance retrieved successfully',
    data: {
      total_check_ins: items.length,
      items,
    },
  });
});