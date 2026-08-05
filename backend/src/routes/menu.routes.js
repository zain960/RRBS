const express = require('express');

const foodController = require('../controllers/foodController');

const router = express.Router();

// Public — the customer-facing menu. Grouped by category, Available items only.
// Unavailable items are served from /api/foods instead, which requires staff.
router.get('/', foodController.menu);

module.exports = router;
