const express = require('express');

const foodController = require('../controllers/foodController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Menu maintenance is Manager-level (seeded `foods:write`).
const canManage = [requireAuth, requireRole(['Super Admin', 'Manager'])];

// Waiters take orders from the full list and the kitchen needs to see items
// regardless of availability, so both read the back-office view (SRS §3).
const canRead = [
  requireAuth,
  requireRole(['Super Admin', 'Manager', 'Waiter', 'Kitchen Staff']),
];

router.get('/', ...canRead, foodController.list);
router.get('/:id', ...canRead, foodController.getById);
router.post('/', ...canManage, foodController.create);
router.put('/:id', ...canManage, foodController.update);
router.patch('/:id/availability', ...canManage, foodController.updateAvailability);
router.delete('/:id', ...canManage, foodController.remove);

module.exports = router;
