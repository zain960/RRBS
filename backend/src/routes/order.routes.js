const express = require('express');

const orderController = require('../controllers/orderController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Declared before '/:id' so "room-service-bookings" is not parsed as an id.
router.get('/room-service-bookings', requireAuth, orderController.roomServiceBookings);

router.get('/', requireAuth, orderController.list);
router.post('/', requireAuth, orderController.create);

router.get('/:id', requireAuth, orderController.getById);

// Restaurant payments are taken by waiters and the front desk, or by the
// customer paying for their own order (SRS §3, §4.6).
router.post('/:id/payments', requireAuth, orderController.addPayment);
router.get('/:id/payments', requireAuth, orderController.listPayments);

// No requireRole here on purpose: the role permitted to make a transition
// depends on the target status, so orderService.updateStatus() enforces it
// (SRS §4.5 — kitchen vs. waiter vs. front desk).
router.patch('/:id/status', requireAuth, orderController.updateStatus);

module.exports = router;
