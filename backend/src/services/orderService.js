/**
 * Food ordering module (SRS §4.5, §5.2, Figure 2).
 *
 * Four order types converge on one menu and one kitchen queue, then diverge at
 * fulfilment:
 *
 *   Placed -> Preparing -> Ready -> Served        (Dine-in)
 *                               -> Picked Up      (Takeaway)
 *                               -> Dispatched -> Delivered   (Delivery)
 *                               -> Billed to Room (Room Service)
 *
 * Cancelled is reachable while the food has not been cooked yet.
 */
const prisma = require('../lib/prisma');
const { AppError } = require('../lib/http');
const config = require('../lib/config');
const { toDecimal, toMoneyString, ZERO } = require('../lib/money');
const { priceOrder } = require('./pricingService');
const couponService = require('./couponService');
const notificationService = require('./notificationService');
const settingsService = require('./settingsService');

const ORDER_TYPES = ['DINE_IN', 'TAKEAWAY', 'DELIVERY', 'ROOM_SERVICE'];

const ORDER_STATUSES = [
  'PLACED',
  'PREPARING',
  'READY',
  'SERVED',
  'PICKED_UP',
  'DISPATCHED',
  'DELIVERED',
  'BILLED_TO_ROOM',
  'CANCELLED',
];

const STATUS_LABELS = {
  PLACED: 'Placed',
  PREPARING: 'Preparing',
  READY: 'Ready',
  SERVED: 'Served',
  PICKED_UP: 'Picked Up',
  DISPATCHED: 'Dispatched',
  DELIVERED: 'Delivered',
  BILLED_TO_ROOM: 'Billed to Room',
  CANCELLED: 'Cancelled',
};

const TYPE_LABELS = {
  DINE_IN: 'Dine-in',
  TAKEAWAY: 'Takeaway',
  DELIVERY: 'Delivery',
  ROOM_SERVICE: 'Room Service',
};

/** Orders the kitchen still has work to do on (SRS §4.5 — live queue). */
const KITCHEN_QUEUE_STATUSES = ['PLACED', 'PREPARING'];

/** Orders that still hold a dine-in table or block a booking checkout. */
const OPEN_STATUSES = ['PLACED', 'PREPARING', 'READY', 'DISPATCHED'];

/**
 * Fulfilment differs per order type, so the step out of Ready does too
 * (Figure 2). Everything up to Ready is shared.
 */
const TERMINAL_FROM_READY = {
  DINE_IN: ['SERVED'],
  TAKEAWAY: ['PICKED_UP'],
  DELIVERY: ['DISPATCHED'],
  ROOM_SERVICE: ['BILLED_TO_ROOM'],
};

/**
 * Which roles may move an order into a given status (SRS §3, §5.4).
 *
 * Super Admin holds '*' in the seeded permissions and is allowed everywhere.
 * Note that a Manager cannot mark an order Preparing or Ready — the SRS gives
 * those to the kitchen. Widen these lists here if the client wants managers to
 * be able to cover the pass.
 */
const TRANSITION_ROLES = {
  PREPARING: ['Kitchen Staff', 'Super Admin'],
  READY: ['Kitchen Staff', 'Super Admin'],
  SERVED: ['Waiter', 'Super Admin'],
  PICKED_UP: ['Waiter', 'Super Admin'],
  DISPATCHED: ['Manager', 'Receptionist', 'Super Admin'],
  DELIVERED: ['Manager', 'Receptionist', 'Super Admin'],
  BILLED_TO_ROOM: ['Manager', 'Receptionist', 'Super Admin'],
  CANCELLED: ['Waiter', 'Manager', 'Receptionist', 'Super Admin'],
};

/** Statuses reachable from the current one, for this order type. */
function allowedNext(order) {
  switch (order.status) {
    case 'PLACED':
      return ['PREPARING', 'CANCELLED'];
    case 'PREPARING':
      return ['READY', 'CANCELLED'];
    case 'READY':
      return TERMINAL_FROM_READY[order.orderType] ?? [];
    case 'DISPATCHED':
      return ['DELIVERED'];
    default:
      // Served, Picked Up, Delivered, Billed to Room and Cancelled are final.
      return [];
  }
}

