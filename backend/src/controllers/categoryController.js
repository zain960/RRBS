const categoryService = require('../services/categoryService');
const { ok, asyncHandler } = require('../lib/http');
const { Validator, parseId } = require('../lib/validate');

function validateCategory(body) {
  return new Validator(body)
    .string('categoryName', { max: 50, label: 'Category name' })
    .result();
}

/** GET /api/categories */
const list = asyncHandler(async (req, res) => {
  const categories = await categoryService.list();
  return ok(res, categories, { total: categories.length });
});

/** GET /api/categories/:id */
const getById = asyncHandler(async (req, res) => {
  const category = await categoryService.getById(parseId(req.params.id, 'category id'));
  return ok(res, category);
});

/** POST /api/categories */
const create = asyncHandler(async (req, res) => {
  const payload = validateCategory(req.body ?? {});
  const category = await categoryService.create(payload);
  return ok(res, category, {}, 201);
});

/** PUT /api/categories/:id */
const update = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'category id');
  const payload = validateCategory(req.body ?? {});
  const category = await categoryService.update(id, payload);
  return ok(res, category);
});

/** DELETE /api/categories/:id */
const remove = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'category id');
  const result = await categoryService.remove(id);
  return ok(res, result);
});

module.exports = { list, getById, create, update, remove };
