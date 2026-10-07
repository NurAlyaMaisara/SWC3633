// =====================================================================
// Central error handler (starter version). The Integration & API Management
// lead owns this file and may extend it (logging, etc.). Every error in the
// API ends up here, so all endpoints return the same JSON error format.
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
  }

  // Full details stay in the server log; the client never sees stack traces
  if (statusCode === 500) console.error(err);

  const body = { success: false, message, error: { code } };
  if (details) body.error.details = details;
  res.status(statusCode).json(body);
};
