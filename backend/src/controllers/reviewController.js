const reviewService = require('../services/reviewService');
const { ok, AppError, asyncHandler } = require('../lib/http');
const { Validator } = require('../lib/validate');
const config = require('../lib/config');

/** Staff who may read the full review log rather than just the aggregates. */
const REVIEW_STAFF_ROLES = ['Super Admin', 'Manager', 'Receptionist'];

const GROUPS = ['food', 'room_type'];

/**
 * POST /api/reviews — { booking_id | order_id, rating, comment? }
 *
 * Customers only: a review is a guest's opinion of their own stay or order
 * (SRS §4.9, §5.4). Staff recording feedback on a guest's behalf is not in the
 * SRS and would make the author unattributable.
 */
const create = asyncHandler(async (req, res) => {
  const body = req.body ?? {};

  if (req.auth.accountType !== 'customer') {
    throw new AppError(403, 'FORBIDDEN', 'Only a customer can leave a review.', {
      yourRole: req.auth.roleName,
    });
  }

  const { bookingId, orderId, rating, comment } = new Validator({
    bookingId: body.booking_id ?? body.bookingId,
    orderId: body.order_id ?? body.orderId,
    rating: body.rating,
    comment: body.comment,
  })
    .integer('bookingId', { required: false, min: 1, label: 'Booking' })
    .integer('orderId', { required: false, min: 1, label: 'Order' })
    .integer('rating', {
      min: reviewService.MIN_RATING,
      max: reviewService.MAX_RATING,
      label: 'Rating',
    })
    .string('comment', { required: false, max: 2000, label: 'Comment' })
    .result();

  const review = await reviewService.create({
    customerId: req.auth.userId,
    bookingId: bookingId ?? null,
    orderId: orderId ?? null,
    rating,
    comment: comment ?? null,
  });

  return ok(res, review, {}, 201);
});

/**
 * GET /api/reviews?food_id=&room_type_id=&group_by=&mine=true
 *
 * Four shapes, one endpoint:
 *   - `food_id` / `room_type_id` -> that item's aggregate rating + recent comments
 *   - `group_by=food|room_type`  -> one aggregate per item, for the admin listings
 *   - `mine=true`                -> the caller's own reviews
 *   - no filter                  -> the full review log (staff only)
 *
 * Aggregates are public: a rating is shown next to a room type or a dish
 * wherever it appears, including on the public menu.
 */
const list = asyncHandler(async (req, res) => {
  const q = req.query;

  const { page, pageSize, foodId, roomTypeId, groupBy } = new Validator({
    page: q.page ?? 1,
    pageSize: q.pageSize ?? q.page_size ?? config.defaultPageSize,
    foodId: q.food_id ?? q.foodId,
    roomTypeId: q.room_type_id ?? q.roomTypeId,
    groupBy: q.group_by ?? q.groupBy,
  })
    .integer('page', { min: 1, label: 'Page' })
    .integer('pageSize', { min: 1, max: config.maxPageSize, label: 'Page size' })
    .integer('foodId', { required: false, min: 1, label: 'Menu item' })
    .integer('roomTypeId', { required: false, min: 1, label: 'Room type' })
    .enum('groupBy', GROUPS, { required: false, label: 'Group by' })
    .result();

  if (foodId && roomTypeId) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Please correct the highlighted fields.', {
      roomTypeId: 'Filter by a menu item or a room type, not both.',
    });
  }

  if (foodId || roomTypeId) {
    const result = await reviewService.summary({
      foodId: foodId ?? undefined,
      roomTypeId: roomTypeId ?? undefined,
    });
    return ok(res, result, { total: result.rating.count });
  }

  if (groupBy) {
    const ratings =
      groupBy === 'food'
        ? await reviewService.ratingsByFood()
        : await reviewService.ratingsByRoomType();
    return ok(res, ratings, { groupBy, total: ratings.length });
  }

  const mine = String(q.mine ?? '') === 'true';

  if (!req.auth) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required.');
  }
  if (mine && req.auth.accountType !== 'customer') {
    throw new AppError(403, 'FORBIDDEN', 'Only a customer has their own reviews.');
  }
  if (!mine && !REVIEW_STAFF_ROLES.includes(req.auth.roleName)) {
    throw new AppError(403, 'FORBIDDEN', 'Your role cannot read the full review log.', {
      requiredRoles: REVIEW_STAFF_ROLES,
      yourRole: req.auth.roleName,
    });
  }

  const result = await reviewService.list({
    customerId: mine ? req.auth.userId : undefined,
    page,
    pageSize,
  });

  return ok(res, result.reviews, { ...result.meta, mine });
});

module.exports = { create, list };
