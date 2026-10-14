// =====================================================================
// Rate limiting middleware (Integration & API Management Lead)
// Protects the API from abuse: each IP may send a limited number of
// requests per window. Exceeding the limit returns HTTP 429 with the
// standard JSON error format.
// =====================================================================
const rateLimit = require('express-rate-limit');

const WINDOW_MINUTES = 15;
const MAX_REQUESTS = 100;

const rateLimiter = rateLimit({
  windowMs: WINDOW_MINUTES * 60 * 1000,   // 15 minutes
  max: MAX_REQUESTS,                       // 100 requests per IP
  standardHeaders: true,                   // send RateLimit-* headers
  legacyHeaders: false,                    // disable X-RateLimit-* headers
  // Use the standard error format used by the rest of the API
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Too many requests. Please try again later.',
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        details: [
          { field: 'rate_limit', message: `Maximum ${MAX_REQUESTS} requests per ${WINDOW_MINUTES} minutes` },
        ],
      },
    });
  },
});

module.exports = rateLimiter;