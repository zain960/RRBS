/**
 * Payments against bookings (SRS §4.6).
 *
 * Supports cash, card and online methods, and full / advance / balance /
 * refund transaction types. A payment is what allows a Pending booking to be
 * confirmed (SRS §5.1).
 */
const prisma = require('../lib/prisma');
const { AppError } = require('../lib/http');
const config = require('../lib/config');
const { toDecimal, toMoneyString, round2, ZERO } = require('../lib/money');
const orderService = require('./orderService');
const bookingService = require('./bookingService');
const notificationService = require('./notificationService');

const METHODS = ['CASH', 'CARD', 'ONLINE'];
const TYPES = ['FULL', 'ADVANCE', 'BALANCE', 'REFUND'];
const STATUSES = ['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED'];

function publicPayment(payment) {
  return {
    id: payment.paymentId,
    bookingId: payment.bookingId,
    orderId: payment.orderId,
    amount: toMoneyString(payment.amount),
    method: payment.method,
    paymentType: payment.paymentType,
    status: payment.status,
    transactionRef: payment.transactionRef,
    paidAt: payment.paidAt,
  };
}

/** Completed payments minus refunds. */
function settledTotal(payments) {
  return payments
    .filter((p) => p.status === 'COMPLETED')
    .reduce(
      (sum, p) =>
        p.paymentType === 'REFUND' ? sum.minus(toDecimal(p.amount)) : sum.plus(toDecimal(p.amount)),
      ZERO
    );
}

/** Records a payment against a booking and returns the updated balance. */
async function recordForBooking(
  bookingId,
  { amount, method, paymentType, transactionRef, status = 'COMPLETED' }
) {
  const outbox = [];

  const result = await prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({
      where: { bookingId },
      include: { payments: true },
    });

    if (!booking) throw new AppError(404, 'NOT_FOUND', 'Booking not found.');

    if (['CANCELLED', 'NO_SHOW'].includes(booking.status) && paymentType !== 'REFUND') {
      throw new AppError(
        409,
        'BOOKING_NOT_PAYABLE',
        'Payments cannot be taken against a cancelled or no-show booking.'
      );
    }

    const value = round2(amount);
    if (value.lessThanOrEqualTo(ZERO)) {
      throw new AppError(422, 'VALIDATION_ERROR', 'Please correct the highlighted fields.', {
        amount: 'Amount must be greater than zero.',
      });
    }

    const payment = await tx.payment.create({
      data: {
        bookingId,
        amount: value.toFixed(2),
        method,
        paymentType,
        status,
        transactionRef: transactionRef ?? null,
        paidAt: new Date(),
      },
    });

    const paid = settledTotal([...booking.payments, payment]);
    const balance = round2(toDecimal(booking.totalAmount).minus(paid));

    // Only money that actually settled is worth telling the guest about; a
    // Pending or Failed attempt is not a receipt.
    if (status === 'COMPLETED') {
      await notificationService.notify(tx, 'payment.received', { payment, booking }, outbox);
    }

    // A payment that brings the booking up to its full total confirms it
    // automatically (SRS §4.6) — the guest has paid, so the front desk should
    // not have to press Confirm as a second step.
    const autoConfirm = await maybeAutoConfirm(tx, booking, paid, paymentType, outbox);

    return {
      payment: publicPayment(payment),
      balance: {
        totalAmount: toMoneyString(booking.totalAmount),
        paid: toMoneyString(paid),
        outstanding: toMoneyString(balance.lessThan(ZERO) ? ZERO : balance),
      },
      autoConfirm,
    };
  });

  notificationService.deliverSoon(outbox);
  return result;
}

/**
 * Confirms a Pending booking whose payments now cover the total.
 *
 * Reports rather than throws: the money has already changed hands, so a booking
 * that cannot be confirmed (its room was taken by another booking in the
 * meantime) must not roll the payment back. The caller sees why it did not
 * confirm and can act on it.
 */
async function maybeAutoConfirm(tx, booking, paid, paymentType, outbox) {
  if (paymentType === 'REFUND') return { attempted: false };
  if (booking.status !== 'PENDING') return { attempted: false };
  if (paid.lessThan(toDecimal(booking.totalAmount))) {
    return { attempted: false, reason: 'Balance outstanding.' };
  }

  try {
    const confirmed = await bookingService.confirmWithin(tx, booking.bookingId, outbox);
    return { attempted: true, confirmed: true, booking: confirmed };
  } catch (err) {
    // Only a domain rejection is tolerated here; a real fault still aborts the
    // transaction so the payment is not silently written against a broken state.
    if (!err.status || err.status >= 500) throw err;
    return { attempted: true, confirmed: false, code: err.code, reason: err.message };
  }
}

/**
 * Records a payment against a food order (SRS §4.6).
 *
 * Room-service orders are excluded: they are billed to the booking and settled
 * at checkout, not paid separately (SRS §4.5).
 *
 * Settling a dine-in order that has already been served releases the table, so
 * the floor plan clears itself without a second staff action (SRS §5.2).
 */
