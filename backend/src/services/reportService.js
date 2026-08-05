/**
 * Reports (SRS §4.11).
 *
 * Every report takes a date range and returns `{ columns, rows, summary }` —
 * one shape, so the CSV serialiser and the report table both work off the same
 * description without knowing which report they are rendering.
 *
 * Two bases are used, and the difference matters:
 *
 *   billed    — what was charged, read from bookings/orders. These carry the
 *               figures locked at confirmation (CLAUDE.md §4).
 *   collected — what was actually taken, read from payments, net of refunds.
 *
 * They diverge whenever a bill is unpaid or partly paid, so the revenue report
 * reports both rather than picking one and calling it "revenue".
 */
const prisma = require('../lib/prisma');
const { AppError } = require('../lib/http');
const { toDecimal, toMoneyString, round2, ZERO } = require('../lib/money');
const { REVENUE_BOOKING_STATUSES } = require('./dashboardService');

/** Orders that represent real business — a cancelled order was never sold. */
const REVENUE_ORDER_STATUSES = [
  'PLACED',
  'PREPARING',
  'READY',
  'SERVED',
  'PICKED_UP',
  'DISPATCHED',
  'DELIVERED',
  'BILLED_TO_ROOM',
];

const BOOKING_STATUS_LABELS = {
  PENDING: 'Pending',
  CONFIRMED: 'Confirmed',
  CHECKED_IN: 'Checked-in',
  CHECKED_OUT: 'Checked-out',
  CANCELLED: 'Cancelled',
  NO_SHOW: 'No-show',
};

const ORDER_TYPE_LABELS = {
  DINE_IN: 'Dine-in',
  TAKEAWAY: 'Takeaway',
  DELIVERY: 'Delivery',
  ROOM_SERVICE: 'Room Service',
};

const PAYMENT_METHOD_LABELS = { CASH: 'Cash', CARD: 'Card', ONLINE: 'Online' };

/**
 * Resolves the requested window. Defaults to the last 30 days, and `to` is
 * pushed to the end of its day so a same-day range is not empty.
 */
function resolveRange({ from, to } = {}) {
  const end = to ? new Date(to) : new Date();
  end.setHours(23, 59, 59, 999);

  const start = from ? new Date(from) : new Date(end.getTime() - 29 * 24 * 60 * 60 * 1000);
  start.setHours(0, 0, 0, 0);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Please correct the highlighted fields.', {
      from: 'From and to must be valid dates.',
    });
  }

  if (start > end) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Please correct the highlighted fields.', {
      to: 'The end of the range must not precede its start.',
    });
  }

  return { from: start, to: end };
}

/** Sums a Decimal column across rows. */
function sumOf(rows, field) {
  return rows.reduce((total, row) => total.plus(toDecimal(row[field])), ZERO);
}

/** Completed payments minus refunds. */
function netOf(payments) {
  return payments.reduce(
    (total, payment) =>
      payment.paymentType === 'REFUND'
        ? total.minus(toDecimal(payment.amount))
        : total.plus(toDecimal(payment.amount)),
    ZERO
  );
}

/** Groups rows by a key function, returning a Map preserving insertion order. */
function groupBy(rows, keyFn) {
  const groups = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return groups;
}

function pct(part, whole) {
  const total = toDecimal(whole);
  if (total.lessThanOrEqualTo(ZERO)) return '0.00';
  return round2(toDecimal(part).dividedBy(total).times(100)).toFixed(2);
}

// ---------------------------------------------------------------------------
// Booking Report — bookings by status, room type and duration (SRS §4.11)
// ---------------------------------------------------------------------------

async function bookingsReport(range) {
  const { from, to } = resolveRange(range);

  const bookings = await prisma.booking.findMany({
    where: { checkInDatetime: { gte: from, lte: to } },
    include: { room: { include: { roomType: true } }, duration: true },
    orderBy: { checkInDatetime: 'asc' },
  });

  const dimension = (label, groups) =>
    [...groups.entries()].map(([key, rows]) => ({
      dimension: label,
      value: key,
      bookings: rows.length,
      revenue: toMoneyString(sumOf(rows, 'totalAmount')),
      share: pct(rows.length, bookings.length),
    }));

  const rows = [
    ...dimension(
      'Status',
      groupBy(bookings, (b) => BOOKING_STATUS_LABELS[b.status] ?? b.status)
    ),
    ...dimension(
      'Room type',
      groupBy(bookings, (b) => b.room?.roomType?.typeName ?? 'Unknown')
    ),
    ...dimension(
      'Duration',
      groupBy(bookings, (b) => b.duration?.durationName ?? 'Unknown')
    ),
  ];

  return {
    columns: [
      { key: 'dimension', header: 'Grouped by' },
      { key: 'value', header: 'Value' },
      { key: 'bookings', header: 'Bookings' },
      { key: 'revenue', header: 'Billed' },
      { key: 'share', header: 'Share %' },
    ],
    rows,
    summary: {
      from,
      to,
      totalBookings: bookings.length,
      totalBilled: toMoneyString(sumOf(bookings, 'totalAmount')),
    },
  };
}

