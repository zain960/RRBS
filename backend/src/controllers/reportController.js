const reportService = require('../services/reportService');
const { ok, AppError, asyncHandler } = require('../lib/http');
const { sendCsv } = require('../lib/csv');

const { REPORTS } = reportService;

function parseDate(raw, field, label) {
  if (!raw) return undefined;

  const value = new Date(raw);
  if (Number.isNaN(value.getTime())) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Please correct the highlighted fields.', {
      [field]: `${label} must be a valid date.`,
    });
  }
  return value;
}

/** GET /api/reports — the report catalogue this caller may run. */
const catalogue = asyncHandler(async (req, res) => {
  const available = Object.entries(REPORTS)
    .filter(([, report]) => !report.roles || report.roles.includes(req.auth.roleName))
    .map(([slug, report]) => ({ slug, title: report.title }));

  return ok(res, available, { total: available.length });
});

/**
 * GET /api/reports/:slug?from=&to=&format=json|csv
 *
 * Every report returns the same { columns, rows, summary } shape, so CSV export
 * needs no per-report serialisation.
 */
const run = asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const report = REPORTS[slug];

  if (!report) {
    throw new AppError(404, 'NOT_FOUND', `No report named "${slug}".`, {
      available: Object.keys(REPORTS),
    });
  }

  // Some reports are restricted beyond the route's own guard (SRS §5.4).
  if (report.roles && !report.roles.includes(req.auth.roleName)) {
    throw new AppError(403, 'FORBIDDEN', 'Your role does not have access to this report.', {
      requiredRoles: report.roles,
      yourRole: req.auth.roleName,
    });
  }

  const result = await report.run({
    from: parseDate(req.query.from, 'from', 'From date'),
    to: parseDate(req.query.to, 'to', 'To date'),
  });

  const format = String(req.query.format ?? 'json').toLowerCase();

  if (format === 'csv') {
    const stamp = new Date().toISOString().slice(0, 10);
    return sendCsv(res, `${slug}-report-${stamp}.csv`, result.columns, result.rows);
  }

  if (format !== 'json') {
    throw new AppError(422, 'VALIDATION_ERROR', 'Please correct the highlighted fields.', {
      format: 'Format must be json or csv.',
    });
  }

  return ok(res, result.rows, {
    report: slug,
    title: report.title,
    columns: result.columns,
    summary: result.summary,
  });
});

module.exports = { catalogue, run };
