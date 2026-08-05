/**
 * Reviews and ratings (SRS §4.9).
 *
 * A review targets a completed stay or a completed order — never both, and
 * never something the customer has not actually had yet. Ratings are then
 * aggregated two ways:
 *
 *   - per room type, through the room the booking was for;
 *   - per menu item, through the lines of the order.
 *
 * The aggregates are computed from `reviews` on read rather than cached on
 * `room_types` / `foods`: a stored average would need invalidating on every
 * write and would drift, and the volumes here are small.
 */
const prisma = require('../lib/prisma');
const { AppError } = require('../lib/http');
const config = require('../lib/config');

const MIN_RATING = 1;
const MAX_RATING = 5;

/** A stay can only be reviewed once the guest has actually stayed (SRS §4.9). */
const REVIEWABLE_BOOKING_STATUSES = ['CHECKED_OUT'];

/** Orders that reached the end of their pipeline, per type (SRS §4.5, Figure 2). */
const REVIEWABLE_ORDER_STATUSES = ['SERVED', 'PICKED_UP', 'DELIVERED', 'BILLED_TO_ROOM'];

function publicReview(review) {
  return {
    id: review.reviewId,
    rating: review.rating,
    comment: review.comment,
    bookingId: review.bookingId,
    orderId: review.orderId,
    customer: review.customer
      ? { id: review.customer.customerId, fullName: review.customer.fullName }
      : undefined,
    roomType: review.booking?.room?.roomType
      ? {
          id: review.booking.room.roomType.roomTypeId,
          typeName: review.booking.room.roomType.typeName,
        }
      : null,
    createdAt: review.createdAt,
  };
}

const FULL_INCLUDE = {
  customer: true,
  booking: { include: { room: { include: { roomType: true } } } },
};

/** `{ average, count }` from a raw aggregate row, with a null average at zero. */
function rating(row) {
  const count = Number(row?.count ?? 0);
  if (count === 0) return { average: null, count: 0 };
  return { average: Math.round(Number(row.average) * 100) / 100, count };
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

/**
 * Loads the target and checks the customer may review it.
 *
 * Ownership is checked here rather than in the controller because it is a
 * domain rule, not a transport concern: a customer reviews their own stay
 * (SRS §5.4).
 */
async function loadTarget(client, { customerId, bookingId, orderId }) {
  if (bookingId) {
    const booking = await client.booking.findUnique({ where: { bookingId } });

    if (!booking) {
      throw new AppError(422, 'VALIDATION_ERROR', 'Please correct the highlighted fields.', {
        bookingId: 'Unknown booking.',
      });
    }
    if (booking.customerId !== customerId) {
      throw new AppError(403, 'FORBIDDEN', 'You can only review your own bookings.');
    }
    if (!REVIEWABLE_BOOKING_STATUSES.includes(booking.status)) {
      throw new AppError(
        409,
        'REVIEW_TARGET_NOT_COMPLETE',
        'A stay can be reviewed once you have checked out.',
        { bookingId, bookingStatus: booking.status }
      );
    }

    return booking;
  }

  const order = await client.order.findUnique({ where: { orderId } });

  if (!order) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Please correct the highlighted fields.', {
      orderId: 'Unknown order.',
    });
  }
  if (order.customerId !== customerId) {
    throw new AppError(403, 'FORBIDDEN', 'You can only review your own orders.');
  }
  if (!REVIEWABLE_ORDER_STATUSES.includes(order.status)) {
    throw new AppError(
      409,
      'REVIEW_TARGET_NOT_COMPLETE',
      'An order can be reviewed once it has been completed.',
      { orderId, orderStatus: order.status }
    );
  }

  return order;
}

/**
 * Records a review.
 *
 * Exactly one target, and one review per target. The uniqueness is enforced by
 * the database constraint as well as the check below — two submissions racing
 * each other would both pass a read-then-write (CLAUDE.md §4).
 */
