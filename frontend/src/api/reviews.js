import client from './client'

/** Leave a review against a completed booking or order (SRS §4.9). */
export async function createReview({ bookingId, orderId, rating, comment }) {
  const { data } = await client.post('/reviews', {
    booking_id: bookingId ?? null,
    order_id: orderId ?? null,
    rating,
    comment: comment || null,
  })
  return data.data
}

/** The signed-in customer's own reviews — used to hide "Leave review" twice. */
export async function listMyReviews() {
  const { data } = await client.get('/reviews', { params: { mine: 'true', page_size: 100 } })
  return data.data
}

/**
 * Aggregate ratings for every menu item or room type, as
 * `[{ id, average, count }]`. One request per listing rather than one per row.
 */
export async function listRatings(groupBy) {
  const { data } = await client.get('/reviews', { params: { group_by: groupBy } })
  return data.data
}

/** Aggregate + recent comments for one menu item or room type. */
export async function getRatingSummary({ foodId, roomTypeId }) {
  const params = {}
  if (foodId) params.food_id = foodId
  if (roomTypeId) params.room_type_id = roomTypeId

  const { data } = await client.get('/reviews', { params })
  return data.data
}

/** Keys an aggregate list by id, so a row can look its own rating up. */
export function byId(ratings = []) {
  return new Map(ratings.map((entry) => [entry.id, entry]))
}
