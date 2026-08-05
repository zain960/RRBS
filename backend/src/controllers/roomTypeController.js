const roomTypeService = require('../services/roomTypeService');
const { ok, asyncHandler } = require('../lib/http');
const { Validator, parseId } = require('../lib/validate');

const { RATE_FIELDS } = roomTypeService;

const RATE_LABELS = {
  rate2hr: '2 hour rate',
  rate4hr: '4 hour rate',
  rate6hr: '6 hour rate',
  rate8hr: '8 hour rate',
  rateFullDay: 'Full Day rate',
  rateFullNight: 'Full Night rate',
  rateDayNight: 'Day & Night rate',
};

function validateRoomType(body) {
  const v = new Validator(body)
    .string('typeName', { max: 50, label: 'Type name' })
    .integer('capacity', { min: 1, label: 'Capacity' })
    .string('amenities', { required: false, label: 'Amenities' })
    .string('imageUrl', { required: false, max: 500, label: 'Image URL' });

  for (const field of RATE_FIELDS) {
    v.money(field, { required: false, min: 0, label: RATE_LABELS[field] });
  }

  return v.result();
}

/** GET /api/room-types — public; used by the booking search. */
const list = asyncHandler(async (req, res) => {
  const roomTypes = await roomTypeService.list();
  return ok(res, roomTypes, { total: roomTypes.length });
});

/** GET /api/room-types/:id */
const getById = asyncHandler(async (req, res) => {
  const roomType = await roomTypeService.getById(parseId(req.params.id, 'room type id'));
  return ok(res, roomType);
});

/** POST /api/room-types */
const create = asyncHandler(async (req, res) => {
  const payload = validateRoomType(req.body ?? {});
  const roomType = await roomTypeService.create(payload);
  return ok(res, roomType, {}, 201);
});

/** PUT /api/room-types/:id */
const update = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'room type id');
  const payload = validateRoomType(req.body ?? {});
  const roomType = await roomTypeService.update(id, payload);
  return ok(res, roomType);
});

/** DELETE /api/room-types/:id */
const remove = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'room type id');
  const result = await roomTypeService.remove(id);
  return ok(res, result);
});

module.exports = { list, getById, create, update, remove };
