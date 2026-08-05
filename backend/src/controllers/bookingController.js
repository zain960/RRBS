const bookingService = require('../services/bookingService');
const paymentService = require('../services/paymentService');
const { ok, AppError, asyncHandler } = require('../lib/http');
const { Validator, parseId } = require('../lib/validate');
const config = require('../lib/config');

const BOOKING_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'CHECKED_IN',
  'CHECKED_OUT',
  'CANCELLED',
  'NO_SHOW',
];

const STAFF_ROLES = ['Super Admin', 'Manager', 'Receptionist'];

function parseDate(raw, field, label) {
  const value = new Date(raw);
  if (Number.isNaN(value.getTime())) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Please correct the highlighted fields.', {
      [field]: `${label} must be a valid date and time.`,
    });
  }
  return value;
}

/** True when the caller is staff acting on someone else's booking. */
function isStaff(auth) {
  return auth?.accountType === 'staff' && STAFF_ROLES.includes(auth.roleName);
}

/**
 * Customers may only read their own bookings (SRS §5.4).
 * Staff may read any.
 */
function assertCanView(auth, booking) {
  if (isStaff(auth)) return;
  if (auth.accountType === 'customer' && booking.customer?.id === auth.userId) return;
  throw new AppError(403, 'FORBIDDEN', 'You can only view your own bookings.');
}

/** POST /api/bookings/search — public. */
const search = asyncHandler(async (req, res) => {
  const body = req.body ?? {};

  const { durationId, guests, roomTypeId } = new Validator({
    durationId: body.duration_id ?? body.durationId,
    guests: body.guests,
    roomTypeId: body.room_type_id ?? body.roomTypeId,
  })
    .integer('durationId', { min: 1, label: 'Duration' })
    .integer('guests', { required: false, min: 1, label: 'Guests' })
    .integer('roomTypeId', { required: false, min: 1, label: 'Room type' })
    .result();

  const rawCheckIn = body.check_in ?? body.checkIn;
  if (!rawCheckIn) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Please correct the highlighted fields.', {
      checkIn: 'Check-in date and time is required.',
    });
  }

  const checkIn = parseDate(rawCheckIn, 'checkIn', 'Check-in');

  const result = await bookingService.search({
    checkIn,
    durationId,
    roomTypeId: roomTypeId ?? undefined,
    guests: guests ?? undefined,
  });

  return ok(
    res,
    { rooms: result.rooms },
    {
      checkIn: result.checkIn,
      checkOut: result.checkOut,
      duration: { id: result.duration.durationId, name: result.duration.durationName },
      total: result.rooms.length,
    }
  );
});

/** POST /api/bookings — authenticated. */
const create = asyncHandler(async (req, res) => {
  const body = req.body ?? {};

  const { roomId, durationId, guestCount, customerId } = new Validator({
    roomId: body.room_id ?? body.roomId,
    durationId: body.duration_id ?? body.durationId,
    guestCount: body.guest_count ?? body.guestCount,
    customerId: body.customer_id ?? body.customerId,
  })
    .integer('roomId', { min: 1, label: 'Room' })
    .integer('durationId', { min: 1, label: 'Duration' })
    .integer('guestCount', { min: 1, label: 'Number of guests' })
    .integer('customerId', { required: false, min: 1, label: 'Customer' })
    .result();

  const rawCheckIn = body.check_in ?? body.checkIn;
  if (!rawCheckIn) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Please correct the highlighted fields.', {
      checkIn: 'Check-in date and time is required.',
    });
  }
  const checkIn = parseDate(rawCheckIn, 'checkIn', 'Check-in');

  // A customer always books for themselves; staff may book on a guest's behalf.
  let bookingCustomerId;
  if (req.auth.accountType === 'customer') {
    bookingCustomerId = req.auth.userId;
  } else if (isStaff(req.auth)) {
    if (!customerId) {
      throw new AppError(422, 'VALIDATION_ERROR', 'Please correct the highlighted fields.', {
        customerId: 'Select the customer this booking is for.',
      });
    }
    bookingCustomerId = customerId;
  } else {
    throw new AppError(403, 'FORBIDDEN', 'Your role cannot create bookings.');
  }

  const booking = await bookingService.create({
    customerId: bookingCustomerId,
    roomId,
    durationId,
    checkIn,
    guestCount,
    couponCode: body.coupon_code ?? body.couponCode ?? null,
    guestName: body.guest_name ?? body.guestName ?? null,
    idProofNo: body.id_proof_no ?? body.idProofNo ?? null,
    specialRequests: body.special_requests ?? body.specialRequests ?? null,
    createdBy: req.auth.accountType === 'staff' ? req.auth.userId : null,
  });

  return ok(res, booking, {}, 201);
});

