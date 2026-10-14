// =====================================================================
// Express application setup (Integration & API Management Lead)
// Middleware chain order is important:
//   1. requestLogger   - log every request first
//   2. rateLimiter     - limit abusive clients before any DB work
//   3. cors            - allow frontends from allowed origins
//   4. express.json    - parse JSON bodies
//   5. health + routes - real endpoints
//   6. 404 handler     - unknown routes
//   7. errorHandler    - central error formatter
// =====================================================================
const express = require('express');
const cors = require('cors');
const routes = require('./routes');
const requestLogger = require('./middleware/requestLogger');
const rateLimiter = require('./middleware/rateLimiter');
const errorHandler = require('./middleware/errorHandler');
const ApiError = require('./utils/ApiError');

const app = express();

app.disable('x-powered-by'); // don't advertise the framework

// 1. Log every request (morgan)
app.use(requestLogger);

// 2. Rate limit before touching the database
app.use(rateLimiter);

// 3. CORS
app.use(
  cors({
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*',
  })
);

// 4. JSON body parser
app.use(express.json({ limit: '100kb' }));

// 5. Health check (no API key needed)
app.get('/api/v1/health', (req, res) => {
  res.json({
    success: true,
    message: 'API is running',
    data: { time: new Date().toISOString() },
  });
});

// 6. All other routes
app.use('/api/v1', routes);

// 7. Unknown route -> 404 in the standard error format
app.use((req, res, next) => {
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
});

// 8. Central error handler (last)
app.use(errorHandler);

module.exports = app;