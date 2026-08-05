const express = require('express');

const prisma = require('../lib/prisma');
const { ok, asyncHandler } = require('../lib/http');

const router = express.Router();

/**
 * GET /api/booking-durations — public.
 * The fixed duration options the booking search offers (SRS §5.1).
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const durations = await prisma.bookingDuration.findMany({ orderBy: { durationId: 'asc' } });

    return ok(
      res,
      durations.map((d) => ({
        id: d.durationId,
        name: d.durationName,
        hours: d.hours === null ? null : Number(d.hours),
      })),
      { total: durations.length }
    );
  })
);

module.exports = router;
