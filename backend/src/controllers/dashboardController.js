const dashboardService = require('../services/dashboardService');
const { ok, asyncHandler } = require('../lib/http');

/** GET /api/dashboard/summary */
const summary = asyncHandler(async (req, res) => {
  const data = await dashboardService.summary();
  return ok(res, data, { generatedAt: new Date() });
});

/** GET /api/dashboard/revenue-series?days=30 — daily rooms vs food net take. */
const revenueSeries = asyncHandler(async (req, res) => {
  const requested = Number(req.query.days);
  // Clamped: the chart is a trend, not an export, and an unbounded window
  // would let one query scan the whole payments table.
  const days = Number.isFinite(requested) ? Math.min(Math.max(7, requested), 90) : 30;

  const data = await dashboardService.revenueSeries({ days });
  return ok(res, data, { days });
});

module.exports = { summary, revenueSeries };
