import {
  BedDouble,
  CalendarClock,
  CheckCircle2,
  DoorOpen,
  LogIn,
  Receipt,
  UserRound,
  Wallet,
  XCircle,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

import {
  addPayment,
  cancelBooking,
  checkInBooking,
  checkOutBooking,
  confirmBooking,
  getBooking,
} from '../../api/bookings'
import { errorMessage } from '../../api/client'
import PageMeta from '../../components/PageMeta'
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Input,
  ResponsiveTable,
  Select,
  Skeleton,
  StatusChip,
} from '../../components/ui'
import { useToast } from '../../context/ToastContext'
import { dateRange, dateTime, dateTimeLong, money, number } from '../../lib/format'
import { isPositiveMoney, remainingMoney, subtractMoney, sumMoney } from '../../lib/money'
import {
  BOOKING_STATUS,
  ORDER_STATUS,
  PAYMENT_METHOD,
  PAYMENT_STATUS,
  PAYMENT_TYPE,
  ROOM_STATUS,
  statusOptions,
} from '../../lib/statuses'

/** Statuses past which no further money is taken at the desk. */
const CLOSED_STATUSES = ['CANCELLED', 'NO_SHOW', 'CHECKED_OUT']

const EMPTY_PAYMENT = { amount: '', method: 'CASH', paymentType: 'ADVANCE' }

/**
 * One booking, end to end (SRS §4.6).
 *
 * The action buttons mirror the lifecycle rather than offering everything at
 * once: only the transition that is legal from the current status is rendered,
 * and the server validates it again regardless — this screen is a convenience,
 * not the enforcement point (CLAUDE.md §4 Lifecycle).
 *
 * Every figure in the pricing panel is read from the stored columns, because a
 * confirmed booking keeps the amounts it was charged even if the rate card or
 * the tax rate has moved since.
 */
