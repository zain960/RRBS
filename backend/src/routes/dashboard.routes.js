const express = require('express');

const dashboardController = require('../controllers/dashboardController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

/**
 * The dashboard is the operational screen for managers and the front desk
 * (SRS §4.10). It carries today's revenue, so it stays with the roles that may
 * see money: not the kitchen, and not waiters.
 */
const canView = [
  requireAuth,
  requireRole(['Super Admin', 'Manager', 'Receptionist', 'Accountant']),
];

router.get('/summary', ...canView, dashboardController.summary);
router.get('/revenue-series', ...canView, dashboardController.revenueSeries);

module.exports = router;
