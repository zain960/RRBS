/**
 * Coupons and discounts (SRS §4.7, §5.3).
 *
 * A coupon carries a discount type, validity window, minimum amount, usage
 * limit and applicability (Rooms / Food / Both). The rules are checked at the
 * moment of use by couponDiscount() in the pricing service — this module owns
 * management and the standalone validation endpoint, so both paths share one
 * definition of "valid".
 *
 * Only one coupon may be applied per booking or order (SRS §5.3); the schema
 * enforces that with a single `coupon_id` column on each.
 */
const prisma = require('../lib/prisma');
const { AppError } = require('../lib/http');
const { toMoneyString, round2, ZERO } = require('../lib/money');
const { couponDiscount } = require('./pricingService');
const settingsService = require('./settingsService');

const DISCOUNT_TYPES = ['PERCENTAGE', 'FIXED_AMOUNT'];
const APPLICABILITIES = ['ROOMS', 'FOOD', 'BOTH'];

/** Redemptions so far: a coupon may be used by bookings and by orders. */
function usageOf(coupon) {
  return (coupon._count?.bookings ?? 0) + (coupon._count?.orders ?? 0);
}

function publicCoupon(coupon) {
  const timesUsed = usageOf(coupon);

  return {
    id: coupon.couponId,
    code: coupon.code,
    discountType: coupon.discountType,
    discountValue: String(coupon.discountValue),
    applicableTo: coupon.applicableTo,
    minAmount: coupon.minAmount === null ? null : toMoneyString(coupon.minAmount),
    usageLimit: coupon.usageLimit,
    timesUsed,
    remainingUses: coupon.usageLimit === null ? null : Math.max(0, coupon.usageLimit - timesUsed),
    validFrom: coupon.validFrom,
    validTo: coupon.validTo,
    isActive: coupon.isActive,
    createdAt: coupon.createdAt,
  };
}

const WITH_USAGE = { _count: { select: { bookings: true, orders: true } } };

/**
 * Loads a coupon by code with its redemption count attached, in the shape
 * couponDiscount() expects.
 */
async function loadByCode(client, code) {
  if (!code) return null;

  const coupon = await client.coupon.findUnique({
    where: { code: String(code).trim().toUpperCase() },
    include: WITH_USAGE,
  });

  if (!coupon) return null;
  return { ...coupon, timesUsed: usageOf(coupon) };
}

async function list({ isActive, applicableTo } = {}) {
  const coupons = await prisma.coupon.findMany({
    where: {
      ...(isActive === undefined ? {} : { isActive }),
      ...(applicableTo ? { applicableTo } : {}),
    },
    include: WITH_USAGE,
    orderBy: { code: 'asc' },
  });

  return coupons.map(publicCoupon);
}

async function getById(couponId) {
  const coupon = await prisma.coupon.findUnique({
    where: { couponId },
    include: WITH_USAGE,
  });

  if (!coupon) throw new AppError(404, 'NOT_FOUND', 'Coupon not found.');
  return publicCoupon(coupon);
}

/** Codes are stored upper-case so "save10" and "SAVE10" cannot both exist. */
function normaliseCode(code) {
  return String(code).trim().toUpperCase();
}

function assertRules({ discountType, discountValue, validFrom, validTo }) {
  const errors = {};

  if (discountType === 'PERCENTAGE' && Number(discountValue) > 100) {
    errors.discountValue = 'A percentage discount cannot exceed 100.';
  }
  if (validFrom && validTo && new Date(validTo) < new Date(validFrom)) {
    errors.validTo = 'The end of the validity window must not precede its start.';
  }

  if (Object.keys(errors).length > 0) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Please correct the highlighted fields.', errors);
  }
}

async function assertCodeFree(code, exceptCouponId) {
  const duplicate = await prisma.coupon.findUnique({ where: { code } });
  if (duplicate && duplicate.couponId !== exceptCouponId) {
    throw new AppError(409, 'COUPON_CODE_TAKEN', 'A coupon with this code already exists.', {
      code: 'This coupon code is already in use.',
    });
  }
}

