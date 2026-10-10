// =====================================================================
// Validation rules for /auth and /users
// Owner: Auth & Users Lead
// =====================================================================
const { body, param, query } = require('express-validator');

const ROLES = ['admin', 'organiser', 'staff', 'customer'];
const STATUSES = ['active', 'inactive'];
const STRONG_PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,64}$/;
const PASSWORD_MESSAGE = 'password must be 8-64 characters with an uppercase letter, a lowercase letter, a number and a symbol';
const MY_PHONE = /^(\+?60|0)1\d{8,9}$/; // Malaysian mobile, e.g. 0123456789 or +60123456789

const idParam = [
  param('id').isInt({ min: 1 }).withMessage('id must be a positive integer').toInt(),
];

// Fields a client must never set directly
const forbidFields = (fields, message) =>
  body().custom((b) => {
    const sent = fields.filter((f) => b && Object.prototype.hasOwnProperty.call(b, f));
    if (sent.length) throw new Error(`${message}: ${sent.join(', ')}`);
    return true;
  });

const fullName = (required) => {
  const rule = body('full_name');
  return (required ? rule.exists({ values: 'falsy' }).withMessage('full_name is required').bail() : rule.optional())
    .isString().withMessage('full_name must be text').trim()
    .notEmpty().withMessage('full_name is required')
    .isLength({ min: 2, max: 100 }).withMessage('full_name must be 2-100 characters');
};

const email = (required) => {
  const rule = body('email');
  return (required ? rule.exists({ values: 'falsy' }).withMessage('email is required').bail() : rule.optional())
    .isString().withMessage('email must be text').trim()
    .notEmpty().withMessage('email is required')
    .isEmail().withMessage('email must be a valid email address')
    .isLength({ max: 150 }).withMessage('email must be at most 150 characters')
    .toLowerCase();
};

const password = (field = 'password') =>
  body(field)
    .isString().withMessage(`${field} is required`)
    .matches(STRONG_PASSWORD).withMessage(PASSWORD_MESSAGE.replace('password', field));

const phone = body('phone')
  .optional({ values: 'falsy' })
  .isString().withMessage('phone must be text').trim()
  .customSanitizer((v) => v.replace(/[\s-]/g, ''))
  .matches(MY_PHONE).withMessage('phone must be a valid Malaysian mobile number, e.g. 0123456789');

// ---------- /auth ----------
const register = [
  fullName(true),
  email(true),
  password(),
  phone,
  forbidFields(['role', 'status'], 'You cannot set these fields when registering'),
];

const login = [
  body('email').isString().withMessage('email is required').trim()
    .notEmpty().withMessage('email is required')
    .isEmail().withMessage('email must be a valid email address').toLowerCase(),
  body('password').isString().withMessage('password is required')
    .notEmpty().withMessage('password is required'),
];

const changePassword = [
  body('current_password').isString().withMessage('current_password is required')
    .notEmpty().withMessage('current_password is required'),
  password('new_password'),
  body('new_password').custom((value, { req }) => {
    if (value === req.body.current_password) throw new Error('new_password must be different from current_password');
    return true;
  }),
];

// ---------- /users ----------
const listUsers = [
  query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('limit must be between 1 and 50'),
  query('order').optional().isIn(['asc', 'desc']).withMessage("order must be 'asc' or 'desc'"),
  query('sort').optional().isIn(['id', 'full_name', 'email', 'role', 'status', 'created_at'])
    .withMessage('sort must be one of: id, full_name, email, role, status, created_at'),
  query('search').optional().isString().withMessage('search must be text').trim()
    .isLength({ max: 100 }).withMessage('search must be at most 100 characters'),
  query('role').optional().isIn(ROLES).withMessage(`role must be one of: ${ROLES.join(', ')}`),
  query('status').optional().isIn(STATUSES).withMessage("status must be 'active' or 'inactive'"),
];

const createUser = [
  fullName(true),
  email(true),
  password(),
  phone,
  body('role').exists({ values: 'falsy' }).withMessage('role is required').bail().isIn(ROLES).withMessage(`role must be one of: ${ROLES.join(', ')}`),
  body('status').optional().isIn(STATUSES).withMessage("status must be 'active' or 'inactive'"),
];

const updateUser = [
  ...idParam,
  fullName(false),
  email(false),
  phone,
  body('role').optional().isIn(ROLES).withMessage(`role must be one of: ${ROLES.join(', ')}`),
  body('status').optional().isIn(STATUSES).withMessage("status must be 'active' or 'inactive'"),
  forbidFields(['password', 'password_hash'], 'Use PUT /auth/password to change a password. Not allowed here'),
  body().custom((b) => {
    const editable = ['full_name', 'email', 'phone', 'role', 'status'];
    if (!b || !editable.some((f) => Object.prototype.hasOwnProperty.call(b, f))) {
      throw new Error(`Send at least one of: ${editable.join(', ')}`);
    }
    return true;
  }),
];

module.exports = { idParam, register, login, changePassword, listUsers, createUser, updateUser };