function assertTransition(order, next) {
  const allowed = allowedNext(order);

  if (!allowed.includes(next)) {
    throw new AppError(
      409,
      'INVALID_STATUS_TRANSITION',
      `A ${STATUS_LABELS[order.status]} ${TYPE_LABELS[order.orderType]} order cannot be moved to ${
        STATUS_LABELS[next]
      }.`,
      { from: order.status, to: next, orderType: order.orderType, allowed }
    );
  }
}

/**
 * Role gate for a transition. Enforced here rather than on the route because
 * the permitted role depends on the target status, not on the endpoint
 * (CLAUDE.md §4 — transitions are validated centrally).
 */
function assertRoleMayTransition(roleName, next) {
  const allowedRoles = TRANSITION_ROLES[next] ?? [];

  if (!allowedRoles.includes(roleName)) {
    throw new AppError(
      403,
      'FORBIDDEN',
      `Your role cannot mark an order ${STATUS_LABELS[next]}.`,
      { requiredRoles: allowedRoles, yourRole: roleName, targetStatus: next }
    );
  }
}

function publicOrder(order) {
  return {
    id: order.orderId,
    orderType: order.orderType,
    orderTypeLabel: TYPE_LABELS[order.orderType],
    status: order.status,
    statusLabel: STATUS_LABELS[order.status],
    allowedNext: allowedNext(order),
    deliveryAddress: order.deliveryAddress,
    pricing: {
      subtotal: toMoneyString(order.subtotal),
      discountAmount: toMoneyString(order.discountAmount),
      taxAmount: toMoneyString(order.taxAmount),
      totalAmount: toMoneyString(order.totalAmount),
    },
    customer: order.customer
      ? {
          id: order.customer.customerId,
          fullName: order.customer.fullName,
          phone: order.customer.phone,
        }
      : null,
    table: order.table
      ? {
          id: order.table.tableId,
          tableNumber: order.table.tableNumber,
          status: order.table.status,
        }
      : null,
    booking: order.booking
      ? {
          id: order.booking.bookingId,
          status: order.booking.status,
          room: order.booking.room
            ? { id: order.booking.room.roomId, roomNumber: order.booking.room.roomNumber }
            : undefined,
        }
      : null,
    coupon: order.coupon ? { id: order.coupon.couponId, code: order.coupon.code } : null,
    items: order.orderItems
      ? order.orderItems.map((item) => ({
          id: item.orderItemId,
          foodId: item.foodId,
          name: item.food ? item.food.name : undefined,
          quantity: item.quantity,
          unitPrice: toMoneyString(item.unitPrice),
          subtotal: toMoneyString(item.subtotal),
          specialInstructions: item.specialInstructions,
        }))
      : undefined,
    payments: order.payments
      ? order.payments.map((p) => ({
          id: p.paymentId,
          amount: toMoneyString(p.amount),
          method: p.method,
          paymentType: p.paymentType,
          status: p.status,
          paidAt: p.paidAt,
        }))
      : undefined,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

const FULL_INCLUDE = {
  customer: true,
  table: true,
  booking: { include: { room: true } },
  coupon: true,
  orderItems: { include: { food: true }, orderBy: { orderItemId: 'asc' } },
  payments: { orderBy: { paidAt: 'asc' } },
};

/** Completed payments against an order, minus refunds. */
function paidTotal(payments = []) {
  return payments
    .filter((p) => p.status === 'COMPLETED')
    .reduce(
      (sum, p) =>
        p.paymentType === 'REFUND' ? sum.minus(toDecimal(p.amount)) : sum.plus(toDecimal(p.amount)),
      ZERO
    );
}

/** True once the order has been paid in full. */
function isSettled(order) {
  return paidTotal(order.payments).greaterThanOrEqualTo(toDecimal(order.totalAmount));
}

/** Shared with the booking module — see couponService.loadByCode. */
async function loadCoupon(client, code) {
  if (!code) return null;

  const coupon = await couponService.loadByCode(client, code);
  if (!coupon) {
    throw new AppError(422, 'COUPON_NOT_FOUND', 'That coupon code is not recognised.', {
      couponCode: 'Unknown coupon code.',
    });
  }

  return coupon;
}

// ---------------------------------------------------------------------------
// Create (SRS §5.2)
// ---------------------------------------------------------------------------

/** Loads the requested menu items and rejects anything missing or unavailable. */
async function loadItems(tx, items) {
  const foodIds = [...new Set(items.map((item) => item.foodId))];

  const foods = await tx.food.findMany({ where: { foodId: { in: foodIds } } });
  const byId = new Map(foods.map((food) => [food.foodId, food]));

  const missing = foodIds.filter((id) => !byId.has(id));
  if (missing.length > 0) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Please correct the highlighted fields.', {
      items: `Unknown menu item(s): ${missing.join(', ')}.`,
    });
  }

  // An item marked unavailable cannot be added to a new order, even though it
  // still appears on historical orders (SRS §5.2).
  const unavailable = foods.filter((food) => food.availabilityStatus !== 'AVAILABLE');
  if (unavailable.length > 0) {
    throw new AppError(
      409,
      'FOOD_UNAVAILABLE',
      `Currently unavailable: ${unavailable.map((f) => f.name).join(', ')}.`,
      { unavailable: unavailable.map((f) => ({ id: f.foodId, name: f.name })) }
    );
  }

  return items.map((item) => ({
    food: byId.get(item.foodId),
    quantity: item.quantity,
    specialInstructions: item.specialInstructions ?? null,
  }));
}

