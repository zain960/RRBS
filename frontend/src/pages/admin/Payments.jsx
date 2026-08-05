import { Download, Wallet } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import { errorMessage } from '../../api/client'
import { listPayments } from '../../api/payments'
import PageMeta from '../../components/PageMeta'
import {
  Button,
  Card,
  DatePicker,
  EmptyState,
  FilterBar,
  PageHeader,
  ResponsiveTable,
  Select,
  StatusChip,
} from '../../components/ui'
import { useToast } from '../../context/ToastContext'
import { dateTime, money, number } from '../../lib/format'
import {
  PAYMENT_METHOD,
  PAYMENT_STATUS,
  PAYMENT_TYPE,
  statusMeta,
  statusOptions,
} from '../../lib/statuses'

const EMPTY_FILTERS = { method: '', paymentType: '', status: '', from: '', to: '' }

/** A status map as filter options, with an "everything" entry first. */
function allOption(label, map) {
  return [{ value: '', label }, ...statusOptions(map)]
}

const CSV_COLUMNS = [
  { key: 'id', header: 'Payment ID' },
  { key: 'paidAt', header: 'Paid at' },
  { key: 'against', header: 'Against' },
  { key: 'bookingId', header: 'Booking ID' },
  { key: 'orderId', header: 'Order ID' },
  { key: 'customerName', header: 'Customer' },
  { key: 'roomNumber', header: 'Room' },
  { key: 'amount', header: 'Amount' },
  { key: 'method', header: 'Method' },
  { key: 'paymentType', header: 'Type' },
  { key: 'status', header: 'Status' },
  { key: 'transactionRef', header: 'Reference' },
]

/**
 * Escapes one CSV cell. A leading =, +, - or @ is prefixed with a quote so a
 * spreadsheet treats it as text rather than a formula.
 */
function csvCell(value) {
  if (value === null || value === undefined) return ''
  let text = String(value)
  if (/^[=+\-@]/.test(text)) text = `'${text}`
  return `"${text.replace(/"/g, '""')}"`
}

function toCsv(rows) {
  const header = CSV_COLUMNS.map((c) => csvCell(c.header)).join(',')
  const body = rows.map((row) => CSV_COLUMNS.map((c) => csvCell(row[c.key])).join(','))
  return [header, ...body].join('\r\n')
}

/**
 * The payment ledger.
 *
 * Read-only: payments are created by the booking and order flows, and an
 * accountant's job here is to find, reconcile and export rather than edit
 * (CLAUDE.md §4 — Accountant has no booking/order editing rights).
 *
 * Amounts come off the API as decimal strings and are only ever formatted for
 * display; the "net" figure in the filter bar is computed server-side so the
 * refund subtraction never happens in JS floats (CLAUDE.md §3 Money).
 */
