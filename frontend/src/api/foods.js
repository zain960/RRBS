import client from './client'

/** Back-office listing — includes items marked Unavailable. */
export async function listFoods(filters = {}) {
  const params = {}
  if (filters.categoryId) params.categoryId = filters.categoryId
  if (filters.availabilityStatus) params.availabilityStatus = filters.availabilityStatus

  const { data } = await client.get('/foods', { params })
  return data.data
}

/** Public menu — grouped by category, Available items only. */
export async function fetchMenu() {
  const { data } = await client.get('/menu')
  return data.data
}

export async function createFood(payload) {
  const { data } = await client.post('/foods', payload)
  return data.data
}

export async function updateFood(id, payload) {
  const { data } = await client.put(`/foods/${id}`, payload)
  return data.data
}

export async function updateFoodAvailability(id, availabilityStatus) {
  const { data } = await client.patch(`/foods/${id}/availability`, { availabilityStatus })
  return data.data
}

export async function deleteFood(id) {
  const { data } = await client.delete(`/foods/${id}`)
  return data.data
}
