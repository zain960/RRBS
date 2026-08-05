import client from './client'

/** The reports this user's role may run. */
export async function listReports() {
  const { data } = await client.get('/reports')
  return data.data
}

/** Returns { rows, columns, summary, title } — one shape for every report. */
export async function runReport(slug, { from, to } = {}) {
  const params = {}
  if (from) params.from = from
  if (to) params.to = to

  const { data } = await client.get(`/reports/${slug}`, { params })
  return {
    rows: data.data,
    columns: data.meta.columns,
    summary: data.meta.summary,
    title: data.meta.title,
  }
}

/**
 * Downloads a report as CSV.
 *
 * Fetched through the axios client rather than a plain link so the bearer token
 * is attached — the endpoint is behind the same role guard as the JSON form.
 */
export async function downloadReportCsv(slug, { from, to } = {}) {
  const params = { format: 'csv' }
  if (from) params.from = from
  if (to) params.to = to

  const response = await client.get(`/reports/${slug}`, { params, responseType: 'blob' })

  const disposition = response.headers['content-disposition'] ?? ''
  const match = disposition.match(/filename="?([^";]+)"?/)
  const filename = match ? match[1] : `${slug}-report.csv`

  const url = URL.createObjectURL(response.data)
  const link = document.createElement('a')

  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)

  return filename
}
