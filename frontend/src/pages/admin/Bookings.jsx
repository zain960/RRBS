import { CalendarCheck, ExternalLink, LogIn, LogOut, Search, XCircle } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import {
  cancelBooking,
  checkInBooking,
  checkOutBooking,
  confirmBooking,
  listBookings,
} from '../../api/bookings'
import { errorMessage } from '../../api/client'
import PageMeta from '../../components/PageMeta'
import {
  Button,
  Card,
  ConfirmDialog,
  DatePicker,
  EmptyState,
  FilterBar,
  InputControl,
  PageHeader,
  Pagination,
  ResponsiveTable,
  SelectControl,
  StatusChip,
} from '../../components/ui'
import { useToast } from '../../context/ToastContext'
import { dateRange, money, number } from '../../lib/format'
import { BOOKING_STATUS, statusOptions } from '../../lib/statuses'

/**
 * The reservation ledger (SRS §4.3).
 *
 * Which actions appear on a row comes from the booking's own status, mirroring
 * the lifecycle the service enforces: Pending confirms, Confirmed checks in,
 * Checked-in checks out, and anything not yet occupied can be cancelled. The
 * API validates every transition regardless (CLAUDE.md §4).
 */
export default function Bookings() {
  const toast = useToast()
  const [searchParams, setSearchParams] = useSearchParams()

  const [bookings, setBookings] = useState([])
  const [meta, setMeta] = useState({ page: 1, pageSize: 20, total: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busyId, setBusyId] = useState(null)

  const [filters, setFilters] = useState({
    status: '',
    from: '',
    to: '',
    q: searchParams.get('q') ?? '',
  })
  const [page, setPage] = useState(1)
  const [confirmState, setConfirmState] = useState(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = { page }
      if (filters.status) params.status = filters.status
      if (filters.from) params.from = new Date(filters.from).toISOString()
      if (filters.to) params.to = new Date(filters.to).toISOString()

      const result = await listBookings(params)
      setBookings(result.bookings)
      setMeta(result.meta)
    } catch (err) {
      setError(errorMessage(err, 'Could not load bookings.'))
    } finally {
      setLoading(false)
    }
  }, [filters.status, filters.from, filters.to, page])

  useEffect(() => {
    refresh()
  }, [refresh])

  async function runAction() {
    const { booking, action, verb } = confirmState
    setBusyId(booking.id)
    try {
      await action(booking.id)
      toast.success(`Booking #${booking.id} ${verb}.`)
      setConfirmState(null)
      refresh()
    } catch (err) {
      toast.error(errorMessage(err, `Could not ${verb.replace(/ed$/, '')} the booking.`))
    } finally {
      setBusyId(null)
    }
  }

  /**
   * A local text filter over the current page. The list endpoint has no search
   * parameter, so this narrows what is already loaded rather than pretending to
   * search the whole ledger.
   */
  const visible = filters.q
    ? bookings.filter((booking) => {
        const needle = filters.q.toLowerCase()
        return (
          String(booking.id).includes(needle) ||
          (booking.customer?.fullName ?? '').toLowerCase().includes(needle) ||
          (booking.guestName ?? '').toLowerCase().includes(needle) ||
          (booking.room?.roomNumber ?? '').toLowerCase().includes(needle)
        )
      })
    : bookings

  const columns = [
    {
      key: 'booking',
      header: 'Booking',
      primary: true,
      render: (booking) => (
        <div className="min-w-0">
          <p className="font-medium text-neutral-900">
            #{booking.id}
            {booking.room?.roomNumber ? ` · Room ${booking.room.roomNumber}` : ''}
          </p>
          <p className="truncate text-xs text-neutral-500">
            {booking.customer?.fullName ?? booking.guestName ?? 'Guest'}
            {booking.room?.typeName ? ` · ${booking.room.typeName}` : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'window',
      header: 'Stay',
      hideBelow: 'md',
      render: (booking) => (
        <span className="text-neutral-600">
          {dateRange(booking.checkInDatetime, booking.checkOutDatetime)}
        </span>
      ),
    },
    {
      key: 'guests',
      header: 'Guests',
      align: 'right',
      hideBelow: 'lg',
      render: (booking) => (
        <span className="tabular-nums text-neutral-600">{number(booking.guestCount)}</span>
      ),
    },
    {
      key: 'total',
      header: 'Total',
      align: 'right',
      render: (booking) => (
        <span className="font-medium tabular-nums text-neutral-900">
          {money(booking.pricing?.totalAmount)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (booking) => <StatusChip map={BOOKING_STATUS} value={booking.status} />,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      width: 'w-64',
      render: (booking) => (
        <div
          className="flex flex-wrap justify-end gap-1.5"
          onClick={(event) => event.stopPropagation()}
        >
          {booking.status === 'PENDING' && (
            <Button
              size="sm"
              variant="secondary"
              disabled={busyId === booking.id}
              onClick={() =>
                setConfirmState({
                  booking,
                  action: confirmBooking,
                  verb: 'confirmed',
                  title: 'Confirm this booking?',
                  message: `Booking #${booking.id} moves to Confirmed. It must be paid in full or in part first — the API will refuse otherwise.`,
                  tone: 'primary',
                  label: 'Confirm booking',
                })
              }
            >
              Confirm
            </Button>
          )}

          {booking.status === 'CONFIRMED' && (
            <Button
              size="sm"
              variant="secondary"
              iconLeft={LogIn}
              disabled={busyId === booking.id}
              onClick={() =>
                setConfirmState({
                  booking,
                  action: checkInBooking,
                  verb: 'checked in',
                  title: 'Check this guest in?',
                  message: `Room ${booking.room?.roomNumber ?? ''} becomes Occupied. Check-in is only allowed on or after the scheduled start time.`,
                  tone: 'primary',
                  label: 'Check in',
                })
              }
            >
              Check in
            </Button>
          )}

          {booking.status === 'CHECKED_IN' && (
            <Button
              size="sm"
              variant="secondary"
              iconLeft={LogOut}
              disabled={busyId === booking.id}
              onClick={() =>
                setConfirmState({
                  booking,
                  action: checkOutBooking,
                  verb: 'checked out',
                  title: 'Check this guest out?',
                  message: `The final bill is generated and the room is released. Any room-service orders must already be billed to the room.`,
                  tone: 'primary',
                  label: 'Check out',
                })
              }
            >
              Check out
            </Button>
          )}

          {['PENDING', 'CONFIRMED'].includes(booking.status) && (
            <Button
              size="sm"
              variant="ghost"
              iconOnly
              iconLeft={XCircle}
              aria-label={`Cancel booking ${booking.id}`}
              className="text-danger hover:bg-red-50"
              disabled={busyId === booking.id}
              onClick={() =>
                setConfirmState({
                  booking,
                  action: (id) => cancelBooking(id, 'Cancelled by staff'),
                  verb: 'cancelled',
                  title: 'Cancel this booking?',
                  message: `Booking #${booking.id} is cancelled and the room released. Refunds follow the configured cancellation window.`,
                  tone: 'danger',
                  label: 'Cancel booking',
                })
              }
            />
          )}

          {/* Button renders a router Link when given `to`. */}
          <Button
            size="sm"
            variant="ghost"
            iconOnly
            iconLeft={ExternalLink}
            to={`/admin/bookings/${booking.id}`}
            aria-label={`Open booking ${booking.id}`}
          />
        </div>
      ),
    },
  ]

  const anyFilter = filters.status || filters.from || filters.to || filters.q

  return (
    <>
      <PageMeta title="Bookings" noIndex />

      <PageHeader
        title="Bookings"
        subtitle="Confirm, check in, check out and cancel reservations."
        breadcrumbs={[{ label: 'Front desk' }, { label: 'Bookings' }]}
        actions={
          <Button to="/book" iconLeft={CalendarCheck}>
            New booking
          </Button>
        }
      />

      <FilterBar>
        <div className="w-full sm:max-w-xs">
          <label htmlFor="booking-search" className="sr-only">
            Search this page
          </label>
          <InputControl
            id="booking-search"
            type="search"
            size="sm"
            iconLeft={Search}
            placeholder="Reference, guest or room…"
            value={filters.q}
            onChange={(event) => {
              const value = event.target.value
              setFilters((current) => ({ ...current, q: value }))
              setSearchParams(value ? { q: value } : {}, { replace: true })
            }}
          />
        </div>

        <div className="w-full sm:w-44">
          <label htmlFor="filter-status" className="sr-only">
            Filter by status
          </label>
          <SelectControl
            id="filter-status"
            size="sm"
            value={filters.status}
            onChange={(event) => {
              setPage(1)
              setFilters((current) => ({ ...current, status: event.target.value }))
            }}
            options={[{ value: '', label: 'All statuses' }, ...statusOptions(BOOKING_STATUS)]}
          />
        </div>

        <div className="flex gap-2">
          <DatePicker
            id="from"
            size="sm"
            aria-label="From date"
            value={filters.from}
            onChange={(event) => {
              setPage(1)
              setFilters((current) => ({ ...current, from: event.target.value }))
            }}
          />
          <DatePicker
            id="to"
            size="sm"
            aria-label="To date"
            value={filters.to}
            onChange={(event) => {
              setPage(1)
              setFilters((current) => ({ ...current, to: event.target.value }))
            }}
          />
        </div>

        {anyFilter && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setFilters({ status: '', from: '', to: '', q: '' })
              setSearchParams({}, { replace: true })
              setPage(1)
            }}
          >
            Clear
          </Button>
        )}

        <p className="text-xs text-neutral-500 sm:ml-auto" aria-live="polite">
          {loading ? 'Loading…' : `${number(meta.total)} booking${meta.total === 1 ? '' : 's'}`}
        </p>
      </FilterBar>

      <Card className="overflow-hidden">
        <ResponsiveTable
          columns={columns}
          rows={visible}
          rowKey={(booking) => booking.id}
          loading={loading}
          error={error}
          onRetry={refresh}
          caption="Reservations"
          empty={
            <EmptyState
              icon={CalendarCheck}
              title={anyFilter ? 'No bookings match' : 'No bookings yet'}
              description={
                anyFilter
                  ? 'Try widening the date range or clearing the status filter.'
                  : 'Reservations appear here as guests book, or as the desk creates them.'
              }
              action={
                anyFilter ? (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setFilters({ status: '', from: '', to: '', q: '' })
                      setSearchParams({}, { replace: true })
                    }}
                  >
                    Clear filters
                  </Button>
                ) : (
                  <Button to="/book">Create a booking</Button>
                )
              }
            />
          }
        />

        {!loading && !error && bookings.length > 0 && (
          <Pagination
            page={meta.page}
            pageSize={meta.pageSize}
            total={meta.total}
            onPageChange={setPage}
          />
        )}
      </Card>

      <ConfirmDialog
        open={Boolean(confirmState)}
        onClose={() => setConfirmState(null)}
        onConfirm={runAction}
        loading={busyId === confirmState?.booking?.id}
        tone={confirmState?.tone ?? 'primary'}
        title={confirmState?.title}
        message={confirmState?.message ?? ''}
        confirmLabel={confirmState?.label ?? 'Confirm'}
      />
    </>
  )
}
