const express = require('express');

const notificationController = require('../controllers/notificationController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Own notifications by default; reading another recipient's is gated inside the
// controller, because who counts as "own" depends on the account type.
router.get('/', requireAuth, notificationController.list);

module.exports = router;