export default function Payments() {
  const toast = useToast()

  const [payments, setPayments] = useState([])
  const [meta, setMeta] = useState({ total: 0, settledTotal: '0.00' })
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // One large page: the ledger is a report, and the CSV should cover the
      // whole filtered set rather than whichever page happens to be open.
      const result = await listPayments({ ...filters, pageSize: 100 })
      setPayments(result.payments)
      setMeta(result.meta)
    } catch (err) {
      setError(errorMessage(err, 'Could not load payments.'))
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    refresh()
  }, [refresh])

  function setFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }))
  }

  function handleExport() {
    if (payments.length === 0) {
      toast.error('Nothing to export.')
      return
    }

    const blob = new Blob([toCsv(payments)], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')

    link.href = url
    link.download = `payments-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    toast.success(`Exported ${payments.length} payment${payments.length === 1 ? '' : 's'}.`)
  }

  const isFiltered = Object.values(filters).some(Boolean)

  const columns = [
    {
      key: 'paidAt',
      header: 'Paid at',
      primary: true,
      render: (payment) => (
        <span className="whitespace-nowrap text-neutral-600">{dateTime(payment.paidAt)}</span>
      ),
    },
    {
      key: 'against',
      header: 'Against',
      render: (payment) => (
        <div className="min-w-0">
          <p className="truncate text-neutral-900">
            {payment.against}
            {payment.bookingId ? ` #${payment.bookingId}` : ''}
            {payment.orderId ? ` #${payment.orderId}` : ''}
          </p>
          {payment.roomNumber && (
            <p className="mt-0.5 text-xs text-neutral-400">Room {payment.roomNumber}</p>
          )}
        </div>
      ),
    },
    {
      key: 'customer',
      header: 'Customer',
      hideBelow: 'lg',
      render: (payment) => payment.customerName ?? '—',
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      render: (payment) =>
        // A refund is money leaving, so it reads as a negative rather than
        // sitting in the column looking like income.
        payment.paymentType === 'REFUND' ? (
          <span className="whitespace-nowrap tabular-nums text-danger">
            − {money(payment.amount)}
          </span>
        ) : (
          <span className="whitespace-nowrap font-medium tabular-nums text-neutral-900">
            {money(payment.amount)}
          </span>
        ),
    },
    {
      key: 'method',
      header: 'Method',
      hideBelow: 'lg',
      render: (payment) => statusMeta(PAYMENT_METHOD, payment.method).label,
    },
    {
      key: 'paymentType',
      header: 'Type',
      hideBelow: 'md',
      render: (payment) => statusMeta(PAYMENT_TYPE, payment.paymentType).label,
    },
    {
      key: 'status',
      header: 'Status',
      render: (payment) => <StatusChip map={PAYMENT_STATUS} value={payment.status} size="sm" />,
    },
    {
      key: 'reference',
      header: 'Reference',
      hideBelow: 'lg',
      render: (payment) => (
        <span className="font-mono text-xs text-neutral-500">{payment.transactionRef ?? '—'}</span>
      ),
    },
  ]

  return (
    <>
      <PageMeta title="Payments" noIndex />

      <PageHeader
        title="Payments"
        subtitle="Every payment taken against a booking or an order, including refunds."
        breadcrumbs={[{ label: 'Finance' }, { label: 'Payments' }]}
        actions={
          <Button
            variant="secondary"
            iconLeft={Download}
            onClick={handleExport}
            disabled={loading || payments.length === 0}
          >
            Export CSV
          </Button>
        }
      />

      <FilterBar className="sm:items-end">
        <Select
          label="Method"
          size="sm"
          fieldClassName="w-full sm:w-40"
          value={filters.method}
          onChange={(event) => setFilter('method', event.target.value)}
          options={allOption('All methods', PAYMENT_METHOD)}
        />

        <Select
          label="Type"
          size="sm"
          fieldClassName="w-full sm:w-40"
          value={filters.paymentType}
          onChange={(event) => setFilter('paymentType', event.target.value)}
          options={allOption('All types', PAYMENT_TYPE)}
        />

        <Select
          label="Status"
          size="sm"
          fieldClassName="w-full sm:w-40"
          value={filters.status}
          onChange={(event) => setFilter('status', event.target.value)}
          options={allOption('All statuses', PAYMENT_STATUS)}
        />

        <DatePicker
          label="From"
          size="sm"
          fieldClassName="w-full sm:w-44"
          value={filters.from}
          max={filters.to || undefined}
          onChange={(event) => setFilter('from', event.target.value)}
        />

        <DatePicker
          label="To"
          size="sm"
          fieldClassName="w-full sm:w-44"
          value={filters.to}
          min={filters.from || undefined}
          onChange={(event) => setFilter('to', event.target.value)}
        />

        {isFiltered && (
          <Button variant="ghost" size="sm" onClick={() => setFilters(EMPTY_FILTERS)}>
            Clear filters
          </Button>
        )}

        <div className="text-sm sm:ml-auto sm:text-right" aria-live="polite">
          <p className="text-xs text-neutral-500">
            {loading
              ? 'Loading…'
              : `${number(meta.total)} payment${meta.total === 1 ? '' : 's'}`}
          </p>
          <p className="font-semibold tabular-nums text-neutral-900">
            {money(meta.settledTotal, { alwaysDecimals: true })} net
          </p>
          {Number(meta.refunded ?? 0) > 0 && (
            <p className="text-xs tabular-nums text-neutral-500">
              {money(meta.received)} in · {money(meta.refunded)} refunded
            </p>
          )}
        </div>
      </FilterBar>

      <Card className="overflow-hidden">
        <ResponsiveTable
          columns={columns}
          rows={payments}
          rowKey={(payment) => payment.id}
          loading={loading}
          error={error}
          onRetry={refresh}
          caption="Payments taken against bookings and orders"
          empty={
            <EmptyState
              icon={Wallet}
              title={isFiltered ? 'No payments match these filters' : 'No payments yet'}
              description={
                isFiltered
                  ? 'Try a wider date range, or clear the filters to see the full ledger.'
                  : 'Payments appear here as soon as the desk takes one against a booking or an order.'
              }
              action={
                isFiltered ? (
                  <Button variant="secondary" onClick={() => setFilters(EMPTY_FILTERS)}>
                    Clear filters
                  </Button>
                ) : (
                  <Button to="/admin/bookings">Go to bookings</Button>
                )
              }
            />
          }
        />
      </Card>

      {!loading && !error && meta.total > payments.length && (
        <p className="mt-3 text-xs text-neutral-500">
          Showing the most recent {number(payments.length)} of {number(meta.total)}. Narrow the date
          range to export an earlier period.
        </p>
      )}
    </>
  )
}
