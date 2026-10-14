// Shared queries for bookings, used by both the bookings and payments controllers
const pool = require('../config/db');
const ApiError = require('../utils/ApiError');

// One booking with the schedule, event, venue and customer it belongs to.
// payment_status is the result of the latest payment attempt (null = not paid yet).
const BOOKING_SELECT = `
  SELECT b.id, b.booking_ref, b.status, b.quantity, b.unit_price, b.total_amount,
         b.customer_id, u.full_name AS customer_name, u.email AS customer_email,
         b.schedule_id, s.start_time, s.end_time, s.status AS schedule_status,
         s.event_id, e.title AS event_title, c.name AS category_name, e.organiser_id,
         s.venue_id, v.name AS venue_name, v.city AS venue_city,
         (SELECT p.status FROM payments p WHERE p.booking_id = b.id
           ORDER BY p.created_at DESC, p.id DESC LIMIT 1) AS payment_status,
         b.cancelled_at, b.created_at, b.updated_at
    FROM bookings b
    JOIN users u     ON u.id = b.customer_id
    JOIN schedules s ON s.id = b.schedule_id
    JOIN events e    ON e.id = s.event_id
    JOIN event_categories c ON c.id = e.category_id
    JOIN venues v    ON v.id = s.venue_id`;

async function findBooking(id) {
  const [rows] = await pool.query(`${BOOKING_SELECT} WHERE b.id = ?`, [id]);
  if (!rows.length) throw ApiError.notFound(`Booking with id ${id} not found`);
  return rows[0];
}

// Who may see a booking: admin and staff see all, a customer sees their own,
// an organiser sees bookings for their own events
function canViewBooking(user, booking) {
  if (!user) return false;
  if (user.role === 'admin' || user.role === 'staff') return true;
  if (user.role === 'customer') return Number(user.id) === Number(booking.customer_id);
  if (user.role === 'organiser') return Number(user.id) === Number(booking.organiser_id);
  return false;
}

async function findVisibleBooking(id, user) {
  const booking = await findBooking(id);
  if (!canViewBooking(user, booking)) {
    throw ApiError.forbidden('You can only view your own bookings');
  }
  return booking;
}

// SQL filter that limits a list to what the user may see (same rules as above)
function scopeFilter(user) {
  if (user.role === 'customer') return { sql: 'b.customer_id = ?', params: [user.id] };
  if (user.role === 'organiser') return { sql: 'e.organiser_id = ?', params: [user.id] };
  return { sql: '1 = 1', params: [] };
}

async function getBookingPayments(bookingId) {
  const [rows] = await pool.query(
    `SELECT id, booking_id, amount, method, transaction_ref, status, paid_at, created_at
       FROM payments WHERE booking_id = ?
      ORDER BY created_at ASC, id ASC`,
    [bookingId]
  );
  return rows;
}

module.exports = {
  BOOKING_SELECT, findBooking, canViewBooking, findVisibleBooking, scopeFilter, getBookingPayments,
};
