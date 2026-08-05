import client from './client'

/**
 * Notifications for the signed-in caller, newest first.
 *
 * `recipientId` is only accepted from a supervisor role — the API decides, and
 * silently scoping to the caller is not an option it offers: it answers 403.
 */
export async function listNotifications({ recipientId, recipientType, status, pageSize } = {}) {
  const params = {}
  if (recipientId) params.recipient_id = recipientId
  if (recipientType) params.recipient_type = recipientType
  if (status) params.status = status
  if (pageSize) params.page_size = pageSize

  const { data } = await client.get('/notifications', { params })
  return { notifications: data.data, meta: data.meta }
}
