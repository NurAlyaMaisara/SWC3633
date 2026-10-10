// =====================================================================
// Authentication, role-based access control and API key middleware
// Owner: Auth & Users Lead
//
// Agreed contract (route files use these names; do not rename):
//   authenticate            -> requires a valid JWT, sets req.user = { id, role }
//   optionalAuthenticate    -> sets req.user if a valid JWT is sent, otherwise null
//   authorize(...roles)     -> 403 unless req.user.role is in roles
//   requireApiKey           -> 401 unless the x-api-key header is valid
//
// Extra helpers:
//   authorizeSelfOrAdmin()  -> admin, or the user whose id is in :id
//   signToken(user)         -> creates the JWT returned by /auth/login
//
// Clients log in with POST /api/v1/auth/login and then send
//   Authorization: Bearer <token>
// on every protected request.
// =====================================================================
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const ApiError = require('../utils/ApiError');

const ROLES = ['admin', 'organiser', 'staff', 'customer'];

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET is missing. Add it to backend/.env (see .env.example).');
}

function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
  });
}

// Returns the token from "Authorization: Bearer <token>", or null
function readBearerToken(req) {
  const [scheme, token] = (req.header('authorization') || '').split(' ');
  return scheme === 'Bearer' && token ? token : null;
}

// Verifies the JWT, then re-reads the user from the database so a
// deactivated or deleted account loses access immediately, even if its
// token has not expired yet. Throws ApiError on any problem.
async function verifyUser(token) {
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new ApiError(401, 'TOKEN_EXPIRED', 'Your session has expired. Please log in again');
    }
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid authentication token');
  }

  const [rows] = await pool.query(
    'SELECT id, role, status FROM users WHERE id = ?',
    [payload.sub]
  );
  const user = rows[0];
  if (!user) throw new ApiError(401, 'UNAUTHORIZED', 'The account for this token no longer exists');
  if (user.status !== 'active') throw new ApiError(403, 'ACCOUNT_INACTIVE', 'This account has been deactivated');

  return { id: user.id, role: user.role };
}

exports.authenticate = async (req, res, next) => {
  try {
    const token = readBearerToken(req);
    if (!token) throw ApiError.unauthorized('Authentication required. Send Authorization: Bearer <token>');
    req.user = await verifyUser(token);
    next();
  } catch (err) {
    next(err);
  }
};

// Public endpoints that show extra data to logged-in users. A missing,
// expired or invalid token simply means "guest" - it never blocks the request.
exports.optionalAuthenticate = async (req, res, next) => {
  req.user = null;
  const token = readBearerToken(req);
  if (!token) return next();
  try {
    req.user = await verifyUser(token);
  } catch {
    req.user = null;
  }
  next();
};

exports.authorize = (...roles) => (req, res, next) => {
  if (!req.user) return next(ApiError.unauthorized());
  if (!roles.includes(req.user.role)) {
    return next(ApiError.forbidden(`This action requires role: ${roles.join(' or ')}`));
  }
  next();
};

// Admin, or the logged-in user acting on their own record (/users/:id)
exports.authorizeSelfOrAdmin = (paramName = 'id') => (req, res, next) => {
  if (!req.user) return next(ApiError.unauthorized());
  if (req.user.role === 'admin' || Number(req.user.id) === Number(req.params[paramName])) return next();
  next(ApiError.forbidden('You can only access your own account'));
};

// Constant-time comparison so the key cannot be guessed from response timing
exports.requireApiKey = (req, res, next) => {
  const sent = Buffer.from(String(req.header('x-api-key') || ''));
  const expected = Buffer.from(String(process.env.API_KEY || ''));
  const valid = expected.length > 0 && sent.length === expected.length && crypto.timingSafeEqual(sent, expected);
  if (!valid) return next(ApiError.unauthorized('Invalid or missing API key'));
  next();
};

exports.signToken = signToken;
exports.ROLES = ROLES;
