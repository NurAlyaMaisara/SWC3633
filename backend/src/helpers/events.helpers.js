// Shared queries for events, used by both the events and schedules controllers
const pool = require('../config/db');
const ApiError = require('../utils/ApiError');
const { canManage } = require('../utils/permissions');

// next_start_time and min_price summarise the event's upcoming open schedules,
// so the customer app can show "From RM50 · 24 Oct" without extra requests.
const EVENT_SELECT = `
  SELECT e.id, e.title, e.description, e.image_url, e.status,
         e.category_id, c.name AS category_name,
         e.organiser_id, u.full_name AS organiser_name,
         (SELECT MIN(s.start_time) FROM schedules s
           WHERE s.event_id = e.id AND s.start_time >= NOW() AND s.status <> 'closed') AS next_start_time,
         (SELECT MIN(s.ticket_price) FROM schedules s
           WHERE s.event_id = e.id AND s.start_time >= NOW() AND s.status <> 'closed') AS min_price,
         e.created_at, e.updated_at
    FROM events e
    JOIN event_categories c ON c.id = e.category_id
    JOIN users u ON u.id = e.organiser_id`;

async function findEvent(id) {
  const [rows] = await pool.query(`${EVENT_SELECT} WHERE e.id = ?`, [id]);
  if (!rows.length) throw ApiError.notFound(`Event with id ${id} not found`);
  return rows[0];
}

// Published events are public; drafts/cancelled are visible only to the owner or an admin
function canViewEvent(user, event) {
  return event.status === 'published' || canManage(user, event.organiser_id);
}

// Returns 404 (not 403) for hidden events so their existence is not revealed
async function findVisibleEvent(id, user) {
  const event = await findEvent(id);
  if (!canViewEvent(user, event)) throw ApiError.notFound(`Event with id ${id} not found`);
  return event;
}

// includeAll = true for the owner/admin; the public only sees upcoming, non-closed schedules
async function getEventSchedules(eventId, includeAll) {
  const [rows] = await pool.query(
    `SELECT s.id, s.venue_id, v.name AS venue_name, v.city AS venue_city,
            s.start_time, s.end_time, s.ticket_price, s.total_tickets, s.available_tickets, s.status
       FROM schedules s
       JOIN venues v ON v.id = s.venue_id
      WHERE s.event_id = ?${includeAll ? '' : " AND s.status <> 'closed' AND s.start_time >= NOW()"}
      ORDER BY s.start_time ASC`,
    [eventId]
  );
  return rows;
}

module.exports = { EVENT_SELECT, findEvent, canViewEvent, findVisibleEvent, getEventSchedules };
