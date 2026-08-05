import { BarChart3, Download } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { errorMessage } from '../../api/client'
import { downloadReportCsv, listReports, runReport } from '../../api/reports'
import PageMeta from '../../components/PageMeta'
import {
  Button,
  Card,
  CardBody,
  DatePicker,
  EmptyState,
  FilterBar,
  PageHeader,
  ResponsiveTable,
  Skeleton,
  ToggleGroup,
} from '../../components/ui'
import { useToast } from '../../context/ToastContext'
import cn from '../../lib/cn'

const DAY_MS = 24 * 60 * 60 * 1000

const iso = (date) => date.toISOString().slice(0, 10)

/** A window ending today and reaching `days` back. */
function rangeOfDays(days) {
  const to = new Date()
  return { from: iso(new Date(to.getTime() - days * DAY_MS)), to: iso(to) }
}

/** Default window: the last 30 days, matching the backend's own default. */
const defaultRange = () => rangeOfDays(29)

const PRESETS = [
  { value: 6, label: 'Last 7 days' },
  { value: 29, label: 'Last 30 days' },
  { value: 89, label: 'Last 90 days' },
]

/** Column keys that hold money or percentages, so they align right. */
const NUMERIC_HEADERS =
  /^(bookings|revenue|billed|collected|subtotal|discount|tax|qty|share|net|received|refunded|transactions|rooms|utilisation|cancelled)/i

/**
 * Reports (SRS §6).
 *
 * Report types, their columns and their summary fields all come from the API —
 * the canvas renders whatever shape it is handed rather than knowing about any
 * particular report, so adding one is a backend change alone. Which reports
 * appear is a permission question answered server-side (CLAUDE.md §4: financial
 * reports are Manager, Accountant and Super Admin only).
 */
