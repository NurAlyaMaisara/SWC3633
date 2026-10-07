const router = require('express').Router();
const c = require('../controllers/schedules.controller');
const v = require('../validators/eventsVenues.validators');
const validate = require('../middleware/validate');
const { authenticate, optionalAuthenticate, authorize, requireApiKey } = require('../middleware/auth');

router.get('/:id', requireApiKey, optionalAuthenticate, validate(v.idParam), c.getSchedule);
router.put('/:id', authenticate, authorize('admin', 'organiser'), validate([...v.idParam, ...v.scheduleBody]), c.updateSchedule);
router.delete('/:id', authenticate, authorize('admin', 'organiser'), validate(v.idParam), c.deleteSchedule);

module.exports = router;