/**
 * Dine-in: the table must be Free, or already held by this same customer
 * (SRS §5.2). A table occupied by somebody else's open order is rejected.
 *
 * The row is locked FOR UPDATE first so two waiters cannot seat two parties at
 * the same table concurrently.
 */
async function claimTable(tx, tableId, customerId) {
  const locked = await tx.$queryRaw`
    SELECT table_id FROM dining_tables WHERE table_id = ${tableId} FOR UPDATE
  `;
  if (locked.length === 0) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Please correct the highlighted fields.', {
      tableId: 'Unknown table.',
    });
  }

  const table = await tx.diningTable.findUnique({ where: { tableId } });

  const openOrders = await tx.order.findMany({
    where: { tableId, status: { in: OPEN_STATUSES } },
    select: { orderId: true, customerId: true },
  });

  const heldByOthers = openOrders.filter((order) => order.customerId !== customerId);

  if (heldByOthers.length > 0) {
    throw new AppError(
      409,
      'TABLE_OCCUPIED',
      `Table ${table.tableNumber} is occupied by another order.`,
      {
        tableNumber: table.tableNumber,
        conflictingOrderIds: heldByOthers.map((o) => o.orderId),
      }
    );
  }

  // Occupied with no open order means the floor status is stale, not that the
  // table is genuinely taken — the open-order check above is the real test.
  if (table.status === 'OCCUPIED' && openOrders.length === 0) {
    throw new AppError(
      409,
      'TABLE_OCCUPIED',
      `Table ${table.tableNumber} is marked Occupied. Free it before taking a new order.`,
      { tableNumber: table.tableNumber }
    );
  }

  return table;
}

/**
 * Room Service is permitted only while the booking is Checked-in (SRS §5.2).
 * The booking must also belong to the customer the order is being placed for.
 */
async function assertRoomServiceAllowed(tx, bookingId, customerId) {
  const booking = await tx.booking.findUnique({
    where: { bookingId },
    include: { room: true },
  });

  if (!booking) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Please correct the highlighted fields.', {
      bookingId: 'Unknown booking.',
    });
  }

  if (booking.status !== 'CHECKED_IN') {
    throw new AppError(
      409,
      'BOOKING_NOT_CHECKED_IN',
      'Room service is only available while the booking is Checked-in.',
      { bookingId, bookingStatus: booking.status }
    );
  }

  if (booking.customerId !== customerId) {
    throw new AppError(
      403,
      'FORBIDDEN',
      'That booking belongs to a different customer.',
      { bookingId }
    );
  }

  return booking;
}

/**
 * Places an order with its price locked in (SRS §5.3).
 *
 * Everything runs in one transaction: the availability check, the table claim
 * and the insert. A read-then-write outside a transaction would let two orders
 * claim the same table.
 */