async function recordForOrder(
  orderId,
  { amount, method, paymentType, transactionRef, status = 'COMPLETED' }
) {
  const outbox = [];

  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { orderId },
      include: { payments: true },
    });

    if (!order) throw new AppError(404, 'NOT_FOUND', 'Order not found.');

    if (order.orderType === 'ROOM_SERVICE') {
      throw new AppError(
        409,
        'ORDER_BILLED_TO_ROOM',
        'A room-service order is billed to the booking and settled at checkout.',
        { orderId, bookingId: order.bookingId }
      );
    }

    if (order.status === 'CANCELLED' && paymentType !== 'REFUND') {
      throw new AppError(
        409,
        'ORDER_NOT_PAYABLE',
        'Payments cannot be taken against a cancelled order.'
      );
    }

    const value = round2(amount);
    if (value.lessThanOrEqualTo(ZERO)) {
      throw new AppError(422, 'VALIDATION_ERROR', 'Please correct the highlighted fields.', {
        amount: 'Amount must be greater than zero.',
      });
    }

    const payment = await tx.payment.create({
      data: {
        orderId,
        amount: value.toFixed(2),
        method,
        paymentType,
        status,
        transactionRef: transactionRef ?? null,
        paidAt: new Date(),
      },
    });

    await orderService.releaseTableIfSettled(tx, orderId);

    if (status === 'COMPLETED') {
      await notificationService.notify(tx, 'payment.received', { payment, order }, outbox);
    }

    const paid = settledTotal([...order.payments, payment]);
    const balance = round2(toDecimal(order.totalAmount).minus(paid));

    return {
      payment: publicPayment(payment),
      balance: {
        totalAmount: toMoneyString(order.totalAmount),
        paid: toMoneyString(paid),
        outstanding: toMoneyString(balance.lessThan(ZERO) ? ZERO : balance),
      },
    };
  });

  notificationService.deliverSoon(outbox);
  return result;
}

async function listForBooking(bookingId) {
  const payments = await prisma.payment.findMany({
    where: { bookingId },
    orderBy: { paidAt: 'asc' },
  });
  return payments.map(publicPayment);
}

/**
 * Payment ledger with filters (SRS §4.11 Payment Report).
 *
 * Ordered newest-first; `from`/`to` bracket `paid_at`.
 */
async function list({
  bookingId,
  orderId,
  method,
  paymentType,
  status,
  from,
  to,
  page = 1,
  pageSize,
} = {}) {
  const take = Math.min(pageSize || config.defaultPageSize, config.maxPageSize);
  const skip = (page - 1) * take;

  const where = {
    ...(bookingId ? { bookingId } : {}),
    ...(orderId ? { orderId } : {}),
    ...(method ? { method } : {}),
    ...(paymentType ? { paymentType } : {}),
    ...(status ? { status } : {}),
    ...(from || to
      ? { paidAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
      : {}),
  };

  // Summed across the whole filtered set, not just this page — a report needs
  // the total of what was filtered, not of what happens to be visible. Refunds
  // are money going out, so they subtract rather than add.
  const settledWhere = { ...where, status: 'COMPLETED' };

  const [payments, total, received, refunded] = await Promise.all([
    prisma.payment.findMany({
      where,
      include: {
        booking: { include: { customer: true, room: true } },
        order: { include: { customer: true } },
      },
      orderBy: { paidAt: 'desc' },
      skip,
      take,
    }),
    prisma.payment.count({ where }),
    prisma.payment.aggregate({
      where: { ...settledWhere, paymentType: { not: 'REFUND' } },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: { ...settledWhere, paymentType: 'REFUND' },
      _sum: { amount: true },
    }),
  ]);

  const receivedTotal = toDecimal(received._sum.amount ?? ZERO);
  const refundedTotal = toDecimal(refunded._sum.amount ?? ZERO);

  return {
    payments: payments.map((payment) => ({
      ...publicPayment(payment),
      customerName:
        payment.booking?.customer?.fullName ?? payment.order?.customer?.fullName ?? null,
      roomNumber: payment.booking?.room?.roomNumber ?? null,
      against: payment.bookingId ? 'Booking' : payment.orderId ? 'Order' : '—',
    })),
    meta: {
      page,
      pageSize: take,
      total,
      totalPages: Math.max(1, Math.ceil(total / take)),
      received: toMoneyString(receivedTotal),
      refunded: toMoneyString(refundedTotal),
      settledTotal: toMoneyString(round2(receivedTotal.minus(refundedTotal))),
    },
  };
}

async function listForOrder(orderId) {
  const payments = await prisma.payment.findMany({
    where: { orderId },
    orderBy: { paidAt: 'asc' },
  });
  return payments.map(publicPayment);
}

module.exports = {
  recordForBooking,
  recordForOrder,
  list,
  listForBooking,
  listForOrder,
  settledTotal,
  METHODS,
  TYPES,
  STATUSES,
};
