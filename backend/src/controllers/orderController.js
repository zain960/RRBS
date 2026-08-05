const orderService = require('../services/orderService');
const paymentService = require('../services/paymentService');
const { ok, AppError, asyncHandler } = require('../lib/http');
const { Validator, parseId } = require('../lib/validate');
const config = require('../lib/config');

const { ORDER_TYPES, ORDER_STATUSES } = orderService;

/** Staff who may see and act on any customer's order (SRS §5.4). */
const ORDER_STAFF_ROLES = [
  'Super Admin',
  'Manager',
  'Receptionist',
  'Waiter',
  'Kitchen Staff',
];

function isStaff(auth) {
  return auth?.accountType === 'staff' && ORDER_STAFF_ROLES.includes(auth.roleName);
}

/** Customers may only read their own orders (SRS §5.4). */
function assertCanView(auth, order) {
  if (isStaff(auth)) return;
  if (auth.accountType === 'customer' && order.customer?.id === auth.userId) return;
  throw new AppError(403, 'FORBIDDEN', 'You can only view your own orders.');
}

/**
 * Normalises the items array. Accepts snake_case from the API contract and
 * camelCase from the frontend client.
 */
function parseItems(raw) {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Please correct the highlighted fields.', {
      items: 'An order needs at least one item.',
    });
  }

  // Validate every line before failing, so the client can highlight all the bad
  // rows at once rather than one per round trip.
  const errors = {};
  const items = [];

  raw.forEach((entry, index) => {
    const source = entry ?? {};
    try {
      const { foodId, quantity, specialInstructions } = new Validator({
        foodId: source.food_id ?? source.foodId,
        quantity: source.quantity,
        specialInstructions: source.special_instructions ?? source.specialInstructions,
      })
        .integer('foodId', { min: 1, label: 'Menu item' })
        .integer('quantity', { min: 1, max: 99, label: 'Quantity' })
        .string('specialInstructions', { required: false, max: 255, label: 'Special instructions' })
        .result();

      items.push({ foodId, quantity, specialInstructions: specialInstructions ?? null });
    } catch (err) {
      if (err.code !== 'VALIDATION_ERROR') throw err;
      for (const [field, message] of Object.entries(err.details ?? {})) {
        errors[`items.${index}.${field}`] = message;
      }
    }
  });

  if (Object.keys(errors).length > 0) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Please correct the highlighted fields.', errors);
  }

  return items;
}

/** POST /api/orders */
const create = asyncHandler(async (req, res) => {
  const body = req.body ?? {};

  const { orderType, tableId, bookingId, customerId, deliveryAddress } = new Validator({
    orderType: body.order_type ?? body.orderType,
    tableId: body.table_id ?? body.tableId,
    bookingId: body.booking_id ?? body.bookingId,
    customerId: body.customer_id ?? body.customerId,
    deliveryAddress: body.delivery_address ?? body.deliveryAddress,
  })
    .enum('orderType', ORDER_TYPES, { label: 'Order type' })
    .integer('tableId', { required: false, min: 1, label: 'Table' })
    .integer('bookingId', { required: false, min: 1, label: 'Booking' })
    .integer('customerId', { required: false, min: 1, label: 'Customer' })
    .string('deliveryAddress', { required: false, max: 255, label: 'Delivery address' })
    .result();

  const items = parseItems(body.items);

  // A customer always orders for themselves; staff order on a guest's behalf.
  let orderCustomerId;
  if (req.auth.accountType === 'customer') {
    orderCustomerId = req.auth.userId;
  } else if (isStaff(req.auth)) {
    if (!customerId) {
      throw new AppError(422, 'VALIDATION_ERROR', 'Please correct the highlighted fields.', {
        customerId: 'Select the customer this order is for.',
      });
    }
    orderCustomerId = customerId;
  } else {
    throw new AppError(403, 'FORBIDDEN', 'Your role cannot place orders.');
  }

  const order = await orderService.create({
    customerId: orderCustomerId,
    orderType,
    items,
    tableId: tableId ?? null,
    bookingId: bookingId ?? null,
    deliveryAddress: deliveryAddress ?? null,
    couponCode: body.coupon_code ?? body.couponCode ?? null,
  });

  return ok(res, order, {}, 201);
});

