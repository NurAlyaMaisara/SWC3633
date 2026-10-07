const router = require('express').Router();
const c = require('../controllers/venues.controller');
const v = require('../validators/eventsVenues.validators');
const validate = require('../middleware/validate');
const { authenticate, authorize, requireApiKey } = require('../middleware/auth');

router.get('/', requireApiKey, validate(v.listVenues), c.listVenues);
router.get('/:id', requireApiKey, validate(v.idParam), c.getVenue);
router.post('/', authenticate, authorize('admin', 'organiser'), validate(v.venueBody), c.createVenue);
router.put('/:id', authenticate, authorize('admin', 'organiser'), validate([...v.idParam, ...v.venueBody]), c.updateVenue);
router.delete('/:id', authenticate, authorize('admin'), validate(v.idParam), c.deleteVenue);

module.exports = router;