/** GET /api/bookings */
const list = asyncHandler(async (req, res) => {
  const q = req.query;

  const { page, pageSize, status, roomId } = new Validator({
    page: q.page ?? 1,
    pageSize: q.pageSize ?? q.page_size ?? config.defaultPageSize,
    status: q.status,
    roomId: q.roomId ?? q.room_id,
  })
    .integer('page', { min: 1, label: 'Page' })
    .integer('pageSize', { min: 1, max: config.maxPageSize, label: 'Page size' })
    .enum('status', BOOKING_STATUSES, { required: false, label: 'Status' })
    .integer('roomId', { required: false, min: 1, label: 'Room' })
    .result();

  // Customers see only their own bookings (SRS §5.4).
  const customerId = isStaff(req.auth)
    ? q.customerId || q.customer_id
      ? parseId(q.customerId ?? q.customer_id, 'customer id')
      : undefined
    : req.auth.userId;

  const result = await bookingService.list({
    status: status ?? undefined,
    roomId: roomId ?? undefined,
    customerId,
    from: q.from ? parseDate(q.from, 'from', 'From date') : undefined,
    to: q.to ? parseDate(q.to, 'to', 'To date') : undefined,
    page,
    pageSize,
  });

  return ok(res, result.bookings, result.meta);
});

/** GET /api/bookings/:id */
const getById = asyncHandler(async (req, res) => {
  const booking = await bookingService.getById(parseId(req.params.id, 'booking id'));
  assertCanView(req.auth, booking);
  return ok(res, booking);
});

/** PATCH /api/bookings/:id/confirm */
const confirm = asyncHandler(async (req, res) => {
  const booking = await bookingService.confirm(parseId(req.params.id, 'booking id'));
  return ok(res, booking);
});

/** PATCH /api/bookings/:id/check-in */
const checkIn = asyncHandler(async (req, res) => {
  const booking = await bookingService.checkIn(parseId(req.params.id, 'booking id'));
  return ok(res, booking);
});

/** PATCH /api/bookings/:id/check-out */
const checkOut = asyncHandler(async (req, res) => {
  const booking = await bookingService.checkOut(parseId(req.params.id, 'booking id'));
  return ok(res, booking);
});

/** PATCH /api/bookings/:id/cancel */
const cancel = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'booking id');
  const existing = await bookingService.getById(id);
  assertCanView(req.auth, existing);

  const booking = await bookingService.cancel(id, { reason: req.body?.reason });
  return ok(res, booking);
});

/** POST /api/bookings/:id/payments */
const addPayment = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'booking id');
  const body = req.body ?? {};

  const { amount, method, paymentType } = new Validator({
    amount: body.amount,
    method: body.method,
    paymentType: body.payment_type ?? body.paymentType ?? 'ADVANCE',
  })
    .money('amount', { required: true, min: 0, label: 'Amount' })
    .enum('method', paymentService.METHODS, { label: 'Payment method' })
    .enum('paymentType', paymentService.TYPES, { label: 'Payment type' })
    .result();

  const existing = await bookingService.getById(id);
  assertCanView(req.auth, existing);

  const result = await paymentService.recordForBooking(id, {
    amount,
    method,
    paymentType,
    transactionRef: body.transaction_ref ?? body.transactionRef ?? null,
  });

  return ok(res, result, {}, 201);
});

/** GET /api/bookings/:id/payments */
const listPayments = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'booking id');
  const existing = await bookingService.getById(id);
  assertCanView(req.auth, existing);

  const payments = await paymentService.listForBooking(id);
  return ok(res, payments, { total: payments.length });
});

module.exports = {
  search,
  create,
  list,
  getById,
  confirm,
  checkIn,
  checkOut,
  cancel,
  addPayment,
  listPayments,
};