async function create(payload) {
  const code = normaliseCode(payload.code);
  assertRules(payload);
  await assertCodeFree(code);

  const created = await prisma.coupon.create({
    data: { ...payload, code },
    include: WITH_USAGE,
  });

  return publicCoupon(created);
}

async function update(couponId, payload) {
  const existing = await prisma.coupon.findUnique({ where: { couponId } });
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Coupon not found.');

  const code = payload.code === undefined ? undefined : normaliseCode(payload.code);
  assertRules({ ...existing, ...payload });

  if (code !== undefined && code !== existing.code) {
    await assertCodeFree(code, couponId);
  }

  const updated = await prisma.coupon.update({
    where: { couponId },
    data: { ...payload, ...(code === undefined ? {} : { code }) },
    include: WITH_USAGE,
  });

  return publicCoupon(updated);
}

/** On/off switch — the way to retire a coupon that has already been redeemed. */
async function setActive(couponId, isActive) {
  const existing = await prisma.coupon.findUnique({ where: { couponId } });
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Coupon not found.');

  const updated = await prisma.coupon.update({
    where: { couponId },
    data: { isActive },
    include: WITH_USAGE,
  });

  return publicCoupon(updated);
}

/**
 * A redeemed coupon cannot be deleted — the FK is Restrict, and removing it
 * would sever a confirmed booking or order from the discount it was given
 * (SRS §8 Auditability). Deactivate it instead.
 */
async function remove(couponId) {
  const existing = await prisma.coupon.findUnique({
    where: { couponId },
    include: WITH_USAGE,
  });

  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Coupon not found.');

  const timesUsed = usageOf(existing);
  if (timesUsed > 0) {
    throw new AppError(
      409,
      'COUPON_IN_USE',
      `In use: "${existing.code}" has been redeemed ${timesUsed} time(s) and cannot be deleted. Deactivate it instead.`,
      { timesUsed }
    );
  }

  await prisma.coupon.delete({ where: { couponId } });
  return { deleted: true, id: couponId };
}

/**
 * Checks a coupon against a prospective subtotal without applying it (SRS §4.7).
 *
 * Unlike the pricing path this reports rather than throws, because the checkout
 * screen asks speculatively as the customer types. The rules themselves come
 * from couponDiscount(), so a coupon accepted here is accepted at checkout.
 *
 * @param {'ROOMS'|'FOOD'} target which module the coupon is being used for
 */
async function validate({ code, target, subtotal, at = new Date() }) {
  const coupon = await loadByCode(prisma, code);

  if (!coupon) {
    return {
      valid: false,
      code: 'COUPON_NOT_FOUND',
      message: 'That coupon code is not recognised.',
      discountAmount: toMoneyString(ZERO),
    };
  }

  const rates = await settingsService.taxRates();
  const taxPercent = target === 'FOOD' ? rates.foodTaxPercent : rates.roomTaxPercent;

  try {
    const discount = couponDiscount(coupon, subtotal, { applicability: target, at });
    const discounted = round2(round2(subtotal).minus(discount));

    return {
      valid: true,
      code: null,
      message: `${coupon.code} applied.`,
      discountAmount: toMoneyString(discount),
      coupon: publicCoupon(coupon),
      // Indicative only — the authoritative figures are calculated and stored
      // when the booking or order is actually created.
      preview: {
        subtotal: toMoneyString(subtotal),
        discountAmount: toMoneyString(discount),
        discountedSubtotal: toMoneyString(discounted),
        taxPercent,
      },
    };
  } catch (err) {
    // A rule rejection is a normal answer here, not a failure. Anything else
    // (a bug, a database error) still propagates.
    if (!err.code || !String(err.code).startsWith('COUPON_')) throw err;

    return {
      valid: false,
      code: err.code,
      message: err.message,
      discountAmount: toMoneyString(ZERO),
      coupon: publicCoupon(coupon),
    };
  }
}

module.exports = {
  list,
  getById,
  create,
  update,
  setActive,
  remove,
  validate,
  loadByCode,
  publicCoupon,
  DISCOUNT_TYPES,
  APPLICABILITIES,
};