/** GET /api/orders?status=&order_type=&kitchen_queue=true */
const list = asyncHandler(async (req, res) => {
  const q = req.query;

  const { page, pageSize, status, orderType, tableId, bookingId } = new Validator({
    page: q.page ?? 1,
    pageSize: q.pageSize ?? q.page_size ?? config.defaultPageSize,
    status: q.status,
    orderType: q.order_type ?? q.orderType,
    tableId: q.table_id ?? q.tableId,
    bookingId: q.booking_id ?? q.bookingId,
  })
    .integer('page', { min: 1, label: 'Page' })
    .integer('pageSize', { min: 1, max: config.maxPageSize, label: 'Page size' })
    .enum('status', ORDER_STATUSES, { required: false, label: 'Status' })
    .enum('orderType', ORDER_TYPES, { required: false, label: 'Order type' })
    .integer('tableId', { required: false, min: 1, label: 'Table' })
    .integer('bookingId', { required: false, min: 1, label: 'Booking' })
    .result();

  const kitchenQueue = String(q.kitchen_queue ?? q.kitchenQueue ?? '') === 'true';

  // Customers see only their own orders (SRS §5.4).
  const customerId = isStaff(req.auth)
    ? q.customerId || q.customer_id
      ? parseId(q.customerId ?? q.customer_id, 'customer id')
      : undefined
    : req.auth.userId;

  const result = await orderService.list({
    status: status ?? undefined,
    orderType: orderType ?? undefined,
    tableId: tableId ?? undefined,
    bookingId: bookingId ?? undefined,
    customerId,
    kitchenQueue,
    page,
    pageSize,
  });

  return ok(res, result.orders, { ...result.meta, kitchenQueue });
});

/** GET /api/orders/:id */
const getById = asyncHandler(async (req, res) => {
  const order = await orderService.getById(parseId(req.params.id, 'order id'));
  assertCanView(req.auth, order);
  return ok(res, order);
});

/**
 * PATCH /api/orders/:id/status
 *
 * Which role may make which transition is decided in the service, because it
 * depends on the target status rather than the endpoint (SRS §3).
 */
const updateStatus = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'order id');

  const { status } = new Validator(req.body ?? {})
    .enum('status', ORDER_STATUSES, { label: 'Status' })
    .result();

  const order = await orderService.updateStatus(id, status, {
    roleName: req.auth.roleName,
  });

  return ok(res, order);
});

/** GET /api/orders/room-service-bookings — the caller's checked-in stays. */
const roomServiceBookings = asyncHandler(async (req, res) => {
  const customerId =
    req.auth.accountType === 'customer'
      ? req.auth.userId
      : parseId(req.query.customerId ?? req.query.customer_id, 'customer id');

  const bookings = await orderService.roomServiceBookings(customerId);
  return ok(res, bookings, { total: bookings.length });
});

/** POST /api/orders/:id/payments */
const addPayment = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'order id');
  const body = req.body ?? {};

  const { amount, method, paymentType } = new Validator({
    amount: body.amount,
    method: body.method,
    paymentType: body.payment_type ?? body.paymentType ?? 'FULL',
  })
    .money('amount', { required: true, min: 0, label: 'Amount' })
    .enum('method', paymentService.METHODS, { label: 'Payment method' })
    .enum('paymentType', paymentService.TYPES, { label: 'Payment type' })
    .result();

  const existing = await orderService.getById(id);
  assertCanView(req.auth, existing);

  const result = await paymentService.recordForOrder(id, {
    amount,
    method,
    paymentType,
    transactionRef: body.transaction_ref ?? body.transactionRef ?? null,
  });

  return ok(res, result, {}, 201);
});

/** GET /api/orders/:id/payments */
const listPayments = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'order id');
  const existing = await orderService.getById(id);
  assertCanView(req.auth, existing);

  const payments = await paymentService.listForOrder(id);
  return ok(res, payments, { total: payments.length });
});

module.exports = {
  create,
  list,
  getById,
  updateStatus,
  roomServiceBookings,
  addPayment,
  listPayments,
};
