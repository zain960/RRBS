const express = require('express');

const reviewController = require('../controllers/reviewController');
const { requireAuth, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// Aggregate ratings are public (they appear on the menu and room listings);
// the raw log and "my reviews" need an account, which the controller checks
// once it knows which shape was asked for.
router.get('/', optionalAuth, reviewController.list);

router.post('/', requireAuth, reviewController.create);

module.exports = router;
