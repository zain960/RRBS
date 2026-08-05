import {
  ArrowRight,
  BedDouble,
  CalendarCheck,
  Mail,
  MapPin,
  Phone,
  ReceiptText,
  ShieldCheck,
  UtensilsCrossed,
} from 'lucide-react'
import { useEffect, useState } from 'react'

import { listBookings } from '../api/bookings'
import { listOrders } from '../api/orders'
import PageMeta from '../components/PageMeta'
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Skeleton,
  StatusChip,
} from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { dateRange, dateTime, money } from '../lib/format'
import { BOOKING_STATUS, ORDER_STATUS } from '../lib/statuses'

/**
 * The guest's account home.
 *
 * A summary rather than a place to work: the two counters answer "is anything
 * happening right now", and everything else links to the screen that owns it.
 * Staff who land here get a way back to the back office instead of being told
 * about rooms they are not booking.
 */
export default function Account() {
  const { user, role } = useAuth()

  const [bookings, setBookings] = useState(null)
  const [orders, setOrders] = useState(null)

  useEffect(() => {
    listBookings({ page_size: 3 })
      .then((result) => setBookings(result.bookings))
      .catch(() => setBookings([]))

    listOrders({ pageSize: 3 })
      .then(setOrders)
      .catch(() => setOrders([]))
  }, [])

  const isStaff = role && role !== 'Customer'

  return (
    <>
      <PageMeta title="Account" noIndex />

      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        {/* ── Identity ─────────────────────────────────────────────────── */}
        <Card variant="default" padding="lg">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <Avatar name={user?.fullName} size="lg" />

            <div className="min-w-0 flex-1">
              <h1 className="font-display text-2xl font-semibold text-neutral-900">
                {user?.fullName}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-neutral-500">
                {user?.email && (
                  <span className="inline-flex items-center gap-1.5">
                    <Mail size={14} aria-hidden="true" />
                    {user.email}
                  </span>
                )}
                {user?.phone && (
                  <span className="inline-flex items-center gap-1.5">
                    <Phone size={14} aria-hidden="true" />
                    {user.phone}
                  </span>
                )}
                {user?.address && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin size={14} aria-hidden="true" />
                    {user.address}
                  </span>
                )}
              </div>
            </div>

            <Badge tone={isStaff ? 'primary' : 'neutral'} size="lg" icon={ShieldCheck} dot={false}>
              {role ?? 'Guest'}
            </Badge>
          </div>

          {isStaff && (
            <div className="mt-5 flex flex-wrap gap-2 border-t border-neutral-200 pt-5">
              <Button to="/admin" iconRight={ArrowRight}>
                Open the back office
              </Button>
            </div>
          )}
        </Card>

        {/* ── Quick actions ────────────────────────────────────────────── */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <ActionCard
            icon={BedDouble}
            title="Book a room"
            description="Check availability for any window from two hours upwards."
            to="/book"
          />
          <ActionCard
            icon={UtensilsCrossed}
            title="Order food"
            description="Dine-in, takeaway, delivery — or room service while you're checked in."
            to="/order"
          />
        </div>

        {/* ── Recent activity ──────────────────────────────────────────── */}
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader
              title="Recent bookings"
              action={
                <Button variant="link" size="sm" to="/my-bookings" iconRight={ArrowRight}>
                  View all
                </Button>
              }
            />
            <CardBody className="p-0">
              {bookings === null ? (
                <LoadingRows />
              ) : bookings.length === 0 ? (
                <EmptyState
                  size="sm"
                  icon={CalendarCheck}
                  title="No bookings yet"
                  description="Your stays will appear here once you book one."
                  action={
                    <Button size="sm" to="/book">
                      Find a room
                    </Button>
                  }
                />
              ) : (
                <ul className="divide-y divide-neutral-100">
                  {bookings.map((booking) => (
                    <li key={booking.id} className="flex items-center gap-3 px-5 py-3.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-neutral-900">
                          {booking.room?.roomNumber
                            ? `Room ${booking.room.roomNumber}`
                            : 'Room booking'}
                          {booking.room?.typeName ? ` · ${booking.room.typeName}` : ''}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-neutral-500">
                          {dateRange(booking.checkInDatetime, booking.checkOutDatetime)}
                        </p>
                      </div>
                      <StatusChip map={BOOKING_STATUS} value={booking.status} size="sm" />
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Recent orders"
              action={
                <Button variant="link" size="sm" to="/my-orders" iconRight={ArrowRight}>
                  View all
                </Button>
              }
            />
            <CardBody className="p-0">
              {orders === null ? (
                <LoadingRows />
              ) : orders.length === 0 ? (
                <EmptyState
                  size="sm"
                  icon={ReceiptText}
                  title="No orders yet"
                  description="Anything you order from the kitchen shows up here."
                  action={
                    <Button size="sm" to="/menu">
                      Browse the menu
                    </Button>
                  }
                />
              ) : (
                <ul className="divide-y divide-neutral-100">
                  {orders.map((order) => (
                    <li key={order.id} className="flex items-center gap-3 px-5 py-3.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-neutral-900">
                          Order #{order.id} · {money(order.pricing?.totalAmount)}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-neutral-500">
                          {dateTime(order.createdAt)}
                        </p>
                      </div>
                      <StatusChip map={ORDER_STATUS} value={order.status} size="sm" />
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  )
}

function ActionCard({ icon: Icon, title, description, to }) {
  return (
    <Card variant="default" padding="md" interactive as="div" className="group">
      <div className="flex items-start gap-4">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-accent-50 text-accent-600">
          <Icon size={21} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
          <p className="mt-1 text-sm leading-relaxed text-neutral-500">{description}</p>
          <Button variant="link" size="sm" to={to} iconRight={ArrowRight} className="mt-2">
            {title}
          </Button>
        </div>
      </div>
    </Card>
  )
}

function LoadingRows() {
  return (
    <div role="status" aria-busy="true" className="divide-y divide-neutral-100">
      <span className="sr-only">Loading</span>
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="flex items-center gap-3 px-5 py-3.5">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-2/5" rounded="rounded-sm" />
            <Skeleton className="h-3 w-3/5" rounded="rounded-sm" />
          </div>
          <Skeleton className="h-5 w-20" rounded="rounded-full" />
        </div>
      ))}
    </div>
  )
}
