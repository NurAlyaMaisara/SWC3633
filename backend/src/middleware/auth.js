// =====================================================================
// TEMPORARY DEV STUB - the Auth & Users lead replaces this whole file
// with the real JWT / API key middleware.
//
// Agreed contract (keep these names so no route file has to change):
//   authenticate            -> requires a valid login, sets req.user = { id, role }
//   optionalAuthenticate    -> sets req.user if logged in, otherwise null
//   authorize(...roles)     -> 403 unless req.user.role is in roles
//   requireApiKey           -> 401 unless the x-api-key header is valid
//
// While the stub is active, "log in" by sending headers:
//   x-dev-user-id: 2
//   x-dev-role: organiser
// =====================================================================
const ApiError = require('../utils/ApiError');

if (process.env.NODE_ENV === 'production' || process.env.AUTH_STUB !== 'true') {
  throw new Error('Auth stub is disabled. Replace middleware/auth.js with the real JWT middleware.');
}

function readDevUser(req) {
  const id = parseInt(req.header('x-dev-user-id'), 10);
  const role = req.header('x-dev-role');
  if (!id || !['admin', 'organiser', 'staff', 'customer'].includes(role)) return null;
  return { id, role };
}

exports.authenticate = (req, res, next) => {
  const user = readDevUser(req);
  if (!user) return next(ApiError.unauthorized());
  req.user = user;
  next();
};

exports.optionalAuthenticate = (req, res, next) => {
  req.user = readDevUser(req);
  next();
};

exports.authorize = (...roles) => (req, res, next) => {
  if (!req.user) return next(ApiError.unauthorized());
  if (!roles.includes(req.user.role)) return next(ApiError.forbidden());
  next();
};

exports.requireApiKey = (req, res, next) => {
  if (req.header('x-api-key') !== process.env.API_KEY) {
    return next(ApiError.unauthorized('Invalid or missing API key'));
  }
  next();
};
