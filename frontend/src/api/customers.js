import client from './client'

/** The guest register (SRS §4.1). Paginated, with a name/email/phone search. */
export async function listCustomers({ page = 1, pageSize, search } = {}) {
  const params = { page }
  if (pageSize) params.page_size = pageSize
  if (search) params.q = search

  const { data } = await client.get('/customers', { params })
  return { customers: data.data, meta: data.meta }
}

/** One guest plus their five most recent bookings and orders. */
export async function getCustomer(id) {
  const { data } = await client.get(`/customers/${id}`)
  return data.data
}
