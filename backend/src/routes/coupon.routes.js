const express = require('express');

const couponController = require('../controllers/couponController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Coupon management is Manager-level (seeded `coupons:write`).
const canManage = [requireAuth, requireRole(['Super Admin', 'Manager'])];

/**
 * Validation is open to any signed-in caller — a customer applying a code at
 * checkout needs it, and it reveals nothing beyond whether their own code
 * works for the amount they are about to spend. Declared before '/:id' so
 * "validate" is not parsed as an id.
 */
router.post('/validate', requireAuth, couponController.validate);

router.get('/', ...canManage, couponController.list);
router.get('/:id', ...canManage, couponController.getById);
router.post('/', ...canManage, couponController.create);
router.put('/:id', ...canManage, couponController.update);
router.patch('/:id/active', ...canManage, couponController.setActive);
router.delete('/:id', ...canManage, couponController.remove);

module.exports = router;
