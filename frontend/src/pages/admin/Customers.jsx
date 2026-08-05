import { CalendarCheck, Mail, Phone, ReceiptText, Search, UserPlus, UsersRound } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { errorMessage } from '../../api/client'
import { getCustomer, listCustomers } from '../../api/customers'
import PageMeta from '../../components/PageMeta'
import {
  Avatar,
  Badge,
  Button,
  Card,
  Drawer,
  EmptyState,
  FilterBar,
  InputControl,
  PageHeader,
  Pagination,
  ResponsiveTable,
  Skeleton,
  StatusChip,
} from '../../components/ui'
import { useToast } from '../../context/ToastContext'
import { dateOnly, dateRange, dateTime, money, number } from '../../lib/format'
import { BOOKING_STATUS, ORDER_STATUS, ORDER_TYPE, statusMeta } from '../../lib/statuses'

const PAGE_SIZE = 20

/**
 * The guest register.
 *
 * Read-only by design: guests own their own details and edit them through their
 * account, and staff have no business changing a password from here. What the
 * desk actually needs is to find someone quickly and see their history, which
 * is what the search and the detail drawer are for.
 *
 * Guest-checkout rows have no account (`hasAccount: false`) — SRS §7 allows a
 * booking without one — so the badge distinguishes them rather than implying
 * something is missing.
 */
