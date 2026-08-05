const express = require('express');

const settingsController = require('../controllers/settingsController');
const { requireAuth, optionalAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// System-level settings are Super Admin only — a Manager has no system access
// (SRS §3). Tax rates change what every future booking and order is charged.
const canWrite = [requireAuth, requireRole(['Super Admin'])];

// Reading is public: the rate appears on every quote, menu and receipt, and
// the customer-facing checkouts show a tax line before the guest signs in.
router.get('/tax', optionalAuth, settingsController.getTax);
router.put('/tax', ...canWrite, settingsController.updateTax);

module.exports = router;
