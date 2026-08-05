const roomService = require('../services/roomService');
const { ok, asyncHandler } = require('../lib/http');
const { Validator, parseId } = require('../lib/validate');

const { ROOM_STATUSES } = roomService;

function validateRoom(body, { partial = false } = {}) {
  const v = new Validator(body)
    .string('roomNumber', { max: 10, label: 'Room number' })
    .integer('roomTypeId', { min: 1, label: 'Room type' })
    .string('floor', { required: false, max: 10, label: 'Floor' });

  if (!partial) {
    v.enum('status', ROOM_STATUSES, { required: false, label: 'Status' });
  }

  const result = v.result();

  // Let the schema default apply when no status was supplied on create.
  if (result.status === null || result.status === undefined) delete result.status;

  return result;
}

/** GET /api/rooms?roomTypeId=&status= */
const list = asyncHandler(async (req, res) => {
  const filters = {};

  if (req.query.roomTypeId) {
    filters.roomTypeId = parseId(req.query.roomTypeId, 'room type id');
  }
  if (req.query.status) {
    filters.status = new Validator({ status: req.query.status })
      .enum('status', ROOM_STATUSES, { label: 'Status' })
      .result().status;
  }

  const rooms = await roomService.list(filters);
  return ok(res, rooms, { total: rooms.length, filters });
});

/**
 * GET /api/rooms/available — public.
 * Excludes rooms under maintenance (SRS §4.2).
 */
const listAvailable = asyncHandler(async (req, res) => {
  const filters = {};
  if (req.query.roomTypeId) {
    filters.roomTypeId = parseId(req.query.roomTypeId, 'room type id');
  }

  const rooms = await roomService.listAvailable(filters);
  return ok(res, rooms, { total: rooms.length, filters });
});

/** GET /api/rooms/:id */
const getById = asyncHandler(async (req, res) => {
  const room = await roomService.getById(parseId(req.params.id, 'room id'));
  return ok(res, room);
});

/** POST /api/rooms */
const create = asyncHandler(async (req, res) => {
  const payload = validateRoom(req.body ?? {});
  const room = await roomService.create(payload);
  return ok(res, room, {}, 201);
});

/** PUT /api/rooms/:id */
const update = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'room id');
  const payload = validateRoom(req.body ?? {});
  const room = await roomService.update(id, payload);
  return ok(res, room);
});

/** PATCH /api/rooms/:id/status */
const updateStatus = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'room id');
  const { status } = new Validator(req.body ?? {})
    .enum('status', ROOM_STATUSES, { label: 'Status' })
    .result();

  const room = await roomService.updateStatus(id, status);
  return ok(res, room);
});

/** DELETE /api/rooms/:id */
const remove = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'room id');
  const result = await roomService.remove(id);
  return ok(res, result);
});

module.exports = { list, listAvailable, getById, create, update, updateStatus, remove };
