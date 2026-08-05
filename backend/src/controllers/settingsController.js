const settingsService = require('../services/settingsService');
const { ok, asyncHandler } = require('../lib/http');
const { Validator } = require('../lib/validate');

/**
 * GET /api/settings/tax — public.
 * Who last changed the rates is staff detail, so it is withheld from anonymous
 * callers; the rates themselves appear on every receipt.
 */
const getTax = asyncHandler(async (req, res) => {
  const settings = await settingsService.get();
  const isStaff = req.auth?.accountType === 'staff';

  return ok(res, {
    roomTaxRate: settings.roomTaxRate,
    foodTaxRate: settings.foodTaxRate,
    ...(isStaff ? { updatedBy: settings.updatedByName, updatedAt: settings.updatedAt } : {}),
  });
});

/** PUT /api/settings/tax */
const updateTax = asyncHandler(async (req, res) => {
  const body = req.body ?? {};

  // Rates are percentages stored as Decimal(5,2) — validated as money so they
  // never travel through a JS float.
  const { roomTaxRate, foodTaxRate } = new Validator({
    roomTaxRate: body.room_tax_rate ?? body.roomTaxRate,
    foodTaxRate: body.food_tax_rate ?? body.foodTaxRate,
  })
    .money('roomTaxRate', { required: true, min: 0, label: 'Room tax rate' })
    .money('foodTaxRate', { required: true, min: 0, label: 'Food tax rate' })
    .result();

  const settings = await settingsService.update({
    roomTaxRate,
    foodTaxRate,
    updatedBy: req.auth.accountType === 'staff' ? req.auth.userId : null,
  });

  return ok(res, {
    roomTaxRate: settings.roomTaxRate,
    foodTaxRate: settings.foodTaxRate,
    updatedBy: settings.updatedByName,
    updatedAt: settings.updatedAt,
  });
});

module.exports = { getTax, updateTax };
