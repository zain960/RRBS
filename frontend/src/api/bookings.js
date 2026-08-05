import client from './client'

export async function listDurations() {
  const { data } = await client.get('/booking-durations')
  return data.data
}

/** Public availability search. Returns { rooms, meta }. */
export async function searchRooms({ checkIn, durationId, roomTypeId, guests }) {
  const { data } = await client.post('/bookings/search', {
    check_in: checkIn,
    duration_id: durationId,
    room_type_id: roomTypeId || undefined,
    guests: guests || undefined,
  })
  return { rooms: data.data.rooms, meta: data.meta }
}

export async function createBooking(payload) {
  const { data } = await client.post('/bookings', payload)
  return data.data
}

export async function listBookings(params = {}) {
  const { data } = await client.get('/bookings', { params })
  return { bookings: data.data, meta: data.meta }
}

export async function getBooking(id) {
  const { data } = await client.get(`/bookings/${id}`)
  return data.data
}

export async function addPayment(id, payload) {
  const { data } = await client.post(`/bookings/${id}/payments`, payload)
  return data.data
}

export async function confirmBooking(id) {
  const { data } = await client.patch(`/bookings/${id}/confirm`)
  return data.data
}

export async function checkInBooking(id) {
  const { data } = await client.patch(`/bookings/${id}/check-in`)
  return data.data
}

export async function checkOutBooking(id) {
  const { data } = await client.patch(`/bookings/${id}/check-out`)
  return data.data
}

export async function cancelBooking(id, reason) {
  const { data } = await client.patch(`/bookings/${id}/cancel`, { reason })
  return data.data
}
