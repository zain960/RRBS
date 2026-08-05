const express = require('express');

const reportController = require('../controllers/reportController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

/**
 * Financial reports are Manager, Accountant and Super Admin only (SRS §5.4).
 * Staff Performance narrows further to Manager and Super Admin — enforced in
 * the controller against the report's own `roles`, since it is one slug among
 * several behind the same route.
 */
const canReport = [requireAuth, requireRole(['Super Admin', 'Manager', 'Accountant'])];

router.get('/', ...canReport, reportController.catalogue);
router.get('/:slug', ...canReport, reportController.run);

module.exports = router;
