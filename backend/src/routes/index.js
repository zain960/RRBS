const express = require('express');

const prisma = require('../lib/prisma');
const { ok, fail, asyncHandler } = require('../lib/http');

const authRoutes = require('./auth.routes');
const bookingRoutes = require('./booking.routes');
const categoryRoutes = require('./category.routes');
const couponRoutes = require('./coupon.routes');
const customerRoutes = require('./customer.routes');
const dashboardRoutes = require('./dashboard.routes');
const durationRoutes = require('./duration.routes');
const foodRoutes = require('./food.routes');
const menuRoutes = require('./menu.routes');
const notificationRoutes = require('./notification.routes');
const orderRoutes = require('./order.routes');
const paymentRoutes = require('./payment.routes');
const reportRoutes = require('./report.routes');
const reviewRoutes = require('./review.routes');
const roleRoutes = require('./role.routes');
const roomRoutes = require('./room.routes');
const roomTypeRoutes = require('./roomType.routes');
const settingsRoutes = require('./settings.routes');
const tableRoutes = require('./table.routes');

const router = express.Router();

/**
 * Liveness — is the process up and answering?
 * Deliberately touches nothing else, so a restart loop is distinguishable from
 * a database outage.
 */
router.get('/health', (req, res) => {
  res.json({
    data: { status: 'ok' },
    error: null,
    meta: { uptime: process.uptime(), environment: process.env.NODE_ENV || 'development' },
  });
});

/**
 * Readiness — can the app actually serve a request that needs data?
 *
 * Runs a real round trip rather than inspecting the pool, and answers 503 when
 * the database is unreachable so a load balancer or uptime check treats the
 * instance as unhealthy instead of merely noisy.
 */
router.get(
  '/health/db',
  asyncHandler(async (req, res) => {
    const startedAt = Date.now();

    try {
      await prisma.$queryRaw`SELECT 1`;
      return ok(
        res,
        { status: 'ok', database: 'reachable' },
        { latencyMs: Date.now() - startedAt }
      );
    } catch (err) {
      // The message can name a host and port, so it is logged rather than
      // returned (SRS §8 Security).
      console.error('[health] database unreachable:', err.message);
      return fail(
        res,
        503,
        'DATABASE_UNREACHABLE',
        'The database is not reachable.',
        { latencyMs: Date.now() - startedAt }
      );
    }
  })
);

router.use('/auth', authRoutes);
router.use('/roles', roleRoutes);
router.use('/room-types', roomTypeRoutes);
router.use('/rooms', roomRoutes);
router.use('/booking-durations', durationRoutes);
router.use('/bookings', bookingRoutes);
router.use('/customers', customerRoutes);
router.use('/tables', tableRoutes);
router.use('/categories', categoryRoutes);
router.use('/foods', foodRoutes);
router.use('/menu', menuRoutes);
router.use('/orders', orderRoutes);
router.use('/coupons', couponRoutes);
router.use('/payments', paymentRoutes);
router.use('/settings', settingsRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/reports', reportRoutes);
router.use('/reviews', reviewRoutes);
router.use('/notifications', notificationRoutes);

module.exports = router;
