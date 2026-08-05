import client from './client'

export async function listTables(filters = {}) {
  const params = {}
  if (filters.status) params.status = filters.status
  if (filters.location) params.location = filters.location

  const { data } = await client.get('/tables', { params })
  return data.data
}

/** Free tables only — public, used by the customer dine-in picker. */
export async function listAvailableTables() {
  const { data } = await client.get('/tables/available')
  return data.data
}

export async function createTable(payload) {
  const { data } = await client.post('/tables', payload)
  return data.data
}

export async function updateTable(id, payload) {
  const { data } = await client.put(`/tables/${id}`, payload)
  return data.data
}

export async function updateTableStatus(id, status) {
  const { data } = await client.patch(`/tables/${id}/status`, { status })
  return data.data
}

export async function deleteTable(id) {
  const { data } = await client.delete(`/tables/${id}`)
  return data.data
}
