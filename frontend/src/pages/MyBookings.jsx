import {
  CalendarCheck,
  ChevronDown,
  MessageSquarePlus,
  Users,
  XCircle,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import { cancelBooking, listBookings } from '../api/bookings'
import { errorMessage } from '../api/client'
import { listMyReviews } from '../api/reviews'
import ReviewDialog from '../components/domain/ReviewDialog'
import PageMeta from '../components/PageMeta'
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Skeleton,
  StatusChip,
  Tabs,
} from '../components/ui'
import { useToast } from '../context/ToastContext'
import cn from '../lib/cn'
import { dateRange, dateTimeLong, money } from '../lib/format'
import { BOOKING_STATUS } from '../lib/statuses'

/** A stay can be reviewed once it is over (SRS §4.9). */
const REVIEWABLE = ['CHECKED_OUT']

/** Cancellation is only offered while the room has not been occupied yet. */
const CANCELLABLE = ['PENDING', 'CONFIRMED']

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'past', label: 'Past' },
]

/**
 * The guest's own stays.
 *
 * A timeline rather than a table: these are events in a person's life, and the
 * one thing they want at a glance is what is happening next. Rows expand in
 * place for the full breakdown so the list never loses its position.
 */
export default function MyBookings() {
  const toast = useToast()

  const [bookings, setBookings] = useState([])
  const [reviewed, setReviewed] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [filter, setFilter] = useState('all')
  const [expanded, setExpanded] = useState(null)
  const [reviewTarget, setReviewTarget] = useState(null)
  const [cancelTarget, setCancelTarget] = useState(null)
  const [cancelling, setCancelling] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [{ bookings: rows }, reviews] = await Promise.all([
        listBookings({ page_size: 50 }),
        listMyReviews(),
      ])
      setBookings(rows)
      setReviewed(new Set(reviews.map((review) => review.bookingId).filter(Boolean)))
    } catch (err) {
      setError(errorMessage(err, 'Could not load your bookings.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function handleCancel() {
    setCancelling(true)
    try {
      await cancelBooking(cancelTarget.id, 'Cancelled by customer')
      toast.success(`Booking #${cancelTarget.id} cancelled.`)
      setCancelTarget(null)
      load()
    } catch (err) {
      toast.error(errorMessage(err, 'Could not cancel the booking.'))
    } finally {
      setCancelling(false)
    }
  }

  const now = Date.now()
  const visible = bookings.filter((booking) => {
    if (filter === 'upcoming') return new Date(booking.checkOutDatetime).getTime() >= now
    if (filter === 'past') return new Date(booking.checkOutDatetime).getTime() < now
    return true
  })

  return (
    <>
      <PageMeta title="My bookings" noIndex />

      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="font-display text-3xl font-semibold text-neutral-900">My bookings</h1>
            <p className="mt-1.5 text-sm text-neutral-500">
              Every stay you've booked, past and upcoming.
            </p>
          </div>
          <Button to="/book">Book another room</Button>
        </header>

        <Tabs
          tabs={FILTERS.map((entry) => ({
            ...entry,
            count:
              entry.value === 'all'
                ? bookings.length
                : bookings.filter((booking) =>
                    entry.value === 'upcoming'
                      ? new Date(booking.checkOutDatetime).getTime() >= now
                      : new Date(booking.checkOutDatetime).getTime() < now
                  ).length,
          }))}
          value={filter}
          onChange={setFilter}
          variant="pill"
          ariaLabel="Filter bookings"
          className="mb-6"
        />

        {loading ? (
          <LoadingTimeline />
        ) : error ? (
          <Card>
            <ErrorState message={error} onRetry={load} />
          </Card>
        ) : visible.length === 0 ? (
          <Card>
            <EmptyState
              icon={CalendarCheck}
              title={filter === 'all' ? 'No bookings yet' : `No ${filter} bookings`}
              description={
                filter === 'all'
                  ? 'When you book a room it will appear here, with your reference and the full breakdown.'
                  : 'Try the All tab to see your complete history.'
              }
              action={
                filter === 'all' ? (
                  <Button to="/book">Find a room</Button>
                ) : (
                  <Button variant="secondary" onClick={() => setFilter('all')}>
                    Show all
                  </Button>
                )
              }
            />
          </Card>
        ) : (
          <ol className="space-y-3">
            {visible.map((booking) => (
              <BookingRow
                key={booking.id}
                booking={booking}
                expanded={expanded === booking.id}
                onToggle={() => setExpanded(expanded === booking.id ? null : booking.id)}
                canReview={REVIEWABLE.includes(booking.status) && !reviewed.has(booking.id)}
                hasReview={reviewed.has(booking.id)}
                onReview={() =>
                  setReviewTarget({ bookingId: booking.id, label: `booking #${booking.id}` })
                }
                onCancel={() => setCancelTarget(booking)}
              />
            ))}
          </ol>
        )}
      </div>

      <ReviewDialog
        open={Boolean(reviewTarget)}
        target={reviewTarget}
        onClose={() => setReviewTarget(null)}
        onSaved={load}
      />

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        onClose={() => setCancelTarget(null)}
        onConfirm={handleCancel}
        loading={cancelling}
        title="Cancel this booking?"
        message={
          cancelTarget
            ? `Booking #${cancelTarget.id} for ${dateRange(
                cancelTarget.checkInDatetime,
                cancelTarget.checkOutDatetime
              )} will be released. Any refund follows the property's cancellation policy.`
            : ''
        }
        confirmLabel="Cancel booking"
        cancelLabel="Keep it"
      />
    </>
  )
}

function BookingRow({ booking, expanded, onToggle, canReview, hasReview, onReview, onCancel }) {
  const cancellable = CANCELLABLE.includes(booking.status)
  const panelId = `booking-${booking.id}-detail`

  return (
    <li>
      <Card variant="default" className="overflow-hidden">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-controls={panelId}
          className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors duration-hover hover:bg-neutral-50"
        >
          {/* Timeline marker: the status colour is the whole point of the rail. */}
          <span
            aria-hidden="true"
            className={cn(
              'h-10 w-1 shrink-0 rounded-full',
              booking.status === 'CHECKED_IN' && 'bg-success',
              booking.status === 'CONFIRMED' && 'bg-info',
              booking.status === 'PENDING' && 'bg-warning',
              booking.status === 'CANCELLED' && 'bg-danger',
              booking.status === 'NO_SHOW' && 'bg-warning',
              booking.status === 'CHECKED_OUT' && 'bg-neutral-300'
            )}
          />

          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-neutral-900">
              {booking.room?.roomNumber ? `Room ${booking.room.roomNumber}` : 'Room booking'}
              {booking.room?.typeName ? ` · ${booking.room.typeName}` : ''}
            </p>
            <p className="mt-0.5 truncate text-sm text-neutral-500">
              {dateRange(booking.checkInDatetime, booking.checkOutDatetime)}
            </p>
          </div>

          <div className="hidden shrink-0 text-right sm:block">
            <p className="font-semibold tabular-nums text-neutral-900">
              {money(booking.pricing?.totalAmount)}
            </p>
            <p className="text-xs text-neutral-400">#{booking.id}</p>
          </div>

          <StatusChip map={BOOKING_STATUS} value={booking.status} />

          <ChevronDown
            size={18}
            aria-hidden="true"
            className={cn(
              'shrink-0 text-neutral-400 transition-transform duration-state',
              expanded && 'rotate-180'
            )}
          />
        </button>

        {expanded && (
          <div id={panelId} className="border-t border-neutral-200 px-5 py-4">
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              <Fact label="Reference" value={`RRBS-${String(booking.id).padStart(6, '0')}`} />
              <Fact label="Duration" value={booking.duration?.name ?? '—'} />
              <Fact label="Check-in" value={dateTimeLong(booking.checkInDatetime)} />
              <Fact label="Check-out" value={dateTimeLong(booking.checkOutDatetime)} />
              <Fact
                label="Guests"
                value={
                  <span className="inline-flex items-center gap-1.5">
                    <Users size={13} aria-hidden="true" />
                    {booking.guestCount}
                  </span>
                }
              />
              {booking.guestName && <Fact label="Guest name" value={booking.guestName} />}
              {booking.specialRequests && (
                <Fact
                  label="Special requests"
                  value={booking.specialRequests}
                  className="sm:col-span-2"
                />
              )}
            </dl>

            <div className="mt-5 border-t border-neutral-200 pt-4">
              <dl className="space-y-2 text-sm">
                <Line label="Subtotal" value={money(booking.pricing?.subtotal)} />
                <Line
                  label="Discount"
                  value={`− ${money(booking.pricing?.discountAmount)}`}
                  muted={Number(booking.pricing?.discountAmount) === 0}
                />
                <Line label="Tax" value={money(booking.pricing?.taxAmount)} />
                <div className="border-t border-neutral-200 pt-2">
                  <Line
                    label="Total"
                    value={money(booking.pricing?.totalAmount, { alwaysDecimals: true })}
                    strong
                  />
                </div>
              </dl>
            </div>

            {(cancellable || canReview || hasReview) && (
              <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-neutral-200 pt-4">
                {cancellable && (
                  <Button variant="danger" size="sm" iconLeft={XCircle} onClick={onCancel}>
                    Cancel booking
                  </Button>
                )}
                {canReview && (
                  <Button
                    variant="secondary"
                    size="sm"
                    iconLeft={MessageSquarePlus}
                    onClick={onReview}
                  >
                    Leave a review
                  </Button>
                )}
                {hasReview && (
                  <Badge tone="success" size="md">
                    Reviewed
                  </Badge>
                )}
              </div>
            )}
          </div>
        )}
      </Card>
    </li>
  )
}

function LoadingTimeline() {
  return (
    <div role="status" aria-busy="true" className="space-y-3">
      <span className="sr-only">Loading your bookings</span>
      {Array.from({ length: 4 }).map((_, index) => (
        <Skeleton key={index} className="h-[74px] w-full" rounded="rounded-lg" />
      ))}
    </div>
  )
}

function Fact({ label, value, className }) {
  return (
    <div className={className}>
      <dt className="text-xs uppercase tracking-wide text-neutral-400">{label}</dt>
      <dd className="mt-0.5 text-sm text-neutral-800">{value}</dd>
    </div>
  )
}

function Line({ label, value, strong, muted }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className={strong ? 'font-medium text-neutral-900' : 'text-neutral-500'}>{label}</dt>
      <dd
        className={cn(
          'tabular-nums',
          strong ? 'text-base font-semibold text-neutral-900' : muted ? 'text-neutral-400' : 'text-neutral-700'
        )}
      >
        {value}
      </dd>
    </div>
  )
}
