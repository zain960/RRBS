const express = require('express');

const roomController = require('../controllers/roomController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

const canManage = [requireAuth, requireRole(['Super Admin', 'Manager'])];

// Public availability view — maintenance rooms are excluded (SRS §4.2).
// Declared before '/:id' so "available" is not parsed as an id.
router.get('/available', roomController.listAvailable);

router.get('/', ...canManage, roomController.list);
router.get('/:id', ...canManage, roomController.getById);
router.post('/', ...canManage, roomController.create);
router.put('/:id', ...canManage, roomController.update);
router.patch('/:id/status', ...canManage, roomController.updateStatus);
router.delete('/:id', ...canManage, roomController.remove);

module.exports = router;
