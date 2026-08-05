/**
 * Room booking module (SRS §4.3, §5.1, Figure 1).
 *
 * Lifecycle: Pending -> Confirmed -> Checked-in -> Checked-out,
 * with Cancelled reachable from Pending/Confirmed, and No-show from Confirmed.
 */
const prisma = require('../lib/prisma');
const { AppError } = require('../lib/http');
const config = require('../lib/config');
const { toDecimal, toMoneyString, round2, percentOf, ZERO } = require('../lib/money');
const { priceBooking } = require('./pricingService');
const couponService = require('./couponService');
const notificationService = require('./notificationService');
const settingsService = require('./settingsService');

/** Booking states that hold a claim on a room (SRS §5.1). */
const BLOCKING_STATUSES = ['CONFIRMED', 'CHECKED_IN'];

/** Order states that count as settled against a booking at checkout. */
const SETTLED_ORDER_STATUSES = ['BILLED_TO_ROOM', 'CANCELLED'];

const ALLOWED_TRANSITIONS = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['CHECKED_IN', 'CANCELLED', 'NO_SHOW'],
  CHECKED_IN: ['CHECKED_OUT'],
  CHECKED_OUT: [],
  CANCELLED: [],
  NO_SHOW: [],
};

const STATUS_LABELS = {
  PENDING: 'Pending',
  CONFIRMED: 'Confirmed',
  CHECKED_IN: 'Checked-in',
  CHECKED_OUT: 'Checked-out',
  CANCELLED: 'Cancelled',
  NO_SHOW: 'No-show',
};

function assertTransition(current, next) {
  if (!ALLOWED_TRANSITIONS[current]?.includes(next)) {
    throw new AppError(
      409,
      'INVALID_STATUS_TRANSITION',
      `A ${STATUS_LABELS[current]} booking cannot be moved to ${STATUS_LABELS[next]}.`,
      { from: current, to: next, allowed: ALLOWED_TRANSITIONS[current] ?? [] }
    );
  }
}

/** Scheduled end of a stay = start + the duration's hour count. */
function computeCheckOut(checkIn, duration) {
  if (duration.hours === null || duration.hours === undefined) {
    throw new AppError(
      422,
      'DURATION_HOURS_MISSING',
      `Duration "${duration.durationName}" has no hour count configured.`
    );
  }

  const hours = Number(duration.hours);
  return new Date(checkIn.getTime() + hours * 60 * 60 * 1000);
}

/**
 * Half-open overlap test: [checkIn, checkOut) intersects [existing.in, existing.out).
 * Back-to-back bookings that merely touch at the boundary do not conflict.
 */
function overlapWhere(checkIn, checkOut) {
  return {
    status: { in: BLOCKING_STATUSES },
    checkInDatetime: { lt: checkOut },
    checkOutDatetime: { gt: checkIn },
  };
}

function publicBooking(booking) {
  return {
    id: booking.bookingId,
    status: booking.status,
    statusLabel: STATUS_LABELS[booking.status],
    checkInDatetime: booking.checkInDatetime,
    checkOutDatetime: booking.checkOutDatetime,
    actualCheckIn: booking.actualCheckIn,
    actualCheckOut: booking.actualCheckOut,
    pricing: {
      subtotal: toMoneyString(booking.subtotal),
      discountAmount: toMoneyString(booking.discountAmount),
      taxAmount: toMoneyString(booking.taxAmount),
      totalAmount: toMoneyString(booking.totalAmount),
    },
    customer: booking.customer
      ? {
          id: booking.customer.customerId,
          fullName: booking.customer.fullName,
          email: booking.customer.email,
          phone: booking.customer.phone,
        }
      : undefined,
    room: booking.room
      ? {
          id: booking.room.roomId,
          roomNumber: booking.room.roomNumber,
          status: booking.room.status,
          roomType: booking.room.roomType
            ? { id: booking.room.roomType.roomTypeId, typeName: booking.room.roomType.typeName }
            : undefined,
        }
      : undefined,
    duration: booking.duration
      ? { id: booking.duration.durationId, name: booking.duration.durationName }
      : undefined,
    coupon: booking.coupon ? { id: booking.coupon.couponId, code: booking.coupon.code } : null,
    detail: booking.bookingDetail
      ? {
          guestName: booking.bookingDetail.guestName,
          guestCount: booking.bookingDetail.guestCount,
          idProofNo: booking.bookingDetail.idProofNo,
          specialRequests: booking.bookingDetail.specialRequests,
        }
      : null,
    payments: booking.payments
      ? booking.payments.map((p) => ({
          id: p.paymentId,
          amount: toMoneyString(p.amount),
          method: p.method,
          paymentType: p.paymentType,
          status: p.status,
          transactionRef: p.transactionRef,
          paidAt: p.paidAt,
        }))
      : undefined,
    orders: booking.orders
      ? booking.orders.map((o) => ({
          id: o.orderId,
          status: o.status,
          totalAmount: toMoneyString(o.totalAmount),
        }))
      : undefined,
    createdAt: booking.createdAt,
  };
}

