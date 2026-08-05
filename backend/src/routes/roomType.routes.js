const express = require('express');

const roomTypeController = require('../controllers/roomTypeController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

const canManage = [requireAuth, requireRole(['Super Admin', 'Manager'])];

// Public — the customer-facing booking search reads room types and rates.
router.get('/', roomTypeController.list);
router.get('/:id', roomTypeController.getById);

router.post('/', ...canManage, roomTypeController.create);
router.put('/:id', ...canManage, roomTypeController.update);
router.delete('/:id', ...canManage, roomTypeController.remove);

module.exports = router;
