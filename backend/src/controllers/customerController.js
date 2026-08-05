const customerService = require('../services/customerService');
const { ok, asyncHandler } = require('../lib/http');
const { parseId } = require('../lib/validate');

/** GET /api/customers — the guest register, paginated and searchable. */
const list = asyncHandler(async (req, res) => {
  const { customers, meta } = await customerService.list({
    page: Number(req.query.page) || 1,
    pageSize: Number(req.query.page_size) || undefined,
    search: (req.query.q ?? '').toString().trim(),
  });

  return ok(res, customers, meta);
});

/** GET /api/customers/:id — one guest plus their recent bookings and orders. */
const getById = asyncHandler(async (req, res) => {
  const customer = await customerService.getById(parseId(req.params.id, 'customer id'));
  return ok(res, customer);
});

module.exports = { list, getById };
