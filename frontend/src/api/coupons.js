import client from './client'

export async function listCoupons(filters = {}) {
  const params = {}
  if (filters.isActive !== undefined && filters.isActive !== '') params.is_active = filters.isActive
  if (filters.applicableTo) params.applicable_to = filters.applicableTo

  const { data } = await client.get('/coupons', { params })
  return data.data
}

export async function createCoupon(payload) {
  const { data } = await client.post('/coupons', payload)
  return data.data
}

export async function updateCoupon(id, payload) {
  const { data } = await client.put(`/coupons/${id}`, payload)
  return data.data
}

export async function setCouponActive(id, isActive) {
  const { data } = await client.patch(`/coupons/${id}/active`, { is_active: isActive })
  return data.data
}

export async function deleteCoupon(id) {
  const { data } = await client.delete(`/coupons/${id}`)
  return data.data
}

/**
 * Checks a code without applying it. Always resolves — an invalid coupon comes
 * back as { valid: false, message } rather than as an HTTP error.
 */
export async function validateCoupon({ code, target, subtotal }) {
  const { data } = await client.post('/coupons/validate', { code, target, subtotal })
  return data.data
}
