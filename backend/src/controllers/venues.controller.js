const pool = require('../config/db');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/response');
const { canManage } = require('../utils/permissions');
const { getPagination, getOrderBy, buildMeta, likePattern } = require('../utils/queryHelper');

const VENUE_COLUMNS =
  'v.id, v.name, v.address, v.city, v.state, v.capacity, v.facilities, v.created_by, v.created_at, v.updated_at';

const SORTABLE = { name: 'v.name', city: 'v.city', capacity: 'v.capacity', created_at: 'v.created_at' };

async function findVenue(id) {
  const [rows] = await pool.query(`SELECT ${VENUE_COLUMNS} FROM venues v WHERE v.id = ?`, [id]);
  if (!rows.length) throw ApiError.notFound(`Venue with id ${id} not found`);
  return rows[0];
}

async function assertUniqueName(name, city, excludeId = 0) {
  const [rows] = await pool.query(
    'SELECT id FROM venues WHERE name = ? AND city = ? AND id <> ?',
    [name, city, excludeId]
  );
  if (rows.length) throw ApiError.conflict(`A venue named "${name}" already exists in ${city}`);
}

// GET /venues?search=&city=&state=&min_capacity=&sort=&order=&page=&limit=
exports.listVenues = asyncHandler(async (req, res) => {
  const q = req.query;
  const where = [];
  const params = [];

  if (q.search) {
    const pattern = likePattern(q.search);
    where.push('(v.name LIKE ? OR v.address LIKE ? OR v.city LIKE ?)');
    params.push(pattern, pattern, pattern);
  }
  if (q.city) {
    where.push('v.city = ?');
    params.push(q.city);
  }
  if (q.state) {
    where.push('v.state = ?');
    params.push(q.state);
  }
  if (q.min_capacity) {
    where.push('v.capacity >= ?');
    params.push(q.min_capacity);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const { page, limit, offset } = getPagination(q);
  const orderBy = getOrderBy(q, SORTABLE, 'name');

  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM venues v ${whereSql}`, params);
  const [rows] = await pool.query(
    `SELECT ${VENUE_COLUMNS} FROM venues v ${whereSql} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  sendSuccess(res, {
    message: 'Venues retrieved successfully',
    data: rows,
    meta: buildMeta(page, limit, total),
  });
});

// GET /venues/:id  (includes the venue's upcoming published schedules)
exports.getVenue = asyncHandler(async (req, res) => {
  const venue = await findVenue(req.params.id);
  const [schedules] = await pool.query(
    `SELECT s.id, s.event_id, e.title AS event_title, s.start_time, s.end_time, s.status
       FROM schedules s
       JOIN events e ON e.id = s.event_id
      WHERE s.venue_id = ? AND s.start_time >= NOW() AND e.status = 'published'
      ORDER BY s.start_time ASC`,
    [venue.id]
  );
  sendSuccess(res, {
    message: 'Venue retrieved successfully',
    data: { ...venue, upcoming_schedules: schedules },
  });
});

// POST /venues
exports.createVenue = asyncHandler(async (req, res) => {
  const { name, address, city, state, capacity, facilities = null } = req.body;
  await assertUniqueName(name, city);

  const [result] = await pool.query(
    `INSERT INTO venues (name, address, city, state, capacity, facilities, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [name, address, city, state, capacity, facilities, req.user.id]
  );

  const venue = await findVenue(result.insertId);
  sendSuccess(res, { statusCode: 201, message: 'Venue created successfully', data: venue });
});

// PUT /venues/:id
exports.updateVenue = asyncHandler(async (req, res) => {
  const venue = await findVenue(req.params.id);
  if (!canManage(req.user, venue.created_by)) {
    throw ApiError.forbidden('You can only update venues you created');
  }

  const { name, address, city, state, capacity, facilities = null } = req.body;
  await assertUniqueName(name, city, venue.id);

  // Business rule: capacity cannot drop below tickets already planned for an upcoming schedule here
  const [[{ max_tickets }]] = await pool.query(
    `SELECT COALESCE(MAX(total_tickets), 0) AS max_tickets
       FROM schedules
      WHERE venue_id = ? AND start_time >= NOW() AND status <> 'closed'`,
    [venue.id]
  );
  if (capacity < max_tickets) {
    throw ApiError.conflict(
      `Capacity cannot be lower than ${max_tickets}, the ticket count of an upcoming schedule at this venue`
    );
  }

  await pool.query(
    `UPDATE venues SET name = ?, address = ?, city = ?, state = ?, capacity = ?, facilities = ?
      WHERE id = ?`,
    [name, address, city, state, capacity, facilities, venue.id]
  );

  sendSuccess(res, { message: 'Venue updated successfully', data: await findVenue(venue.id) });
});

// DELETE /venues/:id  (admin only)
exports.deleteVenue = asyncHandler(async (req, res) => {
  const venue = await findVenue(req.params.id);

  // Business rule: keep history intact - a venue with schedules cannot be deleted
  const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM schedules WHERE venue_id = ?', [venue.id]);
  if (total > 0) {
    throw ApiError.conflict(`Venue cannot be deleted because it has ${total} schedule(s)`);
  }

  await pool.query('DELETE FROM venues WHERE id = ?', [venue.id]);
  sendSuccess(res, { message: 'Venue deleted successfully', data: { id: venue.id } });
});
