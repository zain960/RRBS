const paymentService = require('../services/paymentService');
const { ok, AppError, asyncHandler } = require('../lib/http');
const { Validator } = require('../lib/validate');
const config = require('../lib/config');

const { METHODS, TYPES, STATUSES } = paymentService;

function parseDate(raw, field, label) {
  const value = new Date(raw);
  if (Number.isNaN(value.getTime())) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Please correct the highlighted fields.', {
      [field]: `${label} must be a valid date.`,
    });
  }
  return value;
}

/**
 * POST /api/payments — { booking_id? | order_id?, amount, method, payment_type }
 *
 * Exactly one target. A payment settling a booking in full auto-confirms it
 * (SRS §4.6); one settling a served dine-in order frees its table (SRS §5.2).
 */
const create = asyncHandler(async (req, res) => {
  const body = req.body ?? {};

  const { bookingId, orderId, amount, method, paymentType } = new Validator({
    bookingId: body.booking_id ?? body.bookingId,
    orderId: body.order_id ?? body.orderId,
    amount: body.amount,
    method: body.method,
    paymentType: body.payment_type ?? body.paymentType,
  })
    .integer('bookingId', { required: false, min: 1, label: 'Booking' })
    .integer('orderId', { required: false, min: 1, label: 'Order' })
    .money('amount', { required: true, min: 0, label: 'Amount' })
    .enum('method', METHODS, { label: 'Payment method' })
    .enum('paymentType', TYPES, { label: 'Payment type' })
    .result();

  if (!bookingId && !orderId) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Please correct the highlighted fields.', {
      bookingId: 'A payment must be recorded against a booking or an order.',
    });
  }

  // The schema allows a payment to reference both, but reconciling one amount
  // across two bills needs a split the SRS does not define (§4.6). Kept to one
  // target until the client specifies how a combined payment should divide.
  if (bookingId && orderId) {
    throw new AppError(
      422,
      'VALIDATION_ERROR',
      'Please correct the highlighted fields.',
      { orderId: 'Record the payment against either a booking or an order, not both.' }
    );
  }

  const transactionRef = body.transaction_ref ?? body.transactionRef ?? null;

  const result = bookingId
    ? await paymentService.recordForBooking(bookingId, {
        amount,
        method,
        paymentType,
        transactionRef,
      })
    : await paymentService.recordForOrder(orderId, {
        amount,
        method,
        paymentType,
        transactionRef,
      });

  return ok(res, result, {}, 201);
});

/** GET /api/payments?method=&payment_type=&status=&booking_id=&order_id=&from=&to= */
const list = asyncHandler(async (req, res) => {
  const q = req.query;

  const { page, pageSize, method, paymentType, status, bookingId, orderId } = new Validator({
    page: q.page ?? 1,
    pageSize: q.pageSize ?? q.page_size ?? config.defaultPageSize,
    method: q.method,
    paymentType: q.payment_type ?? q.paymentType,
    status: q.status,
    bookingId: q.booking_id ?? q.bookingId,
    orderId: q.order_id ?? q.orderId,
  })
    .integer('page', { min: 1, label: 'Page' })
    .integer('pageSize', { min: 1, max: config.maxPageSize, label: 'Page size' })
    .enum('method', METHODS, { required: false, label: 'Payment method' })
    .enum('paymentType', TYPES, { required: false, label: 'Payment type' })
    .enum('status', STATUSES, { required: false, label: 'Status' })
    .integer('bookingId', { required: false, min: 1, label: 'Booking' })
    .integer('orderId', { required: false, min: 1, label: 'Order' })
    .result();

  const result = await paymentService.list({
    method: method ?? undefined,
    paymentType: paymentType ?? undefined,
    status: status ?? undefined,
    bookingId: bookingId ?? undefined,
    orderId: orderId ?? undefined,
    from: q.from ? parseDate(q.from, 'from', 'From date') : undefined,
    to: q.to ? parseDate(q.to, 'to', 'To date') : undefined,
    page,
    pageSize,
  });

  return ok(res, result.payments, result.meta);
});

module.exports = { create, list };
