import client from './client'

export async function login(email, password) {
  const { data } = await client.post('/auth/login', { email, password })
  return data.data // { user, token }
}

export async function register(payload) {
  const { data } = await client.post('/auth/register', payload)
  return data.data // { user, token }
}

export async function logout() {
  const { data } = await client.post('/auth/logout')
  return data.data
}

export async function me() {
  const { data } = await client.get('/auth/me')
  return data.data.user
}

/**
 * Changes the signed-in user's own password. The account is taken from the
 * bearer token server-side, so there is nothing to identify here.
 */
export async function changePassword(currentPassword, newPassword) {
  const { data } = await client.patch('/auth/password', { currentPassword, newPassword })
  return data.data
}