export default function Customers() {
  const toast = useToast()

  const [customers, setCustomers] = useState([])
  const [meta, setMeta] = useState({ page: 1, pageSize: PAGE_SIZE, total: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)

  const [selected, setSelected] = useState(null)
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // One request per pause in typing rather than one per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const load = useMemo(
    () => () => {
      setLoading(true)
      setError(null)
      listCustomers({ page, pageSize: PAGE_SIZE, search: debouncedSearch })
        .then((result) => {
          setCustomers(result.customers)
          setMeta(result.meta)
        })
        .catch((err) => setError(errorMessage(err, 'Could not load the guest register.')))
        .finally(() => setLoading(false))
    },
    [page, debouncedSearch]
  )

  useEffect(load, [load])

  function openDetail(customer) {
    setSelected(customer)
    setDetail(null)
    setDetailLoading(true)
    getCustomer(customer.id)
      .then(setDetail)
      .catch((err) => {
        toast.error(errorMessage(err, 'Could not load this guest.'))
        setSelected(null)
      })
      .finally(() => setDetailLoading(false))
  }

  const columns = [
    {
      key: 'name',
      header: 'Guest',
      primary: true,
      render: (customer) => (
        <div className="flex items-center gap-3">
          <Avatar name={customer.fullName} size="sm" />
          <div className="min-w-0">
            <p className="truncate font-medium text-neutral-900">{customer.fullName}</p>
            <p className="truncate text-xs text-neutral-500">
              {customer.email ?? 'No email on file'}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'phone',
      header: 'Phone',
      hideBelow: 'lg',
      render: (customer) => <span className="tabular-nums">{customer.phone}</span>,
    },
    {
      key: 'account',
      header: 'Account',
      render: (customer) => (
        <Badge tone={customer.hasAccount ? 'success' : 'neutral'} size="sm">
          {customer.hasAccount ? 'Registered' : 'Guest checkout'}
        </Badge>
      ),
    },
    {
      key: 'bookings',
      header: 'Bookings',
      align: 'right',
      hideBelow: 'md',
      render: (customer) => <span className="tabular-nums">{number(customer.bookingCount)}</span>,
    },
    {
      key: 'orders',
      header: 'Orders',
      align: 'right',
      hideBelow: 'md',
      render: (customer) => <span className="tabular-nums">{number(customer.orderCount)}</span>,
    },
    {
      key: 'since',
      header: 'Registered',
      hideBelow: 'lg',
      render: (customer) => (
        <span className="text-neutral-500">{dateOnly(customer.createdAt)}</span>
      ),
    },
  ]

  return (
    <>
      <PageMeta title="Customers" noIndex />

      <PageHeader
        title="Customers"
        subtitle="Every guest who has booked a room or placed an order, including guest checkouts."
        breadcrumbs={[{ label: 'Front desk' }, { label: 'Customers' }]}
        actions={
          <Button variant="secondary" to="/admin/bookings" iconLeft={UserPlus}>
            New booking
          </Button>
        }
      />

      <FilterBar>
        <div className="w-full sm:max-w-xs">
          <label htmlFor="customer-search" className="sr-only">
            Search guests
          </label>
          <InputControl
            id="customer-search"
            type="search"
            size="sm"
            iconLeft={Search}
            placeholder="Name, email or phone…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <p className="text-xs text-neutral-500 sm:ml-auto" aria-live="polite">
          {loading ? 'Loading…' : `${number(meta.total)} guest${meta.total === 1 ? '' : 's'}`}
        </p>
      </FilterBar>

      <Card className="overflow-hidden">
        <ResponsiveTable
          columns={columns}
          rows={customers}
          rowKey={(customer) => customer.id}
          onRowClick={openDetail}
          loading={loading}
          error={error}
          onRetry={load}
          caption="Registered guests and guest checkouts"
          empty={
            <EmptyState
              icon={UsersRound}
              title={debouncedSearch ? 'No guests match that search' : 'No guests yet'}
              description={
                debouncedSearch
                  ? 'Try a partial name, an email address or the last few digits of a phone number.'
                  : 'Guests appear here as soon as someone registers or completes a booking at the desk.'
              }
              action={
                debouncedSearch ? (
                  <Button variant="secondary" onClick={() => setSearch('')}>
                    Clear search
                  </Button>
                ) : (
                  <Button to="/admin/bookings">Create a booking</Button>
                )
              }
            />
          }
        />

        {!loading && !error && customers.length > 0 && (
          <Pagination
            page={meta.page}
            pageSize={meta.pageSize}
            total={meta.total}
            onPageChange={setPage}
          />
        )}
      </Card>

      <CustomerDrawer
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        summary={selected}
        detail={detail}
        loading={detailLoading}
      />
    </>
  )
}

function CustomerDrawer({ open, onClose, summary, detail, loading }) {
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={summary?.fullName ?? 'Guest'}
      description={summary?.hasAccount ? 'Registered account' : 'Guest checkout — no account'}
      footer={
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      {loading || !detail ? (
        <div role="status" aria-busy="true" className="space-y-4">
          <span className="sr-only">Loading guest</span>
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : (
        <div className="space-y-7">
          <section>
            <dl className="space-y-2.5">
              <Detail icon={Mail} label="Email" value={detail.email ?? 'Not provided'} />
              <Detail icon={Phone} label="Phone" value={detail.phone} />
              {detail.address && <Detail label="Address" value={detail.address} />}
              {detail.cnicPassport && (
                <Detail label="CNIC / passport" value={detail.cnicPassport} />
              )}
              <Detail label="Loyalty points" value={number(detail.loyaltyPoints)} />
              <Detail label="Registered" value={dateOnly(detail.createdAt)} />
            </dl>
          </section>

          <section>
            <h3 className="mb-2.5 flex items-center gap-2 text-sm font-semibold text-neutral-900">
              <CalendarCheck size={16} aria-hidden="true" />
              Recent bookings
              <span className="text-neutral-400">({number(detail.bookingCount)} total)</span>
            </h3>

            {detail.recentBookings.length === 0 ? (
              <p className="rounded-lg bg-neutral-50 px-4 py-3 text-sm text-neutral-500">
                No bookings yet.
              </p>
            ) : (
              <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200">
                {detail.recentBookings.map((booking) => (
                  <li key={booking.id} className="flex items-center gap-3 px-3.5 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-neutral-900">
                        {booking.room?.roomNumber
                          ? `Room ${booking.room.roomNumber} · ${booking.room.typeName}`
                          : 'Room booking'}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-neutral-500">
                        {dateRange(booking.checkInDatetime, booking.checkOutDatetime)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <StatusChip map={BOOKING_STATUS} value={booking.status} size="sm" />
                      <p className="mt-1 text-xs font-medium tabular-nums text-neutral-600">
                        {money(booking.totalAmount)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h3 className="mb-2.5 flex items-center gap-2 text-sm font-semibold text-neutral-900">
              <ReceiptText size={16} aria-hidden="true" />
              Recent orders
              <span className="text-neutral-400">({number(detail.orderCount)} total)</span>
            </h3>

            {detail.recentOrders.length === 0 ? (
              <p className="rounded-lg bg-neutral-50 px-4 py-3 text-sm text-neutral-500">
                No orders yet.
              </p>
            ) : (
              <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200">
                {detail.recentOrders.map((order) => (
                  <li key={order.id} className="flex items-center gap-3 px-3.5 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-neutral-900">
                        #{order.id} · {statusMeta(ORDER_TYPE, order.orderType).label}
                      </p>
                      <p className="mt-0.5 text-xs text-neutral-500">{dateTime(order.createdAt)}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <StatusChip map={ORDER_STATUS} value={order.status} size="sm" />
                      <p className="mt-1 text-xs font-medium tabular-nums text-neutral-600">
                        {money(order.totalAmount)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </Drawer>
  )
}

function Detail({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="flex shrink-0 items-center gap-1.5 text-sm text-neutral-500">
        {Icon && <Icon size={14} aria-hidden="true" />}
        {label}
      </dt>
      <dd className="min-w-0 break-words text-right text-sm font-medium text-neutral-900">
        {value}
      </dd>
    </div>
  )
}
