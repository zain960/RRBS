import client from './client'

export async function listRoomTypes() {
  const { data } = await client.get('/room-types')
  return data.data
}

export async function createRoomType(payload) {
  const { data } = await client.post('/room-types', payload)
  return data.data
}

export async function updateRoomType(id, payload) {
  const { data } = await client.put(`/room-types/${id}`, payload)
  return data.data
}

export async function deleteRoomType(id) {
  const { data } = await client.delete(`/room-types/${id}`)
  return data.data
}
