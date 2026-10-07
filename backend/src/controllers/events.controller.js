const pool = require('../config/db');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const withTransaction = require('../utils/transaction');
const { sendSuccess } = require('../utils/response');
const { canManage } = require('../utils/permissions');
const { getPagination, getOrderBy, buildMeta, likePattern, toDate } = require('../utils/queryHelper');
const { EVENT_SELECT, findEvent, findVisibleEvent, getEventSchedules } = require('../helpers/events.helpers');

// Events with no upcoming schedule (NULL) are listed last
const SORTABLE = {
  title: 'e.title',
  created_at: 'e.created_at',
  next_start_time: 'next_start_time IS NULL, next_start_time',
  min_price: 'min_price IS NULL, min_price',
};

// Which status changes are allowed (draft -> published -> cancelled)
const ALLOWED_TRANSITIONS = {
  draft: ['published', 'cancelled'],
  published: ['cancelled'],
  cancelled: [],
};

async function assertCategoryExists(categoryId) {
  const [rows] = await pool.query('SELECT id FROM event_categories WHERE id = ?', [categoryId]);
  if (!rows.length) {
    throw ApiError.validation([{ field: 'category_id', message: `Category ${categoryId} does not exist` }]);
  }
}

// GET /events?search=&category_id=&venue_id=&city=&date_from=&date_to=&status=&mine=&sort=&order=&page=&limit=
exports.listEvents = asyncHandler(async (req, res) => {
  const q = req.query;
  const user = req.user;
  const where = [];
  const params = [];

  // Visibility: the public sees published events; organisers see their own with ?mine=true; admins see all
  if (q.mine === true) {
    if (!user) throw ApiError.unauthorized('Log in to view your own events');
    where.push('e.organiser_id = ?');
    params.push(user.id);
    if (q.status) {
      where.push('e.status = ?');
      params.push(q.status);
    }
  } else if (user && user.role === 'admin') {
    if (q.status) {
      where.push('e.status = ?');
      params.push(q.status);
    }
  } else {
    where.push("e.status = 'published'");
  }

  if (q.organiser_id && q.mine !== true) {
    where.push('e.organiser_id = ?');
    params.push(q.organiser_id);
  }
  if (q.category_id) {
    where.push('e.category_id = ?');
    params.push(q.category_id);
  }
  if (q.search) {
    const pattern = likePattern(q.search);
    where.push('(e.title LIKE ? OR e.description LIKE ?)');
    params.push(pattern, pattern);
  }

  // Venue, city and date filters must all match the SAME schedule, so they share one EXISTS
  const scheduleConds = [];
  const scheduleParams = [];
  if (q.venue_id) {
    scheduleConds.push('s.venue_id = ?');
    scheduleParams.push(q.venue_id);
  }
  if (q.city) {
    scheduleConds.push('v.city = ?');
    scheduleParams.push(q.city);
  }
  if (q.date_from) {
    scheduleConds.push('s.start_time >= ?');
    scheduleParams.push(toDate(q.date_from));
  }
  if (q.date_to) {
    scheduleConds.push('s.start_time <= ?');
    scheduleParams.push(toDate(q.date_to, true));
  }
  if (scheduleConds.length) {
    where.push(
      `EXISTS (SELECT 1 FROM schedules s JOIN venues v ON v.id = s.venue_id
                WHERE s.event_id = e.id AND ${scheduleConds.join(' AND ')})`
    );
    params.push(...scheduleParams);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const { page, limit, offset } = getPagination(q);
  const orderBy = getOrderBy(q, SORTABLE, 'next_start_time');

  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM events e ${whereSql}`, params);
  const [rows] = await pool.query(
    `${EVENT_SELECT} ${whereSql} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  sendSuccess(res, {
    message: 'Events retrieved successfully',
    data: rows,
    meta: buildMeta(page, limit, total),
  });
});

// GET /events/:id  (includes schedules)
exports.getEvent = asyncHandler(async (req, res) => {
  const event = await findVisibleEvent(req.params.id, req.user);
  const schedules = await getEventSchedules(event.id, canManage(req.user, event.organiser_id));
  sendSuccess(res, { message: 'Event retrieved successfully', data: { ...event, schedules } });
});

// POST /events  (always created as draft; publish later with PATCH)
exports.createEvent = asyncHandler(async (req, res) => {
  const { title, description = null, category_id, image_url } = req.body;
  await assertCategoryExists(category_id);

  const [result] = await pool.query(
    `INSERT INTO events (organiser_id, category_id, title, description, image_url)
     VALUES (?, ?, ?, ?, ?)`,
    [req.user.id, category_id, title, description, image_url || null]
  );

  const event = await findEvent(result.insertId);
  sendSuccess(res, { statusCode: 201, message: 'Event created as draft', data: event });
});

// PUT /events/:id  (replace editable details)
exports.updateEvent = asyncHandler(async (req, res) => {
  const event = await findEvent(req.params.id);
  if (!canManage(req.user, event.organiser_id)) {
    throw ApiError.forbidden('You can only update your own events');
  }
  if (event.status === 'cancelled') {
    throw ApiError.conflict('Cancelled events cannot be edited');
  }

  const { title, description = null, category_id, image_url } = req.body;
  await assertCategoryExists(category_id);

  await pool.query(
    'UPDATE events SET title = ?, description = ?, category_id = ?, image_url = ? WHERE id = ?',
    [title, description, category_id, image_url || null, event.id]
  );

  sendSuccess(res, { message: 'Event updated successfully', data: await findEvent(event.id) });
});

// PATCH /events/:id  { "status": "published" | "cancelled" }
exports.updateEventStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const event = await findEvent(req.params.id);
  if (!canManage(req.user, event.organiser_id)) {
    throw ApiError.forbidden('You can only change the status of your own events');
  }
  if (event.status === status) {
    throw ApiError.conflict(`Event is already ${status}`);
  }
  if (!ALLOWED_TRANSITIONS[event.status].includes(status)) {
    throw ApiError.conflict(`Event status cannot change from ${event.status} to ${status}`);
  }

  // Business rule: an event needs at least one upcoming schedule before customers can see it
  if (status === 'published') {
    const [[{ upcoming }]] = await pool.query(
      `SELECT COUNT(*) AS upcoming FROM schedules
        WHERE event_id = ? AND start_time >= NOW() AND status <> 'closed'`,
      [event.id]
    );
    if (!upcoming) {
      throw ApiError.conflict('Add at least one upcoming schedule before publishing this event');
    }
  }

  await withTransaction(async (conn) => {
    await conn.query('UPDATE events SET status = ? WHERE id = ?', [status, event.id]);
    // Cancelling an event closes all its schedules so no new bookings can be made
    if (status === 'cancelled') {
      await conn.query("UPDATE schedules SET status = 'closed' WHERE event_id = ?", [event.id]);
    }
  });

  sendSuccess(res, { message: `Event ${status} successfully`, data: await findEvent(event.id) });
});

// DELETE /events/:id  (only if no bookings exist; otherwise cancel it instead)
exports.deleteEvent = asyncHandler(async (req, res) => {
  const event = await findEvent(req.params.id);
  if (!canManage(req.user, event.organiser_id)) {
    throw ApiError.forbidden('You can only delete your own events');
  }

  try {
    // Schedules are removed by ON DELETE CASCADE; bookings block the delete (RESTRICT)
    await pool.query('DELETE FROM events WHERE id = ?', [event.id]);
  } catch (err) {
    if (err.code === 'ER_ROW_IS_REFERENCED_2') {
      throw ApiError.conflict('This event already has bookings, so it cannot be deleted. Cancel it instead.');
    }
    throw err;
  }

  sendSuccess(res, { message: 'Event deleted successfully', data: { id: event.id } });
});
