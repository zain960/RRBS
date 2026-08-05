/**
 * Admin dashboard (SRS §4.10).
 *
 * One operational read of the day: how many rooms are in each state, who is
 * arriving and leaving, what the kitchen is working on, what has been taken in
 * revenue, and which menu items need attention.
 *
 * "Today" is a calendar day in the server's timezone. Datetimes are stored UTC
 * (CLAUDE.md §3), so the window is computed once and reused by every query.
 */
const prisma = require('../lib/prisma');
const { toDecimal, toMoneyString, round2, ZERO } = require('../lib/money');

const ROOM_STATUSES = ['AVAILABLE', 'OCCUPIED', 'RESERVED', 'MAINTENANCE'];

/** Order states the kitchen and floor are actively working (SRS §4.10). */
const LIVE_ORDER_STATUSES = ['PLACED', 'PREPARING', 'READY', 'DISPATCHED'];

/** Bookings that represent real business — Pending may still fall through. */
const REVENUE_BOOKING_STATUSES = ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT'];

/** Start and end of the calendar day containing `at`. */
function dayBounds(at = new Date()) {
  const start = new Date(at);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return { start, end };
}

/** Completed payments minus refunds, over a set of payment rows. */
function netOf(payments) {
  return payments.reduce(
    (sum, payment) =>
      payment.paymentType === 'REFUND'
        ? sum.minus(toDecimal(payment.amount))
        : sum.plus(toDecimal(payment.amount)),
    ZERO
  );
}

async function summary({ at = new Date() } = {}) {
  const { start, end } = dayBounds(at);
  const today = { gte: start, lt: end };

  const [
    roomCounts,
    totalRooms,
    checkInsDue,
    checkOutsDue,
    checkedInToday,
    checkedOutToday,
    orderCounts,
    todaysPayments,
    unavailableItems,
  ] = await Promise.all([
    prisma.room.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.room.count(),

    // Scheduled for today, still to arrive.
    prisma.booking.count({
      where: { checkInDatetime: today, status: { in: ['CONFIRMED', 'PENDING'] } },
    }),
    prisma.booking.count({
      where: { checkOutDatetime: today, status: 'CHECKED_IN' },
    }),

    // Already handled today, so the desk can see progress against the list.
    prisma.booking.count({ where: { actualCheckIn: today } }),
    prisma.booking.count({ where: { actualCheckOut: today } }),

    prisma.order.groupBy({
      by: ['status'],
      where: { status: { in: LIVE_ORDER_STATUSES } },
      _count: { _all: true },
    }),

    // Split by what the payment was against: a booking is room revenue, an
    // order is food revenue (SRS §4.10).
    prisma.payment.findMany({
      where: { paidAt: today, status: 'COMPLETED' },
      select: { amount: true, paymentType: true, bookingId: true, orderId: true },
    }),

    prisma.food.findMany({
      where: { availabilityStatus: 'UNAVAILABLE' },
      include: { category: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  const occupancy = Object.fromEntries(ROOM_STATUSES.map((status) => [status, 0]));
  for (const row of roomCounts) occupancy[row.status] = row._count._all;

  const liveOrders = Object.fromEntries(LIVE_ORDER_STATUSES.map((status) => [status, 0]));
  for (const row of orderCounts) liveOrders[row.status] = row._count._all;

  const roomsRevenue = netOf(todaysPayments.filter((p) => p.bookingId !== null));
  const foodRevenue = netOf(todaysPayments.filter((p) => p.bookingId === null && p.orderId !== null));

  // Occupied as a share of the rooms that are in service — a room under
  // maintenance is not available to sell, so counting it would understate the rate.
  const sellableRooms = totalRooms - occupancy.MAINTENANCE;
  const occupancyRate =
    sellableRooms > 0 ? round2((occupancy.OCCUPIED / sellableRooms) * 100) : ZERO;

  return {
    date: start,
    occupancy: {
      available: occupancy.AVAILABLE,
      occupied: occupancy.OCCUPIED,
      reserved: occupancy.RESERVED,
      maintenance: occupancy.MAINTENANCE,
      total: totalRooms,
      occupancyRate: occupancyRate.toFixed(2),
    },
    todaysCheckIns: { due: checkInsDue, completed: checkedInToday },
    todaysCheckOuts: { due: checkOutsDue, completed: checkedOutToday },
    liveOrdersByStatus: liveOrders,
    liveOrdersTotal: Object.values(liveOrders).reduce((sum, n) => sum + n, 0),
    todaysRevenue: {
      rooms: toMoneyString(roomsRevenue),
      food: toMoneyString(foodRevenue),
      total: toMoneyString(round2(roomsRevenue.plus(foodRevenue))),
    },
    // SRS §4.10 asks for "low-stock or unavailable" items. §7.2 defines no
    // stock levels, so unavailability is the only signal available; add an
    // inventory table if the client wants true low-stock alerts.
    lowStockItems: unavailableItems.map((food) => ({
      id: food.foodId,
      name: food.name,
      category: food.category ? food.category.categoryName : null,
      availabilityStatus: food.availabilityStatus,
    })),
  };
}

/**
 * Daily net revenue for the dashboard's trend chart, split rooms vs food.
 *
 * Built from `payments` rather than from booking/order totals, because a chart
 * of "revenue over time" should follow money actually taken — a booking made
 * today for a stay next month is not today's revenue. Refunds subtract on the
 * day they were issued, which is why a day can legitimately come out negative.
 *
 * A payment can carry both a booking and an order id (CLAUDE.md §5); it is
 * counted as rooms in that case, since the room booking is what it settles.
 *
 * Every day in the window is present, zero-filled, so the chart has no gaps to
 * interpolate across.
 */
async function revenueSeries({ days = 30, at = new Date() } = {}) {
  const { end } = dayBounds(at);
  const start = new Date(end);
  start.setDate(start.getDate() - days);

  const payments = await prisma.payment.findMany({
    where: { paidAt: { gte: start, lt: end }, status: 'COMPLETED' },
    select: { paidAt: true, amount: true, paymentType: true, bookingId: true, orderId: true },
  });

  // Local calendar day, matching `dayBounds` — not the UTC date, or a payment
  // taken late in the evening would land on tomorrow's column.
  const keyOf = (date) => {
    const local = new Date(date);
    return `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, '0')}-${String(
      local.getDate()
    ).padStart(2, '0')}`;
  };

  const buckets = new Map();
  for (let offset = 0; offset < days; offset += 1) {
    const day = new Date(start);
    day.setDate(day.getDate() + offset);
    buckets.set(keyOf(day), { date: keyOf(day), rooms: ZERO, food: ZERO });
  }

  for (const payment of payments) {
    const bucket = buckets.get(keyOf(payment.paidAt));
    if (!bucket) continue;

    const stream = payment.bookingId ? 'rooms' : 'food';
    const amount = toDecimal(payment.amount);
    bucket[stream] =
      payment.paymentType === 'REFUND' ? bucket[stream].minus(amount) : bucket[stream].plus(amount);
  }

  return [...buckets.values()].map((bucket) => ({
    date: bucket.date,
    rooms: toMoneyString(round2(bucket.rooms)),
    food: toMoneyString(round2(bucket.food)),
    total: toMoneyString(round2(bucket.rooms.plus(bucket.food))),
  }));
}

module.exports = {
  summary,
  revenueSeries,
  dayBounds,
  netOf,
  ROOM_STATUSES,
  LIVE_ORDER_STATUSES,
  REVENUE_BOOKING_STATUSES,
};
