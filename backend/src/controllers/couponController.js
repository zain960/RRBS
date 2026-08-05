const couponService = require('../services/couponService');
const { ok, AppError, asyncHandler } = require('../lib/http');
const { Validator, parseId } = require('../lib/validate');

const { DISCOUNT_TYPES, APPLICABILITIES } = couponService;

function parseDate(raw, field, label) {
  const value = new Date(raw);
  if (Number.isNaN(value.getTime())) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Please correct the highlighted fields.', {
      [field]: `${label} must be a valid date.`,
    });
  }
  return value;
}

function validateCoupon(body) {
  const v = new Validator({
    code: body.code,
    discountType: body.discount_type ?? body.discountType,
    discountValue: body.discount_value ?? body.discountValue,
    applicableTo: body.applicable_to ?? body.applicableTo,
    minAmount: body.min_amount ?? body.minAmount,
    usageLimit: body.usage_limit ?? body.usageLimit,
  })
    .string('code', { max: 30, label: 'Code' })
    .enum('discountType', DISCOUNT_TYPES, { label: 'Discount type' })
    .money('discountValue', { required: true, min: 0, label: 'Discount value' })
    .enum('applicableTo', APPLICABILITIES, { label: 'Applies to' })
    .money('minAmount', { required: false, min: 0, label: 'Minimum amount' })
    .integer('usageLimit', { required: false, min: 1, label: 'Usage limit' });

  const result = v.result();

  const rawFrom = body.valid_from ?? body.validFrom;
  const rawTo = body.valid_to ?? body.validTo;

  if (!rawFrom || !rawTo) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Please correct the highlighted fields.', {
      ...(rawFrom ? {} : { validFrom: 'Valid-from date is required.' }),
      ...(rawTo ? {} : { validTo: 'Valid-to date is required.' }),
    });
  }

  result.validFrom = parseDate(rawFrom, 'validFrom', 'Valid from');
  result.validTo = parseDate(rawTo, 'validTo', 'Valid to');

  const rawActive = body.is_active ?? body.isActive;
  if (rawActive !== undefined) result.isActive = rawActive === true || rawActive === 'true';

  return result;
}

/** GET /api/coupons?isActive=&applicableTo= */
const list = asyncHandler(async (req, res) => {
  const filters = {};

  if (req.query.isActive !== undefined || req.query.is_active !== undefined) {
    filters.isActive = (req.query.isActive ?? req.query.is_active) === 'true';
  }
  if (req.query.applicableTo || req.query.applicable_to) {
    filters.applicableTo = new Validator({
      applicableTo: req.query.applicableTo ?? req.query.applicable_to,
    })
      .enum('applicableTo', APPLICABILITIES, { label: 'Applies to' })
      .result().applicableTo;
  }

  const coupons = await couponService.list(filters);
  return ok(res, coupons, { total: coupons.length, filters });
});

/** GET /api/coupons/:id */
const getById = asyncHandler(async (req, res) => {
  const coupon = await couponService.getById(parseId(req.params.id, 'coupon id'));
  return ok(res, coupon);
});

/** POST /api/coupons */
const create = asyncHandler(async (req, res) => {
  const coupon = await couponService.create(validateCoupon(req.body ?? {}));
  return ok(res, coupon, {}, 201);
});

/** PUT /api/coupons/:id */
const update = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'coupon id');
  const coupon = await couponService.update(id, validateCoupon(req.body ?? {}));
  return ok(res, coupon);
});

/** PATCH /api/coupons/:id/active */
const setActive = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'coupon id');
  const raw = req.body?.is_active ?? req.body?.isActive;

  if (raw === undefined) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Please correct the highlighted fields.', {
      isActive: 'Active flag is required.',
    });
  }

  const coupon = await couponService.setActive(id, raw === true || raw === 'true');
  return ok(res, coupon);
});

/** DELETE /api/coupons/:id */
const remove = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'coupon id');
  const result = await couponService.remove(id);
  return ok(res, result);
});

/**
 * POST /api/coupons/validate — { code, target, subtotal }
 *
 * Always 200: an invalid coupon is a normal answer, not a request failure, so
 * the checkout screen can show the reason inline as the customer types.
 */
const validate = asyncHandler(async (req, res) => {
  const body = req.body ?? {};

  const { code, target, subtotal } = new Validator({
    code: body.code,
    target: body.target,
    subtotal: body.subtotal,
  })
    .string('code', { max: 30, label: 'Code' })
    .enum('target', ['ROOMS', 'FOOD'], { label: 'Target' })
    .money('subtotal', { required: true, min: 0, label: 'Subtotal' })
    .result();

  const result = await couponService.validate({ code, target, subtotal });
  return ok(res, result);
});

module.exports = { list, getById, create, update, setActive, remove, validate };
