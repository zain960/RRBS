import client from './client'

export async function getDashboardSummary() {
  const { data } = await client.get('/dashboard/summary')
  return data.data
}

/** Daily net take, rooms vs food, for the dashboard trend chart. */
export async function getRevenueSeries(days = 30) {
  const { data } = await client.get('/dashboard/revenue-series', { params: { days } })
  return data.data
}
