const express = require('express');

const paymentController = require('../controllers/paymentController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Taking money: front desk for rooms, waiters for restaurant bills (SRS §3).
const canTakePayment = [
  requireAuth,
  requireRole(['Super Admin', 'Manager', 'Receptionist', 'Waiter']),
];

// The payment ledger is a financial report: Manager, Accountant, Super Admin
// only (SRS §5.4). Receptionists and waiters read payments through the
// booking/order they are working on instead.
const canReadLedger = [
  requireAuth,
  requireRole(['Super Admin', 'Manager', 'Accountant']),
];

router.post('/', ...canTakePayment, paymentController.create);
router.get('/', ...canReadLedger, paymentController.list);

module.exports = router;
