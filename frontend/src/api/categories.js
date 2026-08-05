import client from './client'

export async function listCategories() {
  const { data } = await client.get('/categories')
  return data.data
}

export async function createCategory(payload) {
  const { data } = await client.post('/categories', payload)
  return data.data
}

export async function updateCategory(id, payload) {
  const { data } = await client.put(`/categories/${id}`, payload)
  return data.data
}

export async function deleteCategory(id) {
  const { data } = await client.delete(`/categories/${id}`)
  return data.data
}
