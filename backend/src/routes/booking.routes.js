const express = require('express');

const bookingController = require('../controllers/bookingController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Front-desk operations (SRS §3).
const frontDesk = [requireAuth, requireRole(['Super Admin', 'Manager', 'Receptionist'])];

// Public availability search — no account needed to look for a room.
router.post('/search', bookingController.search);

router.get('/', requireAuth, bookingController.list);
router.post('/', requireAuth, bookingController.create);

router.get('/:id', requireAuth, bookingController.getById);

// Payments may be taken by staff, or by the customer paying for their own stay.
router.post('/:id/payments', requireAuth, bookingController.addPayment);
router.get('/:id/payments', requireAuth, bookingController.listPayments);

router.patch('/:id/confirm', requireAuth, bookingController.confirm);
router.patch('/:id/cancel', requireAuth, bookingController.cancel);

// Check-in and checkout are front-desk actions only.
router.patch('/:id/check-in', ...frontDesk, bookingController.checkIn);
router.patch('/:id/check-out', ...frontDesk, bookingController.checkOut);

module.exports = router;
