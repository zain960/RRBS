import client from './client'

/** Returns { payments, meta } — meta carries pagination and the filtered total. */
export async function listPayments(filters = {}) {
  const params = {}
  if (filters.method) params.method = filters.method
  if (filters.paymentType) params.payment_type = filters.paymentType
  if (filters.status) params.status = filters.status
  if (filters.bookingId) params.booking_id = filters.bookingId
  if (filters.orderId) params.order_id = filters.orderId
  if (filters.from) params.from = filters.from
  if (filters.to) params.to = filters.to
  if (filters.pageSize) params.page_size = filters.pageSize
  if (filters.page) params.page = filters.page

  const { data } = await client.get('/payments', { params })
  return { payments: data.data, meta: data.meta }
}

/** Records a payment against a booking or an order — exactly one of the two. */
export async function createPayment({
  bookingId,
  orderId,
  amount,
  method,
  paymentType,
  transactionRef,
}) {
  const { data } = await client.post('/payments', {
    booking_id: bookingId ?? null,
    order_id: orderId ?? null,
    amount,
    method,
    payment_type: paymentType,
    transaction_ref: transactionRef ?? null,
  })
  return data.data
}
