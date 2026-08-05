const express = require('express');

const tableController = require('../controllers/tableController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Setup of the floor plan is Manager-level (seeded `tables:write`).
const canManage = [requireAuth, requireRole(['Super Admin', 'Manager'])];

// Waiters read the floor plan and move tables between Free/Reserved/Occupied as
// guests are seated — they may not add or remove tables (SRS §3).
const canRead = [requireAuth, requireRole(['Super Admin', 'Manager', 'Waiter'])];
const canSetStatus = canRead;

// Public free-table list for the customer dine-in picker, mirroring
// /api/rooms/available. Declared before '/:id' so "available" is not an id.
router.get('/available', tableController.listAvailable);

router.get('/', ...canRead, tableController.list);
router.get('/:id', ...canRead, tableController.getById);
router.post('/', ...canManage, tableController.create);
router.put('/:id', ...canManage, tableController.update);
router.patch('/:id/status', ...canSetStatus, tableController.updateStatus);
router.delete('/:id', ...canManage, tableController.remove);

module.exports = router;
