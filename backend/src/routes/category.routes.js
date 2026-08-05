const express = require('express');

const categoryController = require('../controllers/categoryController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Menu structure is Manager-level (seeded `categories:write`).
const canManage = [requireAuth, requireRole(['Super Admin', 'Manager'])];

// Waiters and the kitchen read categories to navigate the menu (SRS §3).
// The public menu does not use this route — it reads GET /api/menu, which is
// already grouped by category and filtered to available items.
const canRead = [
  requireAuth,
  requireRole(['Super Admin', 'Manager', 'Waiter', 'Kitchen Staff']),
];

router.get('/', ...canRead, categoryController.list);
router.get('/:id', ...canRead, categoryController.getById);
router.post('/', ...canManage, categoryController.create);
router.put('/:id', ...canManage, categoryController.update);
router.delete('/:id', ...canManage, categoryController.remove);

module.exports = router;
