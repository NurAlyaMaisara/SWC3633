// =====================================================================
// /users  -  user management (CRUD)
// Owner: Auth & Users Lead
// =====================================================================
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/response');
const { getPagination, getOrderBy, buildMeta, likePattern } = require('../utils/queryHelper');

const USER_COLUMNS = 'u.id, u.full_name, u.email, u.phone, u.role, u.status, u.created_at, u.updated_at';

const SORTABLE = {
  id: 'u.id',
  full_name: 'u.full_name',
  email: 'u.email',
  role: 'u.role',
  status: 'u.status',
  created_at: 'u.created_at',
};

const rounds = () => Number(process.env.BCRYPT_ROUNDS) || 10;

async function findUser(id) {
  const [rows] = await pool.query(`SELECT ${USER_COLUMNS} FROM users u WHERE u.id = ?`, [id]);
  if (!rows.length) throw ApiError.notFound(`User with id ${id} not found`);
  return rows[0];
}

async function assertEmailFree(email, excludeId = 0) {
  const [rows] = await pool.query('SELECT id FROM users WHERE email = ? AND id <> ?', [email, excludeId]);
  if (rows.length) throw ApiError.conflict('This email is already used by another account');
}

// Counts records that belong to this user. A table that is not created yet
// (e.g. bookings before that module is merged) simply counts as 0.
async function countOwned(id) {
  const count = async (sql) => {
    try {
      const [[row]] = await pool.query(sql, [id]);
      return row.total;
    } catch (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') return 0;
      throw err;
    }
  };
  return {
    events: await count('SELECT COUNT(*) AS total FROM events WHERE organiser_id = ?'),
    bookings: await count('SELECT COUNT(*) AS total FROM bookings WHERE customer_id = ?'),
  };
}

async function countActiveAdmins() {
  const [[{ total }]] = await pool.query(
    "SELECT COUNT(*) AS total FROM users WHERE role = 'admin' AND status = 'active'"
  );
  return total;
}

// GET /users?search=&role=&status=&sort=&order=&page=&limit=   (admin)
exports.listUsers = asyncHandler(async (req, res) => {
  const q = req.query;
  const where = [];
  const params = [];

  if (q.search) {
    const pattern = likePattern(q.search);
    where.push('(u.full_name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)');
    params.push(pattern, pattern, pattern);
  }
  if (q.role) {
    where.push('u.role = ?');
    params.push(q.role);
  }
  if (q.status) {
    where.push('u.status = ?');
    params.push(q.status);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const { page, limit, offset } = getPagination(q);
  const orderBy = getOrderBy(q, SORTABLE, 'id');

  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM users u ${whereSql}`, params);
  const [rows] = await pool.query(
    `SELECT ${USER_COLUMNS} FROM users u ${whereSql} ORDER BY ${orderBy}, u.id ASC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  sendSuccess(res, { message: 'Users retrieved successfully', data: rows, meta: buildMeta(page, limit, total) });
});

// GET /users/:id   (admin, or the user themself)
// Includes a small summary of what the user owns, useful for the admin UI.
exports.getUser = asyncHandler(async (req, res) => {
  const user = await findUser(req.params.id);
  const owned = await countOwned(user.id);
  sendSuccess(res, {
    message: 'User retrieved successfully',
    data: { ...user, summary: { events_owned: owned.events, bookings_made: owned.bookings } },
  });
});

// POST /users   (admin) - create an admin, organiser, staff or customer account
exports.createUser = asyncHandler(async (req, res) => {
  const { full_name, email, password, phone, role, status = 'active' } = req.body;
  await assertEmailFree(email);

  const hash = await bcrypt.hash(password, rounds());
  const [result] = await pool.query(
    'INSERT INTO users (full_name, email, password_hash, phone, role, status) VALUES (?, ?, ?, ?, ?, ?)',
    [full_name, email, hash, phone || null, role, status]
  );

  res.location(`/api/v1/users/${result.insertId}`);
  sendSuccess(res, { statusCode: 201, message: 'User created successfully', data: await findUser(result.insertId) });
});

// PUT /users/:id   (admin, or the user themself)
//  - Only an admin may change role or status.
//  - An admin cannot demote or deactivate themselves (avoids locking out the system).
exports.updateUser = asyncHandler(async (req, res) => {
  const id = req.params.id;
  const isAdmin = req.user.role === 'admin';
  const isSelf = Number(req.user.id) === id;
  const { full_name, email, phone, role, status } = req.body;

  const existing = await findUser(id);

  if (!isAdmin && (role !== undefined || status !== undefined)) {
    throw ApiError.forbidden('Only an administrator can change role or status');
  }
  if (isAdmin && isSelf && ((role !== undefined && role !== 'admin') || status === 'inactive')) {
    throw new ApiError(400, 'SELF_LOCKOUT', 'You cannot remove your own admin role or deactivate your own account');
  }
  if (email !== undefined) await assertEmailFree(email, id);

  const fields = {};
  if (full_name !== undefined) fields.full_name = full_name;
  if (email !== undefined) fields.email = email;
  if (phone !== undefined) fields.phone = phone || null;
  if (role !== undefined) fields.role = role;
  if (status !== undefined) fields.status = status;

  const keys = Object.keys(fields);
  await pool.query(
    `UPDATE users SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`,
    [...keys.map((k) => fields[k]), existing.id]
  );

  sendSuccess(res, { message: 'User updated successfully', data: await findUser(id) });
});

// DELETE /users/:id   (admin)
// Users who own events or have bookings cannot be deleted (the foreign keys
// use ON DELETE RESTRICT to protect history). Deactivate them instead with
// PUT /users/:id { "status": "inactive" }.
exports.deleteUser = asyncHandler(async (req, res) => {
  const id = req.params.id;
  if (Number(req.user.id) === id) {
    throw new ApiError(400, 'SELF_DELETE', 'You cannot delete your own account');
  }

  const user = await findUser(id);
  if (user.role === 'admin' && user.status === 'active' && (await countActiveAdmins()) <= 1) {
    throw new ApiError(400, 'LAST_ADMIN', 'Cannot delete the last active administrator');
  }

  const deps = await countOwned(id);
  if (deps.events > 0 || deps.bookings > 0) {
    throw ApiError.conflict(
      'This user owns events or has bookings and cannot be deleted. Deactivate the account instead (PUT status "inactive")',
      [{ events: deps.events, bookings: deps.bookings }]
    );
  }

  await pool.query('DELETE FROM users WHERE id = ?', [id]);
  sendSuccess(res, { message: 'User deleted successfully', data: { id } });
});