const FULL_INCLUDE = {
  customer: true,
  room: { include: { roomType: true } },
  duration: true,
  coupon: true,
  bookingDetail: true,
  payments: { orderBy: { paidAt: 'asc' } },
  orders: true,
};

/**
 * Loads a coupon by code, with its redemption count attached. Shared with the
 * ordering module so "one coupon, one set of rules" holds across both (SRS §5.3).
 */
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
// Search (SRS §4.3 — availability check)
// ---------------------------------------------------------------------------

/**
 * Finds bookable rooms for a window and prices each one.
 *
 * Excludes rooms under maintenance (SRS §4.2) and rooms whose window overlaps
 * an existing Confirmed or Checked-in booking (SRS §5.1).
 */
async function search({ checkIn, durationId, roomTypeId, guests }) {
  const duration = await prisma.bookingDuration.findUnique({ where: { durationId } });
  if (!duration) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Please correct the highlighted fields.', {
      durationId: 'Unknown duration option.',
    });
  }

  const checkOut = computeCheckOut(checkIn, duration);

  const roomWhere = {
    status: { not: 'MAINTENANCE' },
    ...(roomTypeId ? { roomTypeId } : {}),
    ...(guests ? { roomType: { capacity: { gte: guests } } } : {}),
  };

  const candidates = await prisma.room.findMany({
    where: roomWhere,
    include: { roomType: true },
    orderBy: { roomNumber: 'asc' },
  });

  if (candidates.length === 0) {
    return { checkIn, checkOut, duration, rooms: [] };
  }

  const conflicts = await prisma.booking.findMany({
    where: {
      roomId: { in: candidates.map((r) => r.roomId) },
      ...overlapWhere(checkIn, checkOut),
    },
    select: { roomId: true },
  });

  const takenRoomIds = new Set(conflicts.map((c) => c.roomId));

  // Loaded once for the whole result set (SRS §9 — configurable tax rates).
  const { roomTaxPercent } = await settingsService.taxRates();

  const rooms = candidates
    .filter((room) => !takenRoomIds.has(room.roomId))
    .map((room) => {
      // A room type missing a rate for this duration is not bookable for it.
      let pricing = null;
      try {
        pricing = priceBooking({
          roomType: room.roomType,
          duration,
          taxPercent: roomTaxPercent,
        });
      } catch {
        return null;
      }

      return {
        id: room.roomId,
        roomNumber: room.roomNumber,
        floor: room.floor,
        status: room.status,
        roomType: {
          id: room.roomType.roomTypeId,
          typeName: room.roomType.typeName,
          capacity: room.roomType.capacity,
          amenities: room.roomType.amenities,
        },
        pricing: {
          subtotal: toMoneyString(pricing.subtotal),
          discountAmount: toMoneyString(pricing.discountAmount),
          taxAmount: toMoneyString(pricing.taxAmount),
          totalAmount: toMoneyString(pricing.totalAmount),
        },
      };
    })
    .filter(Boolean);

  return { checkIn, checkOut, duration, rooms };
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

/**
 * Creates a Pending booking with its price locked in (SRS §5.3).
 *
 * The room row is locked FOR UPDATE inside the transaction before the overlap
 * check, so two concurrent requests for the same room cannot both pass — a
 * plain read-then-write would let both through under READ COMMITTED.
 */
