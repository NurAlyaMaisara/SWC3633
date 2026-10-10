// =====================================================================
// /auth  -  register, login, current user, change password
// Owner: Auth & Users Lead
// =====================================================================
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/response');
const { signToken } = require('../middleware/auth');

const USER_COLUMNS = 'id, full_name, email, phone, role, status, created_at, updated_at';
const rounds = () => Number(process.env.BCRYPT_ROUNDS) || 10;

// Compared against when the email does not exist, so a wrong email and a
// wrong password take the same time (stops attackers finding valid emails).
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', 10);

async function findUser(id) {
  const [rows] = await pool.query(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`, [id]);
  return rows[0] || null;
}

function loginPayload(user) {
  return {
    token: signToken(user),
    token_type: 'Bearer',
    expires_in: process.env.JWT_EXPIRES_IN || '1h',
    user,
  };
}

// POST /auth/register  - public sign-up, always creates a customer
exports.register = asyncHandler(async (req, res) => {
  const { full_name, email, password, phone } = req.body;

  const [taken] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
  if (taken.length) throw ApiError.conflict('This email is already registered');

  const hash = await bcrypt.hash(password, rounds());
  const [result] = await pool.query(
    "INSERT INTO users (full_name, email, password_hash, phone, role) VALUES (?, ?, ?, ?, 'customer')",
    [full_name, email, hash, phone || null]
  );

  const user = await findUser(result.insertId);
  sendSuccess(res, { statusCode: 201, message: 'Registration successful', data: loginPayload(user) });
});

// POST /auth/login
exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const [rows] = await pool.query(`SELECT ${USER_COLUMNS}, password_hash FROM users WHERE email = ?`, [email]);
  const found = rows[0];
  const passwordOk = await bcrypt.compare(password, found ? found.password_hash : DUMMY_HASH);

  // Same message for "no such email" and "wrong password"
  if (!found || !passwordOk) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');
  }
  if (found.status !== 'active') {
    throw new ApiError(403, 'ACCOUNT_INACTIVE', 'This account has been deactivated. Please contact the administrator');
  }

  const { password_hash, ...user } = found; // never send the hash
  sendSuccess(res, { message: 'Login successful', data: loginPayload(user) });
});

// GET /auth/me  - profile of the logged-in user
exports.me = asyncHandler(async (req, res) => {
  const user = await findUser(req.user.id);
  sendSuccess(res, { message: 'Profile retrieved successfully', data: user });
});

// PUT /auth/password  - logged-in user changes their own password
exports.changePassword = asyncHandler(async (req, res) => {
  const { current_password, new_password } = req.body;

  const [[row]] = await pool.query('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
  if (!(await bcrypt.compare(current_password, row.password_hash))) {
    throw new ApiError(400, 'WRONG_PASSWORD', 'current_password is incorrect');
  }

  const hash = await bcrypt.hash(new_password, rounds());
  await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.user.id]);
  sendSuccess(res, { message: 'Password changed successfully' });
});
