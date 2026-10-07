const pool = require('../config/db');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const withTransaction = require('../utils/transaction');
const { sendSuccess } = require('../utils/response');
const { canManage } = require('../utils/permissions');
const { findEvent, findVisibleEvent, getEventSchedules } = require('../helpers/events.helpers');

const SCHEDULE_SELECT = `
  SELECT s.id, s.event_id, e.title AS event_title, e.status AS event_status, e.organiser_id,
         s.venue_id, v.name AS venue_name, v.city AS venue_city,
         s.start_time, s.end_time, s.ticket_price, s.total_tickets, s.available_tickets,
         (s.total_tickets - s.available_tickets) AS tickets_sold,
         s.status, s.created_at, s.updated_at
    FROM schedules s
    JOIN events e ON e.id = s.event_id
    JOIN venues v ON v.id = s.venue_id`;

async function findSchedule(id) {
  const [rows] = await pool.query(`${SCHEDULE_SELECT} WHERE s.id = ?`, [id]);
  if (!rows.length) throw ApiError.notFound(`Schedule with id ${id} not found`);
  return rows[0];
}

// Locks the venue row so two organisers cannot book the same slot at the same moment
async function lockVenue(conn, venueId) {
  const [rows] = await conn.query('SELECT id, name, capacity FROM venues WHERE id = ? FOR UPDATE', [venueId]);
  if (!rows.length) {
    throw ApiError.validation([{ field: 'venue_id', message: `Venue ${venueId} does not exist` }]);
  }
  return rows[0];
}

function assertWithinCapacity(totalTickets, venue) {
  if (totalTickets > venue.capacity) {
    throw ApiError.validation([
      { field: 'total_tickets', message: `total_tickets cannot exceed the venue capacity of ${venue.capacity}` },
    ]);
  }
}

// Business rule: two active schedules cannot overlap at the same venue
async function assertNoClash(conn, { venueId, start, end, excludeId = 0 }) {
  const [rows] = await conn.query(
    `SELECT s.id, e.title
       FROM schedules s
       JOIN events e ON e.id = s.event_id
      WHERE s.venue_id = ? AND s.id <> ?
        AND s.status <> 'closed' AND e.status <> 'cancelled'
        AND s.start_time < ? AND s.end_time > ?
      LIMIT 1`,
    [venueId, excludeId, end, start]
  );
  if (rows.length) {
    throw ApiError.conflict('The venue is already booked at this time', [
      { field: 'start_time', message: `Clashes with "${rows[0].title}" (schedule ${rows[0].id})` },
    ]);
  }
}

// GET /events/:id/schedules
exports.listEventSchedules = asyncHandler(async (req, res) => {
  const event = await findVisibleEvent(req.params.id, req.user);
  const schedules = await getEventSchedules(event.id, canManage(req.user, event.organiser_id));
  sendSuccess(res, { message: 'Schedules retrieved successfully', data: schedules });
});

// GET /schedules/:id
exports.getSchedule = asyncHandler(async (req, res) => {
  const schedule = await findSchedule(req.params.id);
  const isManager = canManage(req.user, schedule.organiser_id);
  if (schedule.event_status !== 'published' && !isManager) {
    throw ApiError.notFound(`Schedule with id ${schedule.id} not found`);
  }
  sendSuccess(res, { message: 'Schedule retrieved successfully', data: schedule });
});

// POST /events/:id/schedules
exports.createSchedule = asyncHandler(async (req, res) => {
  const event = await findEvent(req.params.id);
  if (!canManage(req.user, event.organiser_id)) {
    throw ApiError.forbidden('You can only add schedules to your own events');
  }
  if (event.status === 'cancelled') {
    throw ApiError.conflict('Schedules cannot be added to a cancelled event');
  }

  const { venue_id, ticket_price, total_tickets } = req.body;
  const start = new Date(req.body.start_time);
  const end = new Date(req.body.end_time);

  const scheduleId = await withTransaction(async (conn) => {
    const venue = await lockVenue(conn, venue_id);
    assertWithinCapacity(total_tickets, venue);
    await assertNoClash(conn, { venueId: venue_id, start, end });

    const [result] = await conn.query(
      `INSERT INTO schedules (event_id, venue_id, start_time, end_time, ticket_price, total_tickets, available_tickets)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [event.id, venue_id, start, end, ticket_price, total_tickets, total_tickets]
    );
    return result.insertId;
  });

  sendSuccess(res, {
    statusCode: 201,
    message: 'Schedule created successfully',
    data: await findSchedule(scheduleId),
  });
});

// PUT /schedules/:id
exports.updateSchedule = asyncHandler(async (req, res) => {
  const existing = await findSchedule(req.params.id);
  if (!canManage(req.user, existing.organiser_id)) {
    throw ApiError.forbidden('You can only update schedules of your own events');
  }
  if (existing.event_status === 'cancelled') {
    throw ApiError.conflict('Schedules of a cancelled event cannot be changed');
  }
  if (existing.start_time <= new Date()) {
    throw ApiError.conflict('Past or ongoing schedules cannot be changed');
  }

  const { venue_id, ticket_price, total_tickets, status } = req.body;
  const start = new Date(req.body.start_time);
  const end = new Date(req.body.end_time);

  await withTransaction(async (conn) => {
    const venue = await lockVenue(conn, venue_id);

    // Lock the schedule too, because bookings change available_tickets concurrently
    const [[current]] = await conn.query(
      'SELECT total_tickets, available_tickets FROM schedules WHERE id = ? FOR UPDATE',
      [existing.id]
    );
    const sold = current.total_tickets - current.available_tickets;

    assertWithinCapacity(total_tickets, venue);
    if (total_tickets < sold) {
      throw ApiError.conflict(`total_tickets cannot be lower than the ${sold} ticket(s) already sold`);
    }
    await assertNoClash(conn, { venueId: venue_id, start, end, excludeId: existing.id });

    const available = total_tickets - sold;
    let newStatus = available === 0 ? 'sold_out' : 'open';
    if (status === 'closed') newStatus = 'closed';

    await conn.query(
      `UPDATE schedules
          SET venue_id = ?, start_time = ?, end_time = ?, ticket_price = ?,
              total_tickets = ?, available_tickets = ?, status = ?
        WHERE id = ?`,
      [venue_id, start, end, ticket_price, total_tickets, available, newStatus, existing.id]
    );
  });

  sendSuccess(res, { message: 'Schedule updated successfully', data: await findSchedule(existing.id) });
});

// DELETE /schedules/:id  (only if no bookings exist; otherwise close it instead)
exports.deleteSchedule = asyncHandler(async (req, res) => {
  const schedule = await findSchedule(req.params.id);
  if (!canManage(req.user, schedule.organiser_id)) {
    throw ApiError.forbidden('You can only delete schedules of your own events');
  }

  try {
    await pool.query('DELETE FROM schedules WHERE id = ?', [schedule.id]);
  } catch (err) {
    if (err.code === 'ER_ROW_IS_REFERENCED_2') {
      throw ApiError.conflict('This schedule already has bookings, so it cannot be deleted. Close it instead.');
    }
    throw err;
  }

  sendSuccess(res, { message: 'Schedule deleted successfully', data: { id: schedule.id } });
});