async function create({
  customerId,
  roomId,
  durationId,
  checkIn,
  couponCode,
  guestCount,
  guestName,
  idProofNo,
  specialRequests,
  createdBy,
}) {
  return prisma.$transaction(async (tx) => {
    // Serialise all booking writes for this room.
    const locked = await tx.$queryRaw`
      SELECT room_id FROM rooms WHERE room_id = ${roomId} FOR UPDATE
    `;
    if (locked.length === 0) {
      throw new AppError(422, 'VALIDATION_ERROR', 'Please correct the highlighted fields.', {
        roomId: 'Unknown room.',
      });
    }

    const [room, duration, customer] = await Promise.all([
      tx.room.findUnique({ where: { roomId }, include: { roomType: true } }),
      tx.bookingDuration.findUnique({ where: { durationId } }),
      tx.customer.findUnique({ where: { customerId } }),
    ]);

    if (!duration) {
      throw new AppError(422, 'VALIDATION_ERROR', 'Please correct the highlighted fields.', {
        durationId: 'Unknown duration option.',
      });
    }
    if (!customer) {
      throw new AppError(422, 'VALIDATION_ERROR', 'Please correct the highlighted fields.', {
        customerId: 'Unknown customer.',
      });
    }
    if (room.status === 'MAINTENANCE') {
      throw new AppError(409, 'ROOM_UNAVAILABLE', 'This room is under maintenance.');
    }
    if (guestCount > room.roomType.capacity) {
      throw new AppError(422, 'VALIDATION_ERROR', 'Please correct the highlighted fields.', {
        guestCount: `This room type takes at most ${room.roomType.capacity} guests.`,
      });
    }

    const checkOut = computeCheckOut(checkIn, duration);

    const conflict = await tx.booking.findFirst({
      where: { roomId, ...overlapWhere(checkIn, checkOut) },
      select: { bookingId: true, checkInDatetime: true, checkOutDatetime: true },
    });

    if (conflict) {
      throw new AppError(
        409,
        'ROOM_DOUBLE_BOOKED',
        `Room ${room.roomNumber} is already booked for this time window.`,
        {
          roomNumber: room.roomNumber,
          conflictingBooking: {
            from: conflict.checkInDatetime,
            to: conflict.checkOutDatetime,
          },
        }
      );
    }

    const coupon = await loadCoupon(tx, couponCode);

    // Read inside the transaction so the rate charged is the one in force when
    // the booking is written; the figures below are then locked (SRS §5.3).
    const { roomTaxPercent } = await settingsService.taxRates(tx);

    const pricing = priceBooking({
      roomType: room.roomType,
      duration,
      coupon,
      taxPercent: roomTaxPercent,
    });

    const booking = await tx.booking.create({
      data: {
        customerId,
        roomId,
        durationId,
        couponId: coupon ? coupon.couponId : null,
        createdBy: createdBy ?? null,
        checkInDatetime: checkIn,
        checkOutDatetime: checkOut,
        status: 'PENDING',
        subtotal: pricing.subtotal.toFixed(2),
        discountAmount: pricing.discountAmount.toFixed(2),
        taxAmount: pricing.taxAmount.toFixed(2),
        totalAmount: pricing.totalAmount.toFixed(2),
        bookingDetail: {
          create: {
            guestName: guestName ?? null,
            guestCount,
            idProofNo: idProofNo ?? null,
            specialRequests: specialRequests ?? null,
          },
        },
      },
      include: FULL_INCLUDE,
    });

    return publicBooking(booking);
  });
}

// ---------------------------------------------------------------------------
// Lifecycle transitions
// ---------------------------------------------------------------------------

async function loadForTransition(tx, bookingId) {
  const booking = await tx.booking.findUnique({
    where: { bookingId },
    include: { room: true, payments: true, orders: true },
  });
  if (!booking) throw new AppError(404, 'NOT_FOUND', 'Booking not found.');
  return booking;
}

/** Total of completed payments, minus refunds. */
function paidTotal(payments) {
  return payments
    .filter((p) => p.status === 'COMPLETED')
    .reduce(
      (sum, p) =>
        p.paymentType === 'REFUND' ? sum.minus(toDecimal(p.amount)) : sum.plus(toDecimal(p.amount)),
      ZERO
    );
}

