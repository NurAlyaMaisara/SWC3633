const router = require('express').Router();
const events = require('../controllers/events.controller');
const schedules = require('../controllers/schedules.controller');
const v = require('../validators/eventsVenues.validators');
const validate = require('../middleware/validate');
const { authenticate, optionalAuthenticate, authorize, requireApiKey } = require('../middleware/auth');

const manager = [authenticate, authorize('admin', 'organiser')];

router.get('/', requireApiKey, optionalAuthenticate, validate(v.listEvents), events.listEvents);
router.get('/:id', requireApiKey, optionalAuthenticate, validate(v.idParam), events.getEvent);
router.post('/', ...manager, validate(v.eventBody), events.createEvent);
router.put('/:id', ...manager, validate([...v.idParam, ...v.eventBody]), events.updateEvent);
router.patch('/:id', ...manager, validate([...v.idParam, ...v.eventStatusBody]), events.updateEventStatus);
router.delete('/:id', ...manager, validate(v.idParam), events.deleteEvent);

// Nested: schedules belonging to an event
router.get('/:id/schedules', requireApiKey, optionalAuthenticate, validate(v.idParam), schedules.listEventSchedules);
router.post('/:id/schedules', ...manager, validate([...v.idParam, ...v.scheduleBody]), schedules.createSchedule);

module.exports = router;
