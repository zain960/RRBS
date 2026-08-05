import { ChevronDown, MessageSquarePlus, ReceiptText } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import { errorMessage } from '../api/client'
import { listOrders } from '../api/orders'
import { listMyReviews } from '../api/reviews'
import ReviewDialog from '../components/domain/ReviewDialog'
import PageMeta from '../components/PageMeta'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Skeleton,
  StatusChip,
} from '../components/ui'
import cn from '../lib/cn'
import { dateTimeLong, money } from '../lib/format'
import { ORDER_STATUS, ORDER_TYPE, statusMeta } from '../lib/statuses'

/**
 * An order can be reviewed once it reached the end of its pipeline — which
 * differs by type: served in the restaurant, picked up, delivered, or billed to
 * the room (SRS §4.9).
 */
const REVIEWABLE = ['SERVED', 'PICKED_UP', 'DELIVERED', 'BILLED_TO_ROOM']

export default function MyOrders() {
  const [orders, setOrders] = useState([])
  const [reviewed, setReviewed] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [expanded, setExpanded] = useState(null)
  const [reviewTarget, setReviewTarget] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [rows, reviews] = await Promise.all([listOrders({ pageSize: 50 }), listMyReviews()])
      setOrders(rows)
      setReviewed(new Set(reviews.map((review) => review.orderId).filter(Boolean)))
    } catch (err) {
      setError(errorMessage(err, 'Could not load your orders.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <>
      <PageMeta title="My orders" noIndex />

      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="font-display text-3xl font-semibold text-neutral-900">My orders</h1>
            <p className="mt-1.5 text-sm text-neutral-500">
              Dine-in, takeaway, delivery and room service, newest first.
            </p>
          </div>
          <Button to="/menu">Order again</Button>
        </header>

        {loading ? (
          <div role="status" aria-busy="true" className="space-y-3">
            <span className="sr-only">Loading your orders</span>
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-[74px] w-full" rounded="rounded-lg" />
            ))}
          </div>
        ) : error ? (
          <Card>
            <ErrorState message={error} onRetry={load} />
          </Card>
        ) : orders.length === 0 ? (
          <Card>
            <EmptyState
              icon={ReceiptText}
              title="No orders yet"
              description="Anything you order from the kitchen — in the restaurant, to take away, delivered, or to your room — shows up here."
              action={<Button to="/menu">Browse the menu</Button>}
            />
          </Card>
        ) : (
          <ol className="space-y-3">
            {orders.map((order) => (
              <OrderRow
                key={order.id}
                order={order}
                expanded={expanded === order.id}
                onToggle={() => setExpanded(expanded === order.id ? null : order.id)}
                canReview={REVIEWABLE.includes(order.status) && !reviewed.has(order.id)}
                hasReview={reviewed.has(order.id)}
                onReview={() => setReviewTarget({ orderId: order.id, label: `order #${order.id}` })}
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
    </>
  )
}

function OrderRow({ order, expanded, onToggle, canReview, hasReview, onReview }) {
  const panelId = `order-${order.id}-detail`
  const typeMeta = statusMeta(ORDER_TYPE, order.orderType)
  const items = order.items ?? []

  const where = order.table
    ? `Table ${order.table.tableNumber}`
    : order.booking?.room
      ? `Room ${order.booking.room.roomNumber}`
      : order.deliveryAddress || null

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
          <span
            aria-hidden="true"
            className={cn(
              'h-10 w-1 shrink-0 rounded-full',
              ['SERVED', 'PICKED_UP', 'DELIVERED'].includes(order.status) && 'bg-success',
              ['PLACED'].includes(order.status) && 'bg-warning',
              ['PREPARING'].includes(order.status) && 'bg-warning',
              ['READY', 'DISPATCHED'].includes(order.status) && 'bg-info',
              order.status === 'BILLED_TO_ROOM' && 'bg-accent-500',
              order.status === 'CANCELLED' && 'bg-danger'
            )}
          />

          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-neutral-900">
              Order #{order.id} · {typeMeta.label}
            </p>
            <p className="mt-0.5 truncate text-sm text-neutral-500">
              {items
                .slice(0, 3)
                .map((item) => `${item.quantity}× ${item.food?.name ?? item.name}`)
                .join(', ')}
              {items.length > 3 ? ` +${items.length - 3} more` : ''}
            </p>
          </div>

          <div className="hidden shrink-0 text-right sm:block">
            <p className="font-semibold tabular-nums text-neutral-900">
              {money(order.pricing?.totalAmount)}
            </p>
            <p className="text-xs text-neutral-400">{dateTimeLong(order.createdAt)}</p>
          </div>

          <StatusChip map={ORDER_STATUS} value={order.status} />

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
            <dl className="mb-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
              <Fact label="Placed" value={dateTimeLong(order.createdAt)} />
              <Fact label="Type" value={typeMeta.label} />
              {where && <Fact label="Where" value={where} className="sm:col-span-2" />}
            </dl>

            <ul className="divide-y divide-neutral-100 border-y border-neutral-200">
              {items.map((item) => (
                <li key={item.id} className="flex items-baseline justify-between gap-4 py-2.5">
                  <span className="min-w-0 text-sm text-neutral-700">
                    <span className="font-medium text-neutral-900">{item.quantity}×</span>{' '}
                    {item.food?.name ?? item.name}
                  </span>
                  <span className="shrink-0 text-sm tabular-nums text-neutral-600">
                    {money(item.subtotal ?? Number(item.unitPrice) * item.quantity)}
                  </span>
                </li>
              ))}
            </ul>

            <dl className="mt-4 space-y-2 text-sm">
              <Line label="Subtotal" value={money(order.pricing?.subtotal)} />
              <Line
                label="Discount"
                value={`− ${money(order.pricing?.discountAmount)}`}
                muted={Number(order.pricing?.discountAmount) === 0}
              />
              <Line label="Tax" value={money(order.pricing?.taxAmount)} />
              <div className="border-t border-neutral-200 pt-2">
                <Line
                  label="Total"
                  value={money(order.pricing?.totalAmount, { alwaysDecimals: true })}
                  strong
                />
              </div>
            </dl>

            {(canReview || hasReview) && (
              <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-neutral-200 pt-4">
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
          strong
            ? 'text-base font-semibold text-neutral-900'
            : muted
              ? 'text-neutral-400'
              : 'text-neutral-700'
        )}
      >
        {value}
      </dd>
    </div>
  )
}
