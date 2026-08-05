const tableService = require('../services/tableService');
const { ok, asyncHandler } = require('../lib/http');
const { Validator, parseId } = require('../lib/validate');

const { TABLE_STATUSES, TABLE_LOCATIONS } = tableService;

function validateTable(body) {
  const v = new Validator(body)
    .string('tableNumber', { max: 10, label: 'Table number' })
    .integer('capacity', { min: 1, max: 50, label: 'Capacity' })
    .enum('location', TABLE_LOCATIONS, { label: 'Location' })
    .enum('status', TABLE_STATUSES, { required: false, label: 'Status' });

  const result = v.result();

  // Let the schema default (Free) apply when no status was supplied on create.
  if (result.status === null || result.status === undefined) delete result.status;

  return result;
}

/** GET /api/tables?status=&location= */
const list = asyncHandler(async (req, res) => {
  const filters = {};

  if (req.query.status) {
    filters.status = new Validator({ status: req.query.status })
      .enum('status', TABLE_STATUSES, { label: 'Status' })
      .result().status;
  }
  if (req.query.location) {
    filters.location = new Validator({ location: req.query.location })
      .enum('location', TABLE_LOCATIONS, { label: 'Location' })
      .result().location;
  }

  const tables = await tableService.list(filters);
  return ok(res, tables, { total: tables.length, filters });
});

/** GET /api/tables/available — public; the dine-in table picker. */
const listAvailable = asyncHandler(async (req, res) => {
  const tables = await tableService.listAvailable();
  return ok(res, tables, { total: tables.length });
});

/** GET /api/tables/:id */
const getById = asyncHandler(async (req, res) => {
  const table = await tableService.getById(parseId(req.params.id, 'table id'));
  return ok(res, table);
});

/** POST /api/tables */
const create = asyncHandler(async (req, res) => {
  const payload = validateTable(req.body ?? {});
  const table = await tableService.create(payload);
  return ok(res, table, {}, 201);
});

/** PUT /api/tables/:id */
const update = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'table id');
  const payload = validateTable(req.body ?? {});
  const table = await tableService.update(id, payload);
  return ok(res, table);
});

/** PATCH /api/tables/:id/status */
const updateStatus = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'table id');
  const { status } = new Validator(req.body ?? {})
    .enum('status', TABLE_STATUSES, { label: 'Status' })
    .result();

  const table = await tableService.updateStatus(id, status);
  return ok(res, table);
});

/** DELETE /api/tables/:id */
const remove = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'table id');
  const result = await tableService.remove(id);
  return ok(res, result);
});

module.exports = { list, listAvailable, getById, create, update, updateStatus, remove };
