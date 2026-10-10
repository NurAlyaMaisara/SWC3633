const router = require('express').Router();
const c = require('../controllers/auth.controller');
const v = require('../validators/users.validators');
const validate = require('../middleware/validate');
const { authenticate, requireApiKey } = require('../middleware/auth');

// Public: only our client apps (x-api-key) may register or log in
router.post('/register', requireApiKey, validate(v.register), c.register);
router.post('/login', requireApiKey, validate(v.login), c.login);

// Logged-in user
router.get('/me', authenticate, c.me);
router.put('/password', authenticate, validate(v.changePassword), c.changePassword);

module.exports = router;
