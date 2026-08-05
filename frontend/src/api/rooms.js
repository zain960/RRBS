import client from './client'

export async function listRooms(filters = {}) {
  const params = {}
  if (filters.roomTypeId) params.roomTypeId = filters.roomTypeId
  if (filters.status) params.status = filters.status

  const { data } = await client.get('/rooms', { params })
  return data.data
}

export async function listAvailableRooms(filters = {}) {
  const { data } = await client.get('/rooms/available', { params: filters })
  return data.data
}

export async function createRoom(payload) {
  const { data } = await client.post('/rooms', payload)
  return data.data
}

export async function updateRoom(id, payload) {
  const { data } = await client.put(`/rooms/${id}`, payload)
  return data.data
}

export async function updateRoomStatus(id, status) {
  const { data } = await client.patch(`/rooms/${id}/status`, { status })
  return data.data
}

export async function deleteRoom(id) {
  const { data } = await client.delete(`/rooms/${id}`)
  return data.data
}