/**
 * Pending -> Confirmed, inside a caller-supplied transaction.
 *
 * Split out from confirm() so a payment that settles the balance can auto-confirm
 * within the same transaction that recorded it (SRS §4.6) — nesting
 * prisma.$transaction() is not an option.
 *
 * Requires payment in full or in part (SRS §5.1); the minimum share is
 * configurable via BOOKING_MIN_ADVANCE_PERCENT.
 *
 * Re-checks availability: SRS §5.1 only blocks against Confirmed/Checked-in
 * bookings, so two Pending bookings may exist for one slot and the first to
 * confirm wins.
 *
 * `outbox` collects the ids of notifications written here so the caller can
 * deliver them once its transaction has committed (SRS §4.8).
 */
async function confirmWithin(tx, bookingId, outbox) {
  const booking = await loadForTransition(tx, bookingId);
  assertTransition(booking.status, 'CONFIRMED');

  await tx.$queryRaw`SELECT room_id FROM rooms WHERE room_id = ${booking.roomId} FOR UPDATE`;

  const conflict = await tx.booking.findFirst({
    where: {
      roomId: booking.roomId,
      bookingId: { not: bookingId },
      ...overlapWhere(booking.checkInDatetime, booking.checkOutDatetime),
    },
    select: { bookingId: true },
  });

  if (conflict) {
    throw new AppError(
      409,
      'ROOM_DOUBLE_BOOKED',
      'This room was confirmed for an overlapping window by another booking. Please choose a different room or time.',
      { conflictingBookingId: conflict.bookingId }
    );
  }

  const paid = paidTotal(booking.payments);
  const required = round2(percentOf(booking.totalAmount, config.minAdvancePercent));

  if (paid.lessThanOrEqualTo(ZERO)) {
    throw new AppError(
      409,
      'PAYMENT_REQUIRED',
      'A booking must be paid in full or in part before it can be confirmed.',
      { totalAmount: toMoneyString(booking.totalAmount), paid: toMoneyString(paid) }
    );
  }

  if (paid.lessThan(required)) {
    throw new AppError(
      409,
      'ADVANCE_TOO_LOW',
      `An advance of at least ${toMoneyString(required)} is required to confirm this booking.`,
      {
        required: toMoneyString(required),
        paid: toMoneyString(paid),
        minAdvancePercent: config.minAdvancePercent,
      }
    );
  }

  const updated = await tx.booking.update({
    where: { bookingId },
    data: { status: 'CONFIRMED' },
    include: FULL_INCLUDE,
  });

  await notificationService.notify(tx, 'booking.confirmed', { booking: updated }, outbox);

  return publicBooking(updated);
}

/** Pending -> Confirmed, in its own transaction. */
async function confirm(bookingId) {
  const outbox = [];
  const booking = await prisma.$transaction((tx) => confirmWithin(tx, bookingId, outbox));

  notificationService.deliverSoon(outbox);
  return booking;
}

/**
 * Confirmed -> Checked-in. Only on/after the scheduled start (SRS §5.1).
 * Marks the room Occupied and activates in-room food ordering.
 */
async function checkIn(bookingId, { now = new Date() } = {}) {
  const outbox = [];

  const result = await prisma.$transaction(async (tx) => {
    const booking = await loadForTransition(tx, bookingId);
    assertTransition(booking.status, 'CHECKED_IN');

    if (now < booking.checkInDatetime) {
      throw new AppError(
        409,
        'CHECK_IN_TOO_EARLY',
        'Check-in is only allowed on or after the scheduled start time.',
        { scheduledStart: booking.checkInDatetime }
      );
    }

    const updated = await tx.booking.update({
      where: { bookingId },
      data: { status: 'CHECKED_IN', actualCheckIn: now },
      include: FULL_INCLUDE,
    });

    await tx.room.update({
      where: { roomId: booking.roomId },
      data: { status: 'OCCUPIED' },
    });

    // Re-read so the response carries the updated room status.
    const fresh = await tx.booking.findUnique({ where: { bookingId }, include: FULL_INCLUDE });

    await notificationService.notify(tx, 'booking.checked_in', { booking: fresh ?? updated }, outbox);

    return publicBooking(fresh ?? updated);
  });

  notificationService.deliverSoon(outbox);
  return result;
}