// ---------------------------------------------------------------------------
// Occupancy Report — room utilisation per day (SRS §4.11)
// ---------------------------------------------------------------------------

/**
 * Utilisation per day = rooms occupied that day / rooms in service that day.
 *
 * A room counts as occupied on a day if a Confirmed, Checked-in or Checked-out
 * booking overlaps any part of it — the same half-open overlap test the booking
 * engine uses (SRS §5.1), so the report agrees with what the desk could sell.
 *
 * Rooms under maintenance are excluded from the denominator: they were never
 * sellable, and counting them would understate utilisation. Maintenance status
 * is current rather than historical, so this is approximate for past dates —
 * the schema keeps no history of when a room went out of service.
 */
async function occupancyReport(range) {
  const { from, to } = resolveRange(range);

  const [rooms, bookings] = await Promise.all([
    prisma.room.findMany({ select: { roomId: true, status: true } }),
    prisma.booking.findMany({
      where: {
        status: { in: REVENUE_BOOKING_STATUSES },
        checkInDatetime: { lte: to },
        checkOutDatetime: { gte: from },
      },
      select: { roomId: true, checkInDatetime: true, checkOutDatetime: true },
    }),
  ]);

  const sellableRooms = rooms.filter((room) => room.status !== 'MAINTENANCE').length;

  const rows = [];
  const cursor = new Date(from);

  while (cursor <= to) {
    const dayStart = new Date(cursor);
    const dayEnd = new Date(cursor);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const occupiedRoomIds = new Set(
      bookings
        .filter((b) => b.checkInDatetime < dayEnd && b.checkOutDatetime > dayStart)
        .map((b) => b.roomId)
    );

    rows.push({
      date: dayStart.toISOString().slice(0, 10),
      roomsOccupied: occupiedRoomIds.size,
      roomsAvailable: sellableRooms,
      utilisation: pct(occupiedRoomIds.size, sellableRooms),
    });

    cursor.setDate(cursor.getDate() + 1);
  }

  const averageUtilisation =
    rows.length > 0
      ? round2(
          rows.reduce((sum, row) => sum.plus(toDecimal(row.utilisation)), ZERO).dividedBy(rows.length)
        ).toFixed(2)
      : '0.00';

  return {
    columns: [
      { key: 'date', header: 'Date' },
      { key: 'roomsOccupied', header: 'Rooms occupied' },
      { key: 'roomsAvailable', header: 'Rooms in service' },
      { key: 'utilisation', header: 'Utilisation %' },
    ],
    rows,
    summary: {
      from,
      to,
      days: rows.length,
      roomsInService: sellableRooms,
      totalRooms: rooms.length,
      averageUtilisation,
    },
  };
}

// ---------------------------------------------------------------------------
// Revenue Report — rooms vs food, taxes and discounts (SRS §4.11)
// ---------------------------------------------------------------------------

