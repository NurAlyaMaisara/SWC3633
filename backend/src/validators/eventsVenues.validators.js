const { body, param, query } = require('express-validator');

const idParam = [
  param('id').isInt({ min: 1 }).withMessage('id must be a positive integer').toInt(),
];

const pagingRules = [
  query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('limit must be between 1 and 50'),
  query('order').optional().isIn(['asc', 'desc']).withMessage("order must be 'asc' or 'desc'"),
  query('search').optional().isString().withMessage('search must be text').trim()
    .isLength({ max: 100 }).withMessage('search must be at most 100 characters'),
];

// ---------- Categories ----------
const categoryBody = [
  body('name').isString().withMessage('name must be text').trim()
    .notEmpty().withMessage('name is required')
    .isLength({ max: 50 }).withMessage('name must be at most 50 characters'),
  body('description').optional({ values: 'null' }).isString().withMessage('description must be text').trim()
    .isLength({ max: 255 }).withMessage('description must be at most 255 characters'),
];

// ---------- Venues ----------
const venueBody = [
  body('name').isString().withMessage('name must be text').trim()
    .notEmpty().withMessage('name is required')
    .isLength({ max: 150 }).withMessage('name must be at most 150 characters'),
  body('address').isString().withMessage('address must be text').trim()
    .notEmpty().withMessage('address is required')
    .isLength({ max: 255 }).withMessage('address must be at most 255 characters'),
  body('city').isString().withMessage('city must be text').trim()
    .notEmpty().withMessage('city is required')
    .isLength({ max: 100 }).withMessage('city must be at most 100 characters'),
  body('state').isString().withMessage('state must be text').trim()
    .notEmpty().withMessage('state is required')
    .isLength({ max: 100 }).withMessage('state must be at most 100 characters'),
  body('capacity').isInt({ min: 1, max: 200000 }).withMessage('capacity must be a whole number from 1 to 200000').toInt(),
  body('facilities').optional({ values: 'null' }).isString().withMessage('facilities must be text').trim()
    .isLength({ max: 1000 }).withMessage('facilities must be at most 1000 characters'),
];

const listVenues = [
  ...pagingRules,
  query('sort').optional().isIn(['name', 'city', 'capacity', 'created_at'])
    .withMessage('sort must be one of: name, city, capacity, created_at'),
  query('city').optional().isString().withMessage('city must be text').trim(),
  query('state').optional().isString().withMessage('state must be text').trim(),
  query('min_capacity').optional().isInt({ min: 1 }).withMessage('min_capacity must be a positive integer').toInt(),
];

// ---------- Events ----------
const eventBody = [
  body('title').isString().withMessage('title must be text').trim()
    .notEmpty().withMessage('title is required')
    .isLength({ max: 150 }).withMessage('title must be at most 150 characters'),
  body('description').optional({ values: 'null' }).isString().withMessage('description must be text').trim()
    .isLength({ max: 5000 }).withMessage('description must be at most 5000 characters'),
  body('category_id').isInt({ min: 1 }).withMessage('category_id must be a positive integer').toInt(),
  body('image_url').optional({ values: 'falsy' })
    .isURL({ protocols: ['http', 'https'], require_protocol: true })
    .withMessage('image_url must be a valid http(s) URL'),
];

const eventStatusBody = [
  body('status').isIn(['draft', 'published', 'cancelled'])
    .withMessage("status must be 'draft', 'published' or 'cancelled'"),
];

const listEvents = [
  ...pagingRules,
  query('sort').optional().isIn(['title', 'created_at', 'next_start_time', 'min_price'])
    .withMessage('sort must be one of: title, created_at, next_start_time, min_price'),
  query('category_id').optional().isInt({ min: 1 }).withMessage('category_id must be a positive integer').toInt(),
  query('venue_id').optional().isInt({ min: 1 }).withMessage('venue_id must be a positive integer').toInt(),
  query('organiser_id').optional().isInt({ min: 1 }).withMessage('organiser_id must be a positive integer').toInt(),
  query('city').optional().isString().withMessage('city must be text').trim(),
  query('status').optional().isIn(['draft', 'published', 'cancelled'])
    .withMessage("status must be 'draft', 'published' or 'cancelled'"),
  query('date_from').optional().isISO8601().withMessage('date_from must be a valid date (YYYY-MM-DD)'),
  query('date_to').optional().isISO8601().withMessage('date_to must be a valid date (YYYY-MM-DD)'),
  query('mine').optional().isBoolean().withMessage('mine must be true or false').toBoolean(),
];

// ---------- Schedules ----------
const scheduleBody = [
  body('venue_id').isInt({ min: 1 }).withMessage('venue_id must be a positive integer').toInt(),
  body('start_time').isISO8601().withMessage('start_time must be a valid ISO 8601 date-time').bail()
    .custom((value) => {
      if (new Date(value) <= new Date()) throw new Error('start_time must be in the future');
      return true;
    }),
  body('end_time').isISO8601().withMessage('end_time must be a valid ISO 8601 date-time').bail()
    .custom((value, { req }) => {
      if (new Date(value) <= new Date(req.body.start_time)) throw new Error('end_time must be after start_time');
      return true;
    }),
  body('ticket_price').isFloat({ min: 0, max: 100000 }).withMessage('ticket_price must be between 0 and 100000').toFloat(),
  body('total_tickets').isInt({ min: 1, max: 200000 }).withMessage('total_tickets must be a whole number from 1 to 200000').toInt(),
  body('status').optional().isIn(['open', 'closed']).withMessage("status must be 'open' or 'closed'"),
];

module.exports = {
  idParam,
  categoryBody,
  venueBody,
  listVenues,
  eventBody,
  eventStatusBody,
  listEvents,
  scheduleBody,
};
