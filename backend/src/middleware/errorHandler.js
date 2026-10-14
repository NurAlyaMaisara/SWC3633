// =====================================================================
// Central error handler (Integration & API Management Lead).
// Every error in the API ends up here, so all endpoints return the
// same JSON error format:
//   { success: false, message, error: { code, details? } }
//
// Handles:
//   - ApiError thrown by controllers/services
//   - Invalid JSON body (express.json parse error)
//   - MySQL constraint errors (duplicate, FK, check)
//   - Rate-limit 429 from express-rate-limit
//   - Anything else -> 500 Internal Server Error (stack kept in logs only)
// =====================================================================
const ApiError = require('../utils/ApiError');

// Database errors that are really client mistakes, not server crashes
const MYSQL_ERRORS = {
  ER_DUP_ENTRY: [409, 'CONFLICT', 'A record with the same unique value already exists'],
  ER_ROW_IS_REFERENCED_2: [409, 'CONFLICT', 'This record is still used by other records'],
  ER_NO_REFERENCED_ROW_2: [422, 'VALIDATION_ERROR', 'A referenced record does not exist'],
  ER_CHECK_CONSTRAINT_VIOLATED: [422, 'VALIDATION_ERROR', 'The data violates a database rule'],
};

// eslint-disable-next-line no-unused-vars
module.exports = (err, req, res, next) => {
  let statusCode = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'Something went wrong on the server';
  let details;

  if (err instanceof ApiError) {
    ({ statusCode, code, message, details } = err);
  } else if (err.type === 'entity.parse.failed') {
    statusCode = 400;
    code = 'BAD_REQUEST';
    message = 'Request body contains invalid JSON';
  } else if (MYSQL_ERRORS[err.code]) {
    [statusCode, code, message] = MYSQL_ERRORS[err.code];
  } else if (err.status === 429 || err.statusCode === 429) {
    statusCode = 429;
    code = 'RATE_LIMIT_EXCEEDED';
    message = err.message || 'Too many requests. Please try again later.';
  }

  // Full details stay in the server log; the client never sees stack traces
  if (statusCode === 500) console.error(err);

  const body = { success: false, message, error: { code } };
  if (details) body.error.details = details;
  res.status(statusCode).json(body);
};