async function revenueReport(range) {
  const { from, to } = resolveRange(range);
  const window = { gte: from, lte: to };

  const [bookings, orders, payments] = await Promise.all([
    prisma.booking.findMany({
      where: { createdAt: window, status: { in: REVENUE_BOOKING_STATUSES } },
      select: { subtotal: true, discountAmount: true, taxAmount: true, totalAmount: true },
    }),
    prisma.order.findMany({
      where: { createdAt: window, status: { in: REVENUE_ORDER_STATUSES } },
      select: { subtotal: true, discountAmount: true, taxAmount: true, totalAmount: true },
    }),
    prisma.payment.findMany({
      where: { paidAt: window, status: 'COMPLETED' },
      select: { amount: true, paymentType: true, bookingId: true, orderId: true },
    }),
  ]);

  const collectedRooms = netOf(payments.filter((p) => p.bookingId !== null));
  const collectedFood = netOf(
    payments.filter((p) => p.bookingId === null && p.orderId !== null)
  );

  const line = (label, records, collected) => ({
    stream: label,
    count: records.length,
    subtotal: toMoneyString(sumOf(records, 'subtotal')),
    discount: toMoneyString(sumOf(records, 'discountAmount')),
    tax: toMoneyString(sumOf(records, 'taxAmount')),
    billed: toMoneyString(sumOf(records, 'totalAmount')),
    collected: toMoneyString(collected),
  });

  const rooms = line('Rooms', bookings, collectedRooms);
  const food = line('Food', orders, collectedFood);

  const combined = {
    stream: 'Total',
    count: bookings.length + orders.length,
    subtotal: toMoneyString(sumOf([...bookings, ...orders], 'subtotal')),
    discount: toMoneyString(sumOf([...bookings, ...orders], 'discountAmount')),
    tax: toMoneyString(sumOf([...bookings, ...orders], 'taxAmount')),
    billed: toMoneyString(sumOf([...bookings, ...orders], 'totalAmount')),
    collected: toMoneyString(round2(collectedRooms.plus(collectedFood))),
  };

  return {
    columns: [
      { key: 'stream', header: 'Stream' },
      { key: 'count', header: 'Records' },
      { key: 'subtotal', header: 'Subtotal' },
      { key: 'discount', header: 'Discount' },
      { key: 'tax', header: 'Tax' },
      { key: 'billed', header: 'Billed' },
      { key: 'collected', header: 'Collected' },
    ],
    rows: [rooms, food, combined],
    summary: {
      from,
      to,
      // `collected` is the net of every completed payment in the window, so it
      // reconciles exactly against the payments table.
      collectedTotal: combined.collected,
      billedTotal: combined.billed,
      outstanding: toMoneyString(
        round2(toDecimal(combined.billed).minus(toDecimal(combined.collected)))
      ),
    },
  };
}

// ---------------------------------------------------------------------------
// Food Sales Report — best sellers, by category, by order type (SRS §4.11)
// ---------------------------------------------------------------------------

async function foodSalesReport(range) {
  const { from, to } = resolveRange(range);

  const items = await prisma.orderItem.findMany({
    where: {
      order: { createdAt: { gte: from, lte: to }, status: { in: REVENUE_ORDER_STATUSES } },
    },
    include: {
      food: { include: { category: true } },
      order: { select: { orderType: true } },
    },
  });

  const totalRevenue = sumOf(items, 'subtotal');
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);

  const summarise = (label, groups) =>
    [...groups.entries()]
      .map(([key, rows]) => ({
        dimension: label,
        value: key,
        quantity: rows.reduce((sum, row) => sum + row.quantity, 0),
        revenue: toMoneyString(sumOf(rows, 'subtotal')),
        share: pct(sumOf(rows, 'subtotal'), totalRevenue),
      }))
      // Best sellers first — that is what the report is for.
      .sort((a, b) => Number(b.revenue) - Number(a.revenue));

  const rows = [
    ...summarise(
      'Item',
      groupBy(items, (item) => item.food?.name ?? 'Unknown')
    ),
    ...summarise(
      'Category',
      groupBy(items, (item) => item.food?.category?.categoryName ?? 'Uncategorised')
    ),
    ...summarise(
      'Order type',
      groupBy(items, (item) => ORDER_TYPE_LABELS[item.order?.orderType] ?? 'Unknown')
    ),
  ];

  return {
    columns: [
      { key: 'dimension', header: 'Grouped by' },
      { key: 'value', header: 'Value' },
      { key: 'quantity', header: 'Qty sold' },
      { key: 'revenue', header: 'Revenue' },
      { key: 'share', header: 'Share %' },
    ],
    rows,
    summary: {
      from,
      to,
      lineItems: items.length,
      totalQuantity,
      totalRevenue: toMoneyString(totalRevenue),
    },
  };
}

// ---------------------------------------------------------------------------
// Payment Report — by method, plus outstanding balances (SRS §4.11)
// ---------------------------------------------------------------------------

