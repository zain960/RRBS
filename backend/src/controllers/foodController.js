const foodService = require('../services/foodService');
const { ok, asyncHandler } = require('../lib/http');
const { Validator, parseId } = require('../lib/validate');

const { FOOD_AVAILABILITIES } = foodService;

function validateFood(body) {
  const v = new Validator(body)
    .string('name', { max: 100, label: 'Name' })
    .integer('categoryId', { min: 1, label: 'Category' })
    .string('description', { required: false, label: 'Description' })
    .money('price', { required: true, min: 0, label: 'Price' })
    .url('imageUrl', { required: false, max: 255, label: 'Image URL' })
    .enum('availabilityStatus', FOOD_AVAILABILITIES, {
      required: false,
      label: 'Availability',
    });

  const result = v.result();

  // Let the schema default (Available) apply when nothing was supplied.
  if (result.availabilityStatus === null || result.availabilityStatus === undefined) {
    delete result.availabilityStatus;
  }

  return result;
}

/** GET /api/foods?categoryId=&availabilityStatus= — back office, all items. */
const list = asyncHandler(async (req, res) => {
  const filters = {};

  if (req.query.categoryId) {
    filters.categoryId = parseId(req.query.categoryId, 'category id');
  }
  if (req.query.availabilityStatus) {
    filters.availabilityStatus = new Validator({
      availabilityStatus: req.query.availabilityStatus,
    })
      .enum('availabilityStatus', FOOD_AVAILABILITIES, { label: 'Availability' })
      .result().availabilityStatus;
  }

  const foods = await foodService.list(filters);
  return ok(res, foods, { total: foods.length, filters });
});

/**
 * GET /api/menu — public.
 * Grouped by category, available items only (SRS §5.2).
 */
const menu = asyncHandler(async (req, res) => {
  const categories = await foodService.menu();
  const itemCount = categories.reduce((sum, category) => sum + category.items.length, 0);

  return ok(res, categories, { categories: categories.length, items: itemCount });
});

/** GET /api/foods/:id */
const getById = asyncHandler(async (req, res) => {
  const food = await foodService.getById(parseId(req.params.id, 'food id'));
  return ok(res, food);
});

/** POST /api/foods */
const create = asyncHandler(async (req, res) => {
  const payload = validateFood(req.body ?? {});
  const food = await foodService.create(payload);
  return ok(res, food, {}, 201);
});

/** PUT /api/foods/:id */
const update = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'food id');
  const payload = validateFood(req.body ?? {});
  const food = await foodService.update(id, payload);
  return ok(res, food);
});

/** PATCH /api/foods/:id/availability */
const updateAvailability = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'food id');
  const { availabilityStatus } = new Validator(req.body ?? {})
    .enum('availabilityStatus', FOOD_AVAILABILITIES, { label: 'Availability' })
    .result();

  const food = await foodService.setAvailability(id, availabilityStatus);
  return ok(res, food);
});

/** DELETE /api/foods/:id */
const remove = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'food id');
  const result = await foodService.remove(id);
  return ok(res, result);
});

module.exports = { list, menu, getById, create, update, updateAvailability, remove };
