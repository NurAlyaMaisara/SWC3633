const router = require('express').Router();
const c = require('../controllers/categories.controller');
const v = require('../validators/eventsVenues.validators');
const validate = require('../middleware/validate');
const { authenticate, authorize, requireApiKey } = require('../middleware/auth');

router.get('/', requireApiKey, c.listCategories);
router.get('/:id', requireApiKey, validate(v.idParam), c.getCategory);
router.post('/', authenticate, authorize('admin'), validate(v.categoryBody), c.createCategory);
router.put('/:id', authenticate, authorize('admin'), validate([...v.idParam, ...v.categoryBody]), c.updateCategory);
router.delete('/:id', authenticate, authorize('admin'), validate(v.idParam), c.deleteCategory);

module.exports = router;