async function create({ customerId, bookingId = null, orderId = null, rating: value, comment }) {
  if (!bookingId && !orderId) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Please correct the highlighted fields.', {
      bookingId: 'A review must be against a booking or an order.',
    });
  }
  if (bookingId && orderId) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Please correct the highlighted fields.', {
      orderId: 'Review either a booking or an order, not both.',
    });
  }

  try {
    return await prisma.$transaction(async (tx) => {
      await loadTarget(tx, { customerId, bookingId, orderId });

      const existing = await tx.review.findFirst({
        where: bookingId ? { bookingId } : { orderId },
        select: { reviewId: true },
      });

      if (existing) {
        throw new AppError(409, 'REVIEW_EXISTS', 'This has already been reviewed.', {
          reviewId: existing.reviewId,
        });
      }

      const review = await tx.review.create({
        data: {
          customerId,
          bookingId,
          orderId,
          rating: value,
          comment: comment ?? null,
        },
        include: FULL_INCLUDE,
      });

      return publicReview(review);
    });
  } catch (err) {
    // The unique index is the real guard; translate it to the same error the
    // check above raises so the client sees one code either way.
    if (err.code === 'P2002') {
      throw new AppError(409, 'REVIEW_EXISTS', 'This has already been reviewed.');
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Aggregates
// ---------------------------------------------------------------------------

/**
 * Average rating per room type, from reviews on bookings of its rooms.
 *
 * Raw SQL because the aggregate crosses three relations
 * (review -> booking -> room -> room type), which `groupBy` cannot express.
 * Counts are cast to int so they arrive as numbers rather than BigInt.
 */
async function ratingsByRoomType(roomTypeId) {
  const rows = roomTypeId
    ? await prisma.$queryRaw`
        SELECT rm.room_type_id AS "id",
               COUNT(r.review_id)::int AS "count",
               AVG(r.rating)::float8 AS "average"
        FROM reviews r
        JOIN bookings b ON b.booking_id = r.booking_id
        JOIN rooms rm ON rm.room_id = b.room_id
        WHERE rm.room_type_id = ${roomTypeId}
        GROUP BY rm.room_type_id
      `
    : await prisma.$queryRaw`
        SELECT rm.room_type_id AS "id",
               COUNT(r.review_id)::int AS "count",
               AVG(r.rating)::float8 AS "average"
        FROM reviews r
        JOIN bookings b ON b.booking_id = r.booking_id
        JOIN rooms rm ON rm.room_id = b.room_id
        GROUP BY rm.room_type_id
      `;

  return rows.map((row) => ({ id: Number(row.id), ...rating(row) }));
}

/**
 * Average rating per menu item, from reviews on orders the item appeared on.
 *
 * The inner DISTINCT matters: an order listing the same item on two lines must
 * not count its review twice.
 */
async function ratingsByFood(foodId) {
  const rows = foodId
    ? await prisma.$queryRaw`
        SELECT "id", COUNT(*)::int AS "count", AVG("rating")::float8 AS "average"
        FROM (
          SELECT DISTINCT oi.food_id AS "id", r.review_id, r.rating AS "rating"
          FROM reviews r
          JOIN order_items oi ON oi.order_id = r.order_id
          WHERE oi.food_id = ${foodId}
        ) t
        GROUP BY "id"
      `
    : await prisma.$queryRaw`
        SELECT "id", COUNT(*)::int AS "count", AVG("rating")::float8 AS "average"
        FROM (
          SELECT DISTINCT oi.food_id AS "id", r.review_id, r.rating AS "rating"
          FROM reviews r
          JOIN order_items oi ON oi.order_id = r.order_id
        ) t
        GROUP BY "id"
      `;

  return rows.map((row) => ({ id: Number(row.id), ...rating(row) }));
}

/** Aggregate for one room type or menu item, plus its most recent comments. */
async function summary({ roomTypeId, foodId, recent = 5 }) {
  const [aggregate] = roomTypeId
    ? await ratingsByRoomType(roomTypeId)
    : await ratingsByFood(foodId);

  const reviews = await prisma.review.findMany({
    where: roomTypeId
      ? { booking: { room: { roomTypeId } } }
      : { order: { orderItems: { some: { foodId } } } },
    include: FULL_INCLUDE,
    orderBy: { reviewId: 'desc' },
    take: recent,
  });

  return {
    target: roomTypeId ? { roomTypeId } : { foodId },
    rating: aggregate ? { average: aggregate.average, count: aggregate.count } : rating(null),
    recent: reviews.map(publicReview),
  };
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

async function list({ customerId, page = 1, pageSize } = {}) {
  const take = Math.min(pageSize || config.defaultPageSize, config.maxPageSize);
  const skip = (page - 1) * take;

  const where = customerId ? { customerId } : {};

  const [reviews, total] = await Promise.all([
    prisma.review.findMany({
      where,
      include: FULL_INCLUDE,
      orderBy: { reviewId: 'desc' },
      skip,
      take,
    }),
    prisma.review.count({ where }),
  ]);

  return {
    reviews: reviews.map(publicReview),
    meta: {
      page,
      pageSize: take,
      total,
      totalPages: Math.max(1, Math.ceil(total / take)),
    },
  };
}

module.exports = {
  create,
  list,
  summary,
  ratingsByFood,
  ratingsByRoomType,
  publicReview,
  MIN_RATING,
  MAX_RATING,
  REVIEWABLE_BOOKING_STATUSES,
  REVIEWABLE_ORDER_STATUSES,
};