async function create({
  customerId,
  orderType,
  items,
  tableId = null,
  bookingId = null,
  deliveryAddress = null,
  couponCode = null,
}) {
  return prisma.$transaction(async (tx) => {
    const customer = await tx.customer.findUnique({ where: { customerId } });
    if (!customer) {
      throw new AppError(422, 'VALIDATION_ERROR', 'Please correct the highlighted fields.', {
        customerId: 'Unknown customer.',
      });
    }

    const priced = await loadItems(tx, items);

    // Per-type requirements (SRS §5.2). The schema shape also demands that the
    // link columns stay null for the types they do not belong to (CLAUDE.md §5).
    let table = null;

    if (orderType === 'DINE_IN') {
      if (!tableId) {
        throw new AppError(422, 'VALIDATION_ERROR', 'Please correct the highlighted fields.', {
          tableId: 'A dine-in order must be linked to a table.',
        });
      }
      table = await claimTable(tx, tableId, customerId);
    } else if (tableId) {
      throw new AppError(422, 'VALIDATION_ERROR', 'Please correct the highlighted fields.', {
        tableId: 'Only a dine-in order can be linked to a table.',
      });
    }

    if (orderType === 'ROOM_SERVICE') {
      if (!bookingId) {
        throw new AppError(422, 'VALIDATION_ERROR', 'Please correct the highlighted fields.', {
          bookingId: 'A room-service order must be linked to a booking.',
        });
      }
      await assertRoomServiceAllowed(tx, bookingId, customerId);
    } else if (bookingId) {
      throw new AppError(422, 'VALIDATION_ERROR', 'Please correct the highlighted fields.', {
        bookingId: 'Only a room-service order can be linked to a booking.',
      });
    }

    if (orderType === 'DELIVERY' && !deliveryAddress) {
      throw new AppError(422, 'VALIDATION_ERROR', 'Please correct the highlighted fields.', {
        deliveryAddress: 'A delivery order needs a delivery address.',
      });
    }

    const coupon = await loadCoupon(tx, couponCode);

    // Read inside the transaction so the rate charged is the one in force when
    // the order is written; the figures below are then locked (SRS §5.3).
    const { foodTaxPercent } = await settingsService.taxRates(tx);

    const pricing = priceOrder({ items: priced, coupon, taxPercent: foodTaxPercent });

    // Minimum order value for delivery — a client-configurable setting
    // (SRS §5.2, §10), tested against the pre-discount subtotal.
    if (orderType === 'DELIVERY' && config.deliveryMinAmount > 0) {
      const minimum = toDecimal(config.deliveryMinAmount);
      if (pricing.subtotal.lessThan(minimum)) {
        throw new AppError(
          422,
          'DELIVERY_MINIMUM_NOT_MET',
          `Delivery orders have a minimum of ${minimum.toFixed(2)}. This order is ${toMoneyString(
            pricing.subtotal
          )}.`,
          { minimum: minimum.toFixed(2), subtotal: toMoneyString(pricing.subtotal) }
        );
      }
    }

    const order = await tx.order.create({
      data: {
        customerId,
        orderType,
        tableId: orderType === 'DINE_IN' ? tableId : null,
        bookingId: orderType === 'ROOM_SERVICE' ? bookingId : null,
        couponId: coupon ? coupon.couponId : null,
        deliveryAddress: orderType === 'DELIVERY' ? deliveryAddress : null,
        status: 'PLACED',
        subtotal: pricing.subtotal.toFixed(2),
        discountAmount: pricing.discountAmount.toFixed(2),
        taxAmount: pricing.taxAmount.toFixed(2),
        totalAmount: pricing.totalAmount.toFixed(2),
        orderItems: {
          create: pricing.lines.map((line) => ({
            foodId: line.foodId,
            quantity: line.quantity,
            unitPrice: line.unitPrice.toFixed(2),
            subtotal: line.subtotal.toFixed(2),
            specialInstructions: line.specialInstructions,
          })),
        },
      },
      include: FULL_INCLUDE,
    });

    // The table becomes Occupied once the order is placed (SRS §5.2).
    if (table && table.status !== 'OCCUPIED') {
      await tx.diningTable.update({
        where: { tableId },
        data: { status: 'OCCUPIED' },
      });
    }

    const fresh = await tx.order.findUnique({
      where: { orderId: order.orderId },
      include: FULL_INCLUDE,
    });

    return publicOrder(fresh ?? order);
  });
}

// ---------------------------------------------------------------------------
// Status pipeline
// ---------------------------------------------------------------------------

/**
 * Frees a dine-in table once its order is finished and paid for.
 *
 * "Finished" is Served (or Cancelled); "paid for" is the full total settled in
 * payments. The table is only released when no other order still holds it.
 */
