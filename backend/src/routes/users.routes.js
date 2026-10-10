const router = require('express').Router();
const c = require('../controllers/users.controller');
const v = require('../validators/users.validators');
const validate = require('../middleware/validate');
const { authenticate, authorize, authorizeSelfOrAdmin } = require('../middleware/auth');

router.get('/', authenticate, authorize('admin'), validate(v.listUsers), c.listUsers);
router.post('/', authenticate, authorize('admin'), validate(v.createUser), c.createUser);
router.get('/:id', authenticate, validate(v.idParam), authorizeSelfOrAdmin(), c.getUser);
router.put('/:id', authenticate, validate(v.updateUser), authorizeSelfOrAdmin(), c.updateUser);
router.delete('/:id', authenticate, authorize('admin'), validate(v.idParam), c.deleteUser);

module.exports = router;
