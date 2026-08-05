/**
 * Booking price calculation (SRS §5.3).
 *
 *   Subtotal -> minus Discount -> plus Tax -> Total
 *
 * Tax is always charged on the discounted amount, never the gross. All figures
 * are Decimal; the caller persists them so the price is locked at confirmation
 * and never recomputed from current master data.
 */
const { AppError } = require('../lib/http');
const config = require('../lib/config');
const { toDecimal, round2, percentOf, clampZero, ZERO } = require('../lib/money');

/** Maps a duration option to the rate column on room_types (SRS §7.2). */
const DURATION_RATE_FIELD = {
  '2 Hours': 'rate2hr',
  '4 Hours': 'rate4hr',
  '6 Hours': 'rate6hr',
  '8 Hours': 'rate8hr',
  'Full Day': 'rateFullDay',
  'Full Night': 'rateFullNight',
  'Day & Night': 'rateDayNight',
};

/** The nightly/hourly rate this room type charges for the chosen duration. */
function rateFor(roomType, duration) {
  const field = DURATION_RATE_FIELD[duration.durationName];

  if (!field) {
    throw new AppError(
      422,
      'UNKNOWN_DURATION',
      `No rate column is mapped for duration "${duration.durationName}".`
    );
  }

  const rate = roomType[field];
  if (rate === null || rate === undefined) {
    throw new AppError(
      422,
      'RATE_NOT_SET',
      `"${roomType.typeName}" has no rate configured for ${duration.durationName}.`,
      { roomTypeId: roomType.roomTypeId, duration: duration.durationName }
    );
  }

  return toDecimal(rate);
}

/**
 * Validates a coupon against its rules at the moment of use (SRS §5.3).
 * Returns the discount amount, or throws with a specific reason.
 */
function couponDiscount(coupon, subtotal, { applicability = 'ROOMS', at = new Date() } = {}) {
  if (!coupon) return ZERO;

  const reject = (code, message) => {
    throw new AppError(422, code, message, { couponCode: coupon.code });
  };

  // Validity window — valid_to is a DATE, so the coupon is good all that day.
  const validFrom = new Date(coupon.validFrom);
  const validTo = new Date(coupon.validTo);
  validTo.setUTCHours(23, 59, 59, 999);

  // Switched off by staff — checked before the date window so the message
  // says what is actually wrong.
  if (coupon.isActive === false) {
    reject('COUPON_INACTIVE', 'This coupon is no longer active.');
  }

  if (at < validFrom) reject('COUPON_NOT_YET_VALID', 'This coupon is not valid yet.');
  if (at > validTo) reject('COUPON_EXPIRED', 'This coupon has expired.');

  if (coupon.applicableTo !== 'BOTH' && coupon.applicableTo !== applicability) {
    reject(
      'COUPON_NOT_APPLICABLE',
      applicability === 'FOOD'
        ? 'This coupon cannot be used for food orders.'
        : 'This coupon cannot be used for room bookings.'
    );
  }

  if (coupon.minAmount !== null && toDecimal(subtotal).lessThan(toDecimal(coupon.minAmount))) {
    reject(
      'COUPON_MIN_AMOUNT',
      `This coupon requires a minimum amount of ${toDecimal(coupon.minAmount).toFixed(2)}.`
    );
  }

  if (coupon.usageLimit !== null && coupon.timesUsed >= coupon.usageLimit) {
    reject('COUPON_LIMIT_REACHED', 'This coupon has reached its usage limit.');
  }

  const discount =
    coupon.discountType === 'PERCENTAGE'
      ? percentOf(subtotal, coupon.discountValue)
      : round2(coupon.discountValue);

  // Never discount below zero.
  return discount.greaterThan(toDecimal(subtotal)) ? round2(subtotal) : discount;
}

/**
 * The one place the SRS §5.3 arithmetic lives:
 *
 *   Subtotal → minus Discount → plus Tax → Total
 *
 * Bookings and orders differ only in how the subtotal is arrived at, which
 * coupon applicability applies, and which tax rate is charged.
 *
 * `taxPercent` is passed in rather than read from config: rates are a database
 * setting now (SRS §9), and keeping this function pure means the calculation
 * stays testable without a database (CLAUDE.md §7).
 */
function applyDiscountAndTax(subtotal, { coupon, applicability, taxPercent, at }) {
  const gross = round2(subtotal);

  const discountAmount = couponDiscount(coupon, gross, { applicability, at });

  const discounted = clampZero(gross.minus(discountAmount));

  // Tax applies to the discounted amount, never the gross (SRS §5.3).
  const taxAmount = percentOf(discounted, taxPercent);

  return {
    subtotal: gross,
    discountAmount: round2(discountAmount),
    taxAmount,
    totalAmount: round2(discounted.plus(taxAmount)),
  };
}

/**
 * Prices a booking.
 *
 * @param {number} taxPercent room tax rate; defaults to the environment value
 *   so a caller without database settings still prices correctly.
 * @returns {{subtotal, discountAmount, taxAmount, totalAmount}} all Decimal
 */
function priceBooking({
  roomType,
  duration,
  coupon = null,
  taxPercent = config.roomTaxPercent,
  at = new Date(),
}) {
  return applyDiscountAndTax(rateFor(roomType, duration), {
    coupon,
    applicability: 'ROOMS',
    taxPercent,
    at,
  });
}

/**
 * Prices a food order (SRS §5.3 — same arithmetic as a booking, but against the
 * food tax rate and FOOD coupon applicability).
 *
 * `lines` carries the per-item figures the caller persists on order_items, so
 * the unit price charged is locked at order time and never recomputed from the
 * current menu.
 *
 * @param {{food: object, quantity: number}[]} items
 * @returns {{subtotal, discountAmount, taxAmount, totalAmount, lines}}
 */
function priceOrder({
  items,
  coupon = null,
  taxPercent = config.foodTaxPercent,
  at = new Date(),
}) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Please correct the highlighted fields.', {
      items: 'An order needs at least one item.',
    });
  }

  const lines = items.map(({ food, quantity, specialInstructions = null }) => {
    const unitPrice = round2(food.price);
    return {
      foodId: food.foodId,
      name: food.name,
      quantity,
      unitPrice,
      subtotal: round2(unitPrice.times(quantity)),
      specialInstructions,
    };
  });

  const subtotal = lines.reduce((sum, line) => sum.plus(line.subtotal), ZERO);

  return {
    ...applyDiscountAndTax(subtotal, { coupon, applicability: 'FOOD', taxPercent, at }),
    lines,
  };
}

module.exports = {
  priceBooking,
  priceOrder,
  applyDiscountAndTax,
  rateFor,
  couponDiscount,
  DURATION_RATE_FIELD,
};