export default function Reports() {
  const toast = useToast()

  const [reports, setReports] = useState([])
  const [reportsLoading, setReportsLoading] = useState(true)
  const [active, setActive] = useState(null)
  const [range, setRange] = useState(defaultRange)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    listReports()
      .then((available) => {
        setReports(available)
        setActive((current) => current ?? available[0]?.slug ?? null)
      })
      .catch((err) => toast.error(errorMessage(err, 'Could not load the report list.')))
      .finally(() => setReportsLoading(false))
  }, [toast])

  const run = useCallback(async () => {
    if (!active) return

    setLoading(true)
    setError(null)
    try {
      setResult(await runReport(active, range))
    } catch (err) {
      setResult(null)
      setError(errorMessage(err, 'Could not run the report.'))
    } finally {
      setLoading(false)
    }
  }, [active, range])

  useEffect(() => {
    run()
  }, [run])

  async function handleExport() {
    setExporting(true)
    try {
      const filename = await downloadReportCsv(active, range)
      toast.success(`Exported ${filename}.`)
    } catch (err) {
      toast.error(errorMessage(err, 'Could not export the report.'))
    } finally {
      setExporting(false)
    }
  }

  // The preset row deselects itself once the dates are edited by hand, rather
  // than leaving a segment lit for a range that is no longer selected.
  const activePreset =
    PRESETS.find((preset) => {
      const candidate = rangeOfDays(preset.value)
      return candidate.from === range.from && candidate.to === range.to
    })?.value ?? null

  const activeReport = reports.find((report) => report.slug === active)

  const columns = useMemo(() => {
    const declared = (result?.columns ?? []).map((column, index) => {
      const numeric = NUMERIC_HEADERS.test(column.header)
      return {
        key: column.key,
        header: column.header,
        primary: index === 0,
        align: numeric ? 'right' : 'left',
        className: numeric ? 'tabular-nums text-neutral-900' : undefined,
        render: (row) => row[column.key] ?? '—',
      }
    })

    // Before the first run there are no columns to describe; one placeholder
    // keeps the skeleton and empty states a sane width.
    return declared.length > 0
      ? declared
      : [{ key: '_report', header: 'Report', primary: true, render: () => null }]
  }, [result])

  return (
    <>
      <PageMeta title="Reports" noIndex />

      <PageHeader
        title="Reports"
        subtitle="Every report covers the selected date range and exports to CSV."
        breadcrumbs={[{ label: 'Finance' }, { label: 'Reports' }]}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[15rem_1fr]">
        {/* --------------------------------------------------- report types */}
        <Card as="nav" aria-label="Report types" className="h-fit" padding="sm">
          {reportsLoading ? (
            <div className="space-y-2" role="status" aria-busy="true">
              <span className="sr-only">Loading reports</span>
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-9 w-full" />
              ))}
            </div>
          ) : reports.length === 0 ? (
            <EmptyState
              size="sm"
              icon={BarChart3}
              title="No reports available"
              description="Your role does not have access to any reports."
              className="px-0"
            />
          ) : (
            <ul className="space-y-0.5">
              {reports.map((report) => {
                const selected = active === report.slug
                return (
                  <li key={report.slug}>
                    <button
                      type="button"
                      onClick={() => setActive(report.slug)}
                      aria-current={selected ? 'page' : undefined}
                      className={cn(
                        'w-full rounded px-3 py-2 text-left text-sm font-medium',
                        'transition-colors duration-hover ease-out',
                        selected
                          ? 'bg-primary-800 text-white'
                          : 'text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900'
                      )}
                    >
                      {report.title}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>

        {/* --------------------------------------------------------- canvas */}
        <div className="min-w-0">
          <FilterBar className="sm:items-end">
            <DatePicker
              label="From"
              size="sm"
              fieldClassName="w-full sm:w-44"
              value={range.from}
              max={range.to}
              onChange={(event) => setRange((r) => ({ ...r, from: event.target.value }))}
            />

            <DatePicker
              label="To"
              size="sm"
              fieldClassName="w-full sm:w-44"
              value={range.to}
              min={range.from}
              onChange={(event) => setRange((r) => ({ ...r, to: event.target.value }))}
            />

            <ToggleGroup
              size="sm"
              ariaLabel="Date range preset"
              value={activePreset}
              onChange={(days) => setRange(rangeOfDays(days))}
              options={PRESETS}
            />

            <Button
              variant="secondary"
              iconLeft={Download}
              className="sm:ml-auto"
              loading={exporting}
              disabled={!result || result.rows.length === 0}
              onClick={handleExport}
            >
              Export CSV
            </Button>
          </FilterBar>

          {result?.summary && <Summary summary={result.summary} />}

          <Card className="mt-4 overflow-hidden">
            <ResponsiveTable
              columns={columns}
              rows={result?.rows ?? []}
              rowKey={(row, index) => index}
              loading={loading}
              error={error}
              onRetry={run}
              caption={activeReport ? `${activeReport.title} results` : 'Report results'}
              empty={
                <EmptyState
                  icon={BarChart3}
                  title="No data in this date range"
                  description="Widen the range or pick a different report."
                  action={
                    <Button variant="secondary" onClick={() => setRange(rangeOfDays(89))}>
                      Try the last 90 days
                    </Button>
                  }
                />
              }
            />
          </Card>
        </div>
      </div>
    </>
  )
}

/**
 * Renders whichever summary fields the active report returned.
 *
 * `from`, `to` and `note` are skipped: the first two are already shown in the
 * date pickers, and the note reads as a footnote rather than a figure.
 */
function Summary({ summary }) {
  const entries = Object.entries(summary).filter(([key]) => !['from', 'to', 'note'].includes(key))

  if (entries.length === 0) return null

  return (
    <Card className="mt-4">
      <CardBody>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {entries.map(([key, value]) => (
            <div key={key}>
              <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                {key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())}
              </dt>
              <dd className="mt-1 text-lg font-semibold tabular-nums text-neutral-900">
                {String(value)}
              </dd>
            </div>
          ))}
        </dl>

        {summary.note && <p className="mt-3 text-xs text-neutral-500">{summary.note}</p>}
      </CardBody>
    </Card>
  )
}
