const express = require('express');

const customerController = require('../controllers/customerController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// The guest register is front-desk territory: Receptionists register walk-ins
// and look guests up at check-in (SRS §3, §4.1). Waiters and kitchen staff have
// no reason to read customer contact details, so they are not on this list.
const canRead = [requireAuth, requireRole(['Super Admin', 'Manager', 'Receptionist'])];

router.get('/', ...canRead, customerController.list);
router.get('/:id', ...canRead, customerController.getById);

module.exports = router;