async function paymentsReport(range) {
  const { from, to } = resolveRange(range);
  const window = { gte: from, lte: to };

  const [payments, bookings, orders] = await Promise.all([
    prisma.payment.findMany({
      where: { paidAt: window, status: 'COMPLETED' },
      select: { amount: true, method: true, paymentType: true },
    }),
    // Outstanding is a live balance, so it is read against everything still
    // open rather than only what falls inside the window.
    prisma.booking.findMany({
      where: { status: { in: REVENUE_BOOKING_STATUSES } },
      select: { totalAmount: true, payments: { select: { amount: true, paymentType: true, status: true } } },
    }),
    prisma.order.findMany({
      where: { status: { in: REVENUE_ORDER_STATUSES }, orderType: { not: 'ROOM_SERVICE' } },
      select: { totalAmount: true, payments: { select: { amount: true, paymentType: true, status: true } } },
    }),
  ]);

  const byMethod = groupBy(payments, (p) => PAYMENT_METHOD_LABELS[p.method] ?? p.method);

  const rows = [...byMethod.entries()].map(([method, rows_]) => {
    const received = rows_.filter((p) => p.paymentType !== 'REFUND');
    const refunds = rows_.filter((p) => p.paymentType === 'REFUND');

    return {
      method,
      transactions: rows_.length,
      received: toMoneyString(sumOf(received, 'amount')),
      refunded: toMoneyString(sumOf(refunds, 'amount')),
      net: toMoneyString(netOf(rows_)),
    };
  });

  const outstandingOf = (records) =>
    records.reduce((total, record) => {
      const settled = netOf((record.payments ?? []).filter((p) => p.status === 'COMPLETED'));
      const due = toDecimal(record.totalAmount).minus(settled);
      return due.greaterThan(ZERO) ? total.plus(due) : total;
    }, ZERO);

  const outstandingBookings = outstandingOf(bookings);
  const outstandingOrders = outstandingOf(orders);

  return {
    columns: [
      { key: 'method', header: 'Method' },
      { key: 'transactions', header: 'Transactions' },
      { key: 'received', header: 'Received' },
      { key: 'refunded', header: 'Refunded' },
      { key: 'net', header: 'Net' },
    ],
    rows,
    summary: {
      from,
      to,
      transactions: payments.length,
      net: toMoneyString(netOf(payments)),
      outstandingBookings: toMoneyString(outstandingBookings),
      outstandingOrders: toMoneyString(outstandingOrders),
      outstandingTotal: toMoneyString(round2(outstandingBookings.plus(outstandingOrders))),
    },
  };
}

// ---------------------------------------------------------------------------
// Staff Performance Report — Manager / Super Admin only (SRS §4.11, §5.4)
// ---------------------------------------------------------------------------

/**
 * Bookings handled per staff account.
 *
 * LIMITATION: only bookings record who acted on them (`bookings.created_by`).
 * `orders` and `payments` carry no staff column in SRS §7.2, so orders taken
 * and payments processed cannot be attributed. Adding `created_by` to those two
 * tables is a migration; until then this report covers bookings only.
 */
async function staffPerformanceReport(range) {
  const { from, to } = resolveRange(range);

  const [staff, bookings] = await Promise.all([
    prisma.user.findMany({ include: { role: true }, orderBy: { fullName: 'asc' } }),
    prisma.booking.findMany({
      where: { createdAt: { gte: from, lte: to }, createdBy: { not: null } },
      select: { createdBy: true, status: true, totalAmount: true },
    }),
  ]);

  const byStaff = groupBy(bookings, (b) => b.createdBy);

  const rows = staff.map((user) => {
    const handled = byStaff.get(user.userId) ?? [];
    const cancelled = handled.filter((b) => b.status === 'CANCELLED').length;

    return {
      staff: user.fullName,
      role: user.role?.roleName ?? '—',
      bookingsCreated: handled.length,
      cancelled,
      billed: toMoneyString(sumOf(handled, 'totalAmount')),
    };
  });

  // Unattributed bookings (self-service, or created before staff attribution)
  // are shown rather than dropped, so the column reconciles with the total.
  const unattributed = await prisma.booking.count({
    where: { createdAt: { gte: from, lte: to }, createdBy: null },
  });

  return {
    columns: [
      { key: 'staff', header: 'Staff' },
      { key: 'role', header: 'Role' },
      { key: 'bookingsCreated', header: 'Bookings created' },
      { key: 'cancelled', header: 'Cancelled' },
      { key: 'billed', header: 'Billed' },
    ],
    rows: rows.sort((a, b) => b.bookingsCreated - a.bookingsCreated),
    summary: {
      from,
      to,
      staffCount: staff.length,
      bookingsAttributed: bookings.length,
      bookingsUnattributed: unattributed,
      note: 'Orders and payments carry no staff attribution in the current schema.',
    },
  };
}

/** Report registry — the controller looks reports up here by slug. */
const REPORTS = {
  bookings: { run: bookingsReport, title: 'Booking Report' },
  occupancy: { run: occupancyReport, title: 'Occupancy Report' },
  revenue: { run: revenueReport, title: 'Revenue Report' },
  'food-sales': { run: foodSalesReport, title: 'Food Sales Report' },
  payments: { run: paymentsReport, title: 'Payment Report' },
  'staff-performance': {
    run: staffPerformanceReport,
    title: 'Staff Performance Report',
    // SRS §5.4 — Manager and Super Admin only; not the Accountant.
    roles: ['Super Admin', 'Manager'],
  },
};

module.exports = {
  REPORTS,
  resolveRange,
  bookingsReport,
  occupancyReport,
  revenueReport,
  foodSalesReport,
  paymentsReport,
  staffPerformanceReport,
  REVENUE_ORDER_STATUSES,
};