/**
 * Checked-in -> Checked-out. Frees the room and consolidates the bill.
 * Blocked while any linked room-service order is unsettled (SRS §5.1).
 */
async function checkOut(bookingId, { now = new Date() } = {}) {
  const outbox = [];

  const result = await prisma.$transaction(async (tx) => {
    const booking = await loadForTransition(tx, bookingId);
    assertTransition(booking.status, 'CHECKED_OUT');

    const unsettled = booking.orders.filter(
      (order) => !SETTLED_ORDER_STATUSES.includes(order.status)
    );

    if (unsettled.length > 0) {
      throw new AppError(
        409,
        'UNSETTLED_ROOM_SERVICE',
        `Checkout is blocked: ${unsettled.length} room-service order(s) are not yet billed to the room.`,
        {
          unsettledOrders: unsettled.map((o) => ({ id: o.orderId, status: o.status })),
        }
      );
    }

    await tx.booking.update({
      where: { bookingId },
      data: { status: 'CHECKED_OUT', actualCheckOut: now },
    });

    await tx.room.update({
      where: { roomId: booking.roomId },
      data: { status: 'AVAILABLE' },
    });

    const fresh = await tx.booking.findUnique({ where: { bookingId }, include: FULL_INCLUDE });

    await notificationService.notify(tx, 'booking.checked_out', { booking: fresh }, outbox);

    return publicBooking(fresh);
  });

  notificationService.deliverSoon(outbox);
  return result;
}

/** Pending/Confirmed -> Cancelled. */
async function cancel(bookingId, { reason } = {}) {
  return prisma.$transaction(async (tx) => {
    const booking = await loadForTransition(tx, bookingId);
    assertTransition(booking.status, 'CANCELLED');

    const note = reason ? String(reason).trim().slice(0, 500) : null;

    await tx.booking.update({
      where: { bookingId },
      data: { status: 'CANCELLED' },
    });

    if (note) {
      const existing = await tx.bookingDetail.findUnique({ where: { bookingId } });
      const appended = [existing?.specialRequests, `Cancellation reason: ${note}`]
        .filter(Boolean)
        .join('\n');

      if (existing) {
        await tx.bookingDetail.update({
          where: { bookingId },
          data: { specialRequests: appended },
        });
      }
    }

    // Refund handling against the original payment reference is recorded
    // separately per SRS §4.6; the refund window itself is a client setting.
    const fresh = await tx.booking.findUnique({ where: { bookingId }, include: FULL_INCLUDE });
    return publicBooking(fresh);
  });
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

async function list({ status, roomId, customerId, from, to, page = 1, pageSize } = {}) {
  const take = Math.min(pageSize || config.defaultPageSize, config.maxPageSize);
  const skip = (page - 1) * take;

  const where = {
    ...(status ? { status } : {}),
    ...(roomId ? { roomId } : {}),
    ...(customerId ? { customerId } : {}),
    ...(from || to
      ? {
          checkInDatetime: {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          },
        }
      : {}),
  };

  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      include: FULL_INCLUDE,
      orderBy: { checkInDatetime: 'desc' },
      skip,
      take,
    }),
    prisma.booking.count({ where }),
  ]);

  return {
    bookings: bookings.map(publicBooking),
    meta: {
      page,
      pageSize: take,
      total,
      totalPages: Math.max(1, Math.ceil(total / take)),
    },
  };
}

async function getById(bookingId) {
  const booking = await prisma.booking.findUnique({
    where: { bookingId },
    include: FULL_INCLUDE,
  });
  if (!booking) throw new AppError(404, 'NOT_FOUND', 'Booking not found.');
  return publicBooking(booking);
}

module.exports = {
  search,
  create,
  confirm,
  confirmWithin,
  checkIn,
  checkOut,
  cancel,
  list,
  getById,
  computeCheckOut,
  overlapWhere,
  assertTransition,
  paidTotal,
  BLOCKING_STATUSES,
  ALLOWED_TRANSITIONS,
  STATUS_LABELS,
};
