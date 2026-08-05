/**
 * System settings (SRS §9 — Tax Settings screen).
 *
 * One row, id 1. Tax rates live here rather than in the environment so the
 * client can change them without a deploy (CLAUDE.md §7). The environment
 * values remain the seed defaults for a database that has never been
 * configured.
 *
 * Changing a rate must never alter an already-confirmed booking or order —
 * those store the tax they were charged (CLAUDE.md §4). Pricing reads the
 * current rate only at the moment it prices something new.
 */
const prisma = require('../lib/prisma');
const { AppError } = require('../lib/http');
const config = require('../lib/config');
const { toDecimal } = require('../lib/money');

const SINGLE_ROW_ID = 1;

function publicSettings(setting) {
  return {
    roomTaxRate: String(setting.roomTaxRate),
    foodTaxRate: String(setting.foodTaxRate),
    updatedBy: setting.updatedBy ?? null,
    updatedByName: setting.updatedByUser ? setting.updatedByUser.fullName : null,
    updatedAt: setting.updatedAt,
  };
}

/**
 * Reads the settings row, creating it from the environment defaults the first
 * time. Accepts a transaction client so pricing can read it inside the same
 * transaction that writes the booking or order.
 */
async function get(client = prisma) {
  const existing = await client.setting.findUnique({
    where: { settingId: SINGLE_ROW_ID },
    include: { updatedByUser: true },
  });

  if (existing) return publicSettings(existing);

  const created = await client.setting.create({
    data: {
      settingId: SINGLE_ROW_ID,
      roomTaxRate: String(config.roomTaxPercent),
      foodTaxRate: String(config.foodTaxPercent),
    },
  });

  return publicSettings(created);
}

/**
 * The two rates as plain numbers, for the pricing functions.
 * Pricing stays synchronous and pure — the caller loads the rates and passes
 * them in, so the calculation can be tested without a database (CLAUDE.md §7).
 */
async function taxRates(client = prisma) {
  const settings = await get(client);
  return {
    roomTaxPercent: Number(settings.roomTaxRate),
    foodTaxPercent: Number(settings.foodTaxRate),
  };
}

async function update({ roomTaxRate, foodTaxRate, updatedBy = null }) {
  // A tax rate is a percentage: negative makes no sense, and 100%+ is far more
  // likely to be a typo than a real rate.
  for (const [field, value] of Object.entries({ roomTaxRate, foodTaxRate })) {
    if (value === undefined) continue;
    const rate = toDecimal(value);
    if (rate.lessThan(0) || rate.greaterThan(100)) {
      throw new AppError(422, 'VALIDATION_ERROR', 'Please correct the highlighted fields.', {
        [field]: 'Tax rate must be between 0 and 100.',
      });
    }
  }

  await get(); // make sure the row exists before updating it

  const updated = await prisma.setting.update({
    where: { settingId: SINGLE_ROW_ID },
    data: {
      ...(roomTaxRate === undefined ? {} : { roomTaxRate: String(roomTaxRate) }),
      ...(foodTaxRate === undefined ? {} : { foodTaxRate: String(foodTaxRate) }),
      updatedBy,
    },
    include: { updatedByUser: true },
  });

  return publicSettings(updated);
}

module.exports = { get, update, taxRates, SINGLE_ROW_ID };
