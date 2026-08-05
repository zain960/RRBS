/**
 * Decimal money helpers.
 *
 * All currency arithmetic goes through Prisma.Decimal — never JS floats
 * (CLAUDE.md §3). Values are rounded to 2 decimal places, half-up, matching
 * Decimal(10,2) in the database.
 */
const { Prisma } = require('@prisma/client');

const { Decimal } = Prisma;

const ZERO = new Decimal(0);
const HUNDRED = new Decimal(100);

function toDecimal(value) {
  if (value === null || value === undefined || value === '') return new Decimal(0);
  return value instanceof Decimal ? value : new Decimal(String(value));
}

/** Rounds to 2dp, half-up — the rounding a printed bill uses. */
function round2(value) {
  return toDecimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

/** Applies a percentage, e.g. percentOf(5400, 15) -> 810.00 */
function percentOf(amount, percent) {
  return round2(toDecimal(amount).times(toDecimal(percent)).dividedBy(HUNDRED));
}

/** Serialises for JSON as a fixed 2dp string, never a float. */
function toMoneyString(value) {
  return round2(value).toFixed(2);
}

/** Clamps at zero — a discount must never produce a negative subtotal. */
function clampZero(value) {
  const decimal = toDecimal(value);
  return decimal.lessThan(ZERO) ? ZERO : decimal;
}

module.exports = { Decimal, toDecimal, round2, percentOf, toMoneyString, clampZero, ZERO };