export default function BookingDetail() {
  const { id } = useParams()
  const toast = useToast()

  const [booking, setBooking] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [payment, setPayment] = useState(EMPTY_PAYMENT)
  const [confirmCancel, setConfirmCancel] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setBooking(await getBooking(id))
    } catch (err) {
      setError(errorMessage(err, 'Could not load the booking.'))
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    refresh()
  }, [refresh])

  async function runAction(action, label) {
    setBusy(true)
    try {
      await action(id)
      toast.success(`Booking ${label}.`)
      await refresh()
    } catch (err) {
      // The service returns a distinguishable code for an illegal transition,
      // so the message is worth surfacing verbatim.
      toast.error(errorMessage(err, `Could not ${label} this booking.`))
    } finally {
      setBusy(false)
    }
  }

  async function handleCancel() {
    await runAction((bookingId) => cancelBooking(bookingId, 'Cancelled by staff'), 'cancelled')
    setConfirmCancel(false)
  }

  async function handlePayment(event) {
    event.preventDefault()
    setBusy(true)
    try {
      const result = await addPayment(id, {
        amount: payment.amount,
        method: payment.method,
        payment_type: payment.paymentType,
      })
      toast.success(
        isPositiveMoney(result.balance.outstanding)
          ? `Payment recorded. ${money(result.balance.outstanding)} still outstanding.`
          : 'Payment recorded. This booking is paid in full.'
      )
      setPayment((current) => ({ ...current, amount: '' }))
      await refresh()
    } catch (err) {
      toast.error(errorMessage(err, 'Could not record the payment.'))
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <DetailSkeleton />

  if (error || !booking) {
    return (
      <>
        <PageMeta title={`Booking #${id}`} noIndex />
        <Card>
          <ErrorState
            title="Booking not found"
            message={error ?? 'It may have been removed, or the reference is wrong.'}
            onRetry={refresh}
          />
        </Card>
      </>
    )
  }

  const payments = booking.payments ?? []
  const orders = booking.orders ?? []

  // Only settled money counts, and a refund moves the total back down.
  const paid = sumMoney(
    payments
      .filter((p) => p.status === 'COMPLETED')
      .map((p) => (p.paymentType === 'REFUND' ? subtractMoney('0', p.amount) : p.amount))
  )
  const outstanding = remainingMoney(booking.pricing.totalAmount, paid)

  const canTakePayment = !CLOSED_STATUSES.includes(booking.status)

  return (
    <>
      <PageMeta title={`Booking #${booking.id}`} noIndex />

      <header className="mb-6">
        <nav aria-label="Breadcrumb" className="mb-2">
          <Button variant="link" size="sm" to="/admin/bookings">
            ← All bookings
          </Button>
        </nav>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="flex flex-wrap items-center gap-3 text-2xl font-semibold text-neutral-900">
              Booking #{booking.id}
              <StatusChip map={BOOKING_STATUS} value={booking.status} />
            </h1>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-neutral-500">
              <CalendarClock size={16} aria-hidden="true" className="shrink-0" />
              {dateRange(booking.checkInDatetime, booking.checkOutDatetime)}
              {booking.duration?.name && ` · ${booking.duration.name}`}
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {booking.status === 'PENDING' && (
              <Button
                iconLeft={CheckCircle2}
                disabled={busy}
                onClick={() => runAction(confirmBooking, 'confirmed')}
              >
                Confirm
              </Button>
            )}

            {booking.status === 'CONFIRMED' && (
              <Button
                iconLeft={LogIn}
                disabled={busy}
                onClick={() => runAction(checkInBooking, 'checked in')}
              >
                Check in
              </Button>
            )}

            {booking.status === 'CHECKED_IN' && (
              <Button
                iconLeft={DoorOpen}
                disabled={busy}
                onClick={() => runAction(checkOutBooking, 'checked out')}
              >
                Check out
              </Button>
            )}

            {['PENDING', 'CONFIRMED'].includes(booking.status) && (
              <Button
                variant="secondary"
                iconLeft={XCircle}
                disabled={busy}
                className="text-danger"
                onClick={() => setConfirmCancel(true)}
              >
                Cancel
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        {/* ------------------------------------------------------ main column */}
        <div className="min-w-0 space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Card>
              <CardHeader title="Guest" />
              <CardBody>
                <dl className="space-y-2.5">
                  <Line icon={UserRound} label="Customer" value={booking.customer?.fullName} />
                  <Line label="Email" value={booking.customer?.email} />
                  <Line label="Phone" value={booking.customer?.phone} />
                  <Line label="Staying guest" value={booking.detail?.guestName} />
                  <Line
                    label="Guests"
                    value={booking.detail?.guestCount ? number(booking.detail.guestCount) : null}
                  />
                  <Line label="ID proof" value={booking.detail?.idProofNo} />
                  <Line label="Requests" value={booking.detail?.specialRequests} />
                </dl>
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Room" />
              <CardBody>
                <dl className="space-y-2.5">
                  <Line
                    icon={BedDouble}
                    label="Room"
                    value={booking.room?.roomNumber ? `Room ${booking.room.roomNumber}` : null}
                  />
                  <Line label="Type" value={booking.room?.roomType?.typeName} />
                  <Line
                    label="Room status"
                    value={
                      booking.room?.status ? (
                        <StatusChip map={ROOM_STATUS} value={booking.room.status} size="sm" />
                      ) : null
                    }
                  />
                  <Line label="Actual check-in" value={dateTimeLong(booking.actualCheckIn)} />
                  <Line label="Actual check-out" value={dateTimeLong(booking.actualCheckOut)} />
                </dl>
              </CardBody>
            </Card>
          </div>

          <Card>
            <CardHeader
              title="Room-service orders"
              subtitle="All linked orders must be billed to the room before checkout."
            />
            {orders.length === 0 ? (
              <EmptyState
                size="sm"
                icon={Receipt}
                title="No linked orders"
                description="Room-service orders placed during this stay appear here."
              />
            ) : (
              <ul className="divide-y divide-neutral-100">
                {orders.map((order) => (
                  <li key={order.id} className="flex items-center gap-3 px-5 py-3">
                    <span className="flex-1 truncate text-sm font-medium text-neutral-900">
                      Order #{order.id}
                    </span>
                    <StatusChip map={ORDER_STATUS} value={order.status} size="sm" />
                    <span className="w-24 text-right text-sm tabular-nums text-neutral-700">
                      {money(order.totalAmount)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="overflow-hidden">
            <CardHeader title="Payment history" />

            {payments.length === 0 ? (
              <EmptyState
                size="sm"
                icon={Wallet}
                title="No payments recorded"
                description="A booking must be paid in full or in part before it can be confirmed."
              />
            ) : (
              <ResponsiveTable
                columns={PAYMENT_COLUMNS}
                rows={payments}
                rowKey={(row) => row.id}
                stickyHeader={false}
                caption={`Payments against booking ${booking.id}`}
              />
            )}

            {canTakePayment && (
              <form
                onSubmit={handlePayment}
                className="flex flex-col gap-3 border-t border-neutral-200 bg-neutral-50/60 p-5 sm:flex-row sm:items-end"
              >
                <Input
                  label="Amount"
                  id="payment-amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  size="sm"
                  fieldClassName="w-full sm:w-36"
                  value={payment.amount}
                  onChange={(event) =>
                    setPayment((p) => ({ ...p, amount: event.target.value }))
                  }
                />

                <Select
                  label="Method"
                  id="payment-method"
                  size="sm"
                  fieldClassName="w-full sm:w-36"
                  value={payment.method}
                  onChange={(event) => setPayment((p) => ({ ...p, method: event.target.value }))}
                  options={statusOptions(PAYMENT_METHOD)}
                />

                <Select
                  label="Type"
                  id="payment-type"
                  size="sm"
                  fieldClassName="w-full sm:w-36"
                  value={payment.paymentType}
                  onChange={(event) =>
                    setPayment((p) => ({ ...p, paymentType: event.target.value }))
                  }
                  options={statusOptions(PAYMENT_TYPE)}
                />

                <Button type="submit" loading={busy} className="sm:ml-auto">
                  Record payment
                </Button>
              </form>
            )}
          </Card>
        </div>

        {/* ---------------------------------------------------- pricing panel */}
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <Card>
            <CardHeader
              title="Pricing"
              subtitle="Locked at confirmation — later rate changes do not apply."
            />
            <CardBody>
              <dl className="space-y-2.5">
                <Line label="Subtotal" value={money(booking.pricing.subtotal)} />
                <Line
                  label="Discount"
                  value={
                    isPositiveMoney(booking.pricing.discountAmount)
                      ? `− ${money(booking.pricing.discountAmount)}`
                      : money(0)
                  }
                />
                <Line label="Tax" value={money(booking.pricing.taxAmount)} />

                {booking.coupon && (
                  <Line
                    label="Coupon"
                    value={
                      <Badge tone="accent" size="sm" className="font-mono">
                        {booking.coupon.code}
                      </Badge>
                    }
                  />
                )}

                <div className="!mt-4 border-t border-neutral-200 pt-3">
                  <Line label="Total" value={money(booking.pricing.totalAmount)} strong />
                </div>

                <Line label="Paid" value={money(paid)} />
                <Line
                  label="Outstanding"
                  value={
                    <span className={isPositiveMoney(outstanding) ? 'text-danger' : 'text-success'}>
                      {money(outstanding)}
                    </span>
                  }
                  strong
                />
              </dl>
            </CardBody>
          </Card>
        </aside>
      </div>

      <ConfirmDialog
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        onConfirm={handleCancel}
        loading={busy}
        title="Cancel this booking?"
        message={`Booking #${booking.id} will be cancelled and the room released. Any refund is handled separately, under the refund window in system settings.`}
        confirmLabel="Cancel booking"
        cancelLabel="Keep booking"
      />
    </>
  )
}

const PAYMENT_COLUMNS = [
  {
    key: 'paidAt',
    header: 'Paid at',
    primary: true,
    render: (row) => (
      <span className="whitespace-nowrap text-neutral-600">{dateTime(row.paidAt)}</span>
    ),
  },
  {
    key: 'method',
    header: 'Method',
    render: (row) => <StatusChip map={PAYMENT_METHOD} value={row.method} size="sm" dot={false} />,
  },
  {
    key: 'paymentType',
    header: 'Type',
    render: (row) => <StatusChip map={PAYMENT_TYPE} value={row.paymentType} size="sm" dot={false} />,
  },
  {
    key: 'status',
    header: 'Status',
    render: (row) => <StatusChip map={PAYMENT_STATUS} value={row.status} size="sm" />,
  },
  {
    key: 'amount',
    header: 'Amount',
    align: 'right',
    render: (row) => (
      <span className="whitespace-nowrap font-medium tabular-nums text-neutral-900">
        {row.paymentType === 'REFUND' ? `− ${money(row.amount)}` : money(row.amount)}
      </span>
    ),
  },
]

/** A label/value row inside one of the detail cards. */
function Line({ icon: Icon, label, value, strong }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="flex shrink-0 items-center gap-1.5 text-sm text-neutral-500">
        {Icon && <Icon size={14} aria-hidden="true" />}
        {label}
      </dt>
      <dd
        className={
          strong
            ? 'min-w-0 break-words text-right text-sm font-semibold tabular-nums text-neutral-900'
            : 'min-w-0 break-words text-right text-sm text-neutral-800'
        }
      >
        {value === null || value === undefined || value === '' ? '—' : value}
      </dd>
    </div>
  )
}

function DetailSkeleton() {
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">Loading booking</span>

      <div className="mb-6 space-y-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-80" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Skeleton className="h-64 w-full rounded-lg" />
            <Skeleton className="h-64 w-full rounded-lg" />
          </div>
          <Skeleton className="h-40 w-full rounded-lg" />
          <Skeleton className="h-56 w-full rounded-lg" />
        </div>
        <Skeleton className="h-72 w-full rounded-lg" />
      </div>
    </div>
  )
}
