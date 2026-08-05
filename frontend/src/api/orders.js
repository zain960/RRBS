import client from './client'

export async function listOrders(filters = {}) {
  const params = {}
  if (filters.status) params.status = filters.status
  if (filters.orderType) params.order_type = filters.orderType
  if (filters.kitchenQueue) params.kitchen_queue = 'true'
  if (filters.customerId) params.customer_id = filters.customerId
  if (filters.pageSize) params.page_size = filters.pageSize

  const { data } = await client.get('/orders', { params })
  return data.data
}

export async function getOrder(id) {
  const { data } = await client.get(`/orders/${id}`)
  return data.data
}

export async function createOrder(payload) {
  const { data } = await client.post('/orders', payload)
  return data.data
}

export async function updateOrderStatus(id, status) {
  const { data } = await client.patch(`/orders/${id}/status`, { status })
  return data.data
}

/** The signed-in customer's checked-in stays — the room-service eligibility check. */
export async function listRoomServiceBookings() {
  const { data } = await client.get('/orders/room-service-bookings')
  return data.data
}

export async function payOrder(id, payload) {
  const { data } = await client.post(`/orders/${id}/payments`, payload)
  return data.data
}