async function releaseTableIfSettled(tx, orderId) {
  const order = await tx.order.findUnique({
    where: { orderId },
    include: { payments: true },
  });

  if (!order || order.orderType !== 'DINE_IN' || !order.tableId) return;

  const finished = order.status === 'SERVED' || order.status === 'CANCELLED';
  if (!finished) return;

  // A cancelled order was never owed, so it frees the table on its own.
  if (order.status === 'SERVED' && !isSettled(order)) return;

  const stillOpen = await tx.order.count({
    where: {
      tableId: order.tableId,
      orderId: { not: orderId },
      status: { in: [...OPEN_STATUSES, 'SERVED'] },
    },
  });

  if (stillOpen > 0) return;

  await tx.diningTable.update({
    where: { tableId: order.tableId },
    data: { status: 'FREE' },
  });
}

/**
 * Moves an order along the pipeline (Figure 2).
 *
 * Both checks are enforced here so they hold for any caller, not just the HTTP
 * route: the transition must be legal for this order type, and the acting role
 * must be permitted to make it.
 */
async function updateStatus(orderId, next, { roleName }) {
  const outbox = [];

  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { orderId },
      include: { payments: true },
    });
    if (!order) throw new AppError(404, 'NOT_FOUND', 'Order not found.');

    assertTransition(order, next);
    assertRoleMayTransition(roleName, next);

    await tx.order.update({ where: { orderId }, data: { status: next } });

    // Serving settles the floor: free the table if the bill is paid.
    if (order.orderType === 'DINE_IN' && (next === 'SERVED' || next === 'CANCELLED')) {
      await releaseTableIfSettled(tx, orderId);
    }

    const fresh = await tx.order.findUnique({ where: { orderId }, include: FULL_INCLUDE });

    // Labels are passed in rather than imported by the notification service —
    // the vocabulary of the order pipeline belongs here (SRS §4.5).
    await notificationService.notify(
      tx,
      'order.status_changed',
      {
        order: fresh,
        statusLabel: STATUS_LABELS[next],
        previousLabel: STATUS_LABELS[order.status],
      },
      outbox
    );

    return publicOrder(fresh);
  });

  notificationService.deliverSoon(outbox);
  return result;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

async function list({
  status,
  orderType,
  customerId,
  tableId,
  bookingId,
  kitchenQueue = false,
  page = 1,
  pageSize,
} = {}) {
  const take = Math.min(pageSize || config.defaultPageSize, config.maxPageSize);
  const skip = (page - 1) * take;

  const where = {
    ...(status ? { status } : {}),
    ...(kitchenQueue && !status ? { status: { in: KITCHEN_QUEUE_STATUSES } } : {}),
    ...(orderType ? { orderType } : {}),
    ...(customerId ? { customerId } : {}),
    ...(tableId ? { tableId } : {}),
    ...(bookingId ? { bookingId } : {}),
  };

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: FULL_INCLUDE,
      // The kitchen works oldest-first; everyone else wants the newest on top.
      orderBy: { createdAt: kitchenQueue ? 'asc' : 'desc' },
      skip,
      take,
    }),
    prisma.order.count({ where }),
  ]);

  return {
    orders: orders.map(publicOrder),
    meta: {
      page,
      pageSize: take,
      total,
      totalPages: Math.max(1, Math.ceil(total / take)),
    },
  };
}

async function getById(orderId) {
  const order = await prisma.order.findUnique({
    where: { orderId },
    include: FULL_INCLUDE,
  });
  if (!order) throw new AppError(404, 'NOT_FOUND', 'Order not found.');
  return publicOrder(order);
}

/** Bookings this customer may currently order room service against (SRS §5.2). */
async function roomServiceBookings(customerId) {
  const bookings = await prisma.booking.findMany({
    where: { customerId, status: 'CHECKED_IN' },
    include: { room: true },
    orderBy: { checkInDatetime: 'desc' },
  });

  return bookings.map((booking) => ({
    id: booking.bookingId,
    status: booking.status,
    checkInDatetime: booking.checkInDatetime,
    checkOutDatetime: booking.checkOutDatetime,
    room: booking.room
      ? { id: booking.room.roomId, roomNumber: booking.room.roomNumber }
      : null,
  }));
}

module.exports = {
  create,
  updateStatus,
  list,
  getById,
  roomServiceBookings,
  releaseTableIfSettled,
  allowedNext,
  assertTransition,
  assertRoleMayTransition,
  isSettled,
  paidTotal,
  publicOrder,
  FULL_INCLUDE,
  ORDER_TYPES,
  ORDER_STATUSES,
  STATUS_LABELS,
  TYPE_LABELS,
  TRANSITION_ROLES,
  KITCHEN_QUEUE_STATUSES,
  OPEN_STATUSES,
};
