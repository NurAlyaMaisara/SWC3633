const express = require('express');
const cors = require('cors');
const routes = require('./routes');
const errorHandler = require('./middleware/errorHandler');
const ApiError = require('./utils/ApiError');

const app = express();

app.disable('x-powered-by'); // don't advertise the framework
app.use(cors({ origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*' }));
app.use(express.json({ limit: '100kb' }));

app.get('/api/v1/health', (req, res) => {
  res.json({ success: true, message: 'API is running', data: { time: new Date().toISOString() } });
});

app.use('/api/v1', routes);

// Unknown route -> 404 in the standard error format
app.use((req, res, next) => {
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
});

app.use(errorHandler);

module.exports = app;
