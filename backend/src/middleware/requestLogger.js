// =====================================================================
// Request logging middleware (Integration & API Management Lead)
// Uses morgan to log every HTTP request with method, URL, status,
// response time and client IP. Helps debugging and shows API usage.
//
// In production, logs go to stdout (and can be piped to a file or a
// log service). In development, use the colourful "dev" format.
// =====================================================================
const morgan = require('morgan');

// Custom token: real client IP (behind a proxy if X-Forwarded-For is set)
morgan.token('client-ip', (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.ip || req.connection?.remoteAddress || '-';
});

// Custom token: authenticated user id (set by authenticate middleware)
morgan.token('user-id', (req) => (req.user ? req.user.id : 'guest'));

const format =
  ':client-ip :user-id :method :url :status :res[content-length] - :response-time ms';

const requestLogger =
  process.env.NODE_ENV === 'production'
    ? morgan(format)
    : morgan('dev'); // coloured, short format for development

module.exports = requestLogger;