import { Bike, Check, ChefHat, Flame, Pause, Play, RefreshCw, Timer } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { errorMessage } from '../../api/client'
import { listOrders, updateOrderStatus } from '../../api/orders'
import PageMeta from '../../components/PageMeta'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  Skeleton,
  StatusChip,
  Switch,
} from '../../components/ui'
import { useToast } from '../../context/ToastContext'
import cn from '../../lib/cn'
import { minutesSince, relativeTime, timeOnly } from '../../lib/format'
import { ORDER_STATUS, ORDER_TYPE, statusMeta } from '../../lib/statuses'

const REFRESH_MS = 15000

/**
 * Wait-time thresholds, in minutes. These drive the card's colour band, which
 * is the whole point of the screen: a cook should be able to see what is late
 * from across the kitchen without reading a single timestamp.
 */
const URGENCY = [
  { max: 10, key: 'fresh', rail: 'bg-neutral-300', label: 'On time' },
  { max: 20, key: 'warm', rail: 'bg-warning', label: 'Getting on' },
  { max: Infinity, key: 'late', rail: 'bg-danger', label: 'Late' },
]

function urgencyFor(minutes) {
  return URGENCY.find((band) => minutes < band.max) ?? URGENCY[URGENCY.length - 1]
}

/**
 * The kitchen queue (SRS §4.5, §3).
 *
 * Kitchen Staff may move an order between `Preparing` and `Ready` and nothing
 * else, so those are the only two buttons here — the API enforces the same
 * restriction.
 *
 * Auto-refresh is on by default and pausable. It refreshes *quietly*: the
 * skeleton only appears on the first load, because a queue that blanks itself
 * every fifteen seconds is unusable when the kitchen is busy.
 */
export default function Kitchen() {
  const toast = useToast()

  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [lastRefresh, setLastRefresh] = useState(null)
  const [busyId, setBusyId] = useState(null)

  // Orders whose status changed since the last poll, so they can pulse once.
  const [changed, setChanged] = useState(new Set())
  const previousStatuses = useRef(new Map())

  const refresh = useCallback(
    async ({ quiet = false } = {}) => {
      if (!quiet) setLoading(true)
      try {
        const rows = await listOrders({ kitchenQueue: true, pageSize: 100 })

        const moved = new Set()
        for (const order of rows) {
          const before = previousStatuses.current.get(order.id)
          if (before && before !== order.status) moved.add(order.id)
          previousStatuses.current.set(order.id, order.status)
        }

        setOrders(rows)
        setError(null)
        setLastRefresh(new Date())
        if (moved.size > 0) {
          setChanged(moved)
          // Clear the highlight after the animation so it fires once, not on
          // every subsequent render.
          setTimeout(() => setChanged(new Set()), 1400)
        }
      } catch (err) {
        setError(errorMessage(err, 'Could not load the kitchen queue.'))
      } finally {
        if (!quiet) setLoading(false)
      }
    },
    []
  )

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (!autoRefresh) return undefined
    const timer = setInterval(() => refresh({ quiet: true }), REFRESH_MS)
    return () => clearInterval(timer)
  }, [autoRefresh, refresh])

  // Re-render once a minute so the wait times and colour bands stay honest
  // between polls.
  const [, setTick] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setTick((value) => value + 1), 30000)
    return () => clearInterval(timer)
  }, [])

  async function handleTransition(order, status) {
    setBusyId(order.id)
    try {
      await updateOrderStatus(order.id, status)
      toast.success(
        `Order #${order.id} marked ${statusMeta(ORDER_STATUS, status).label.toLowerCase()}.`
      )
      refresh({ quiet: true })
    } catch (err) {
      toast.error(errorMessage(err, 'Could not update the order.'))
    } finally {
      setBusyId(null)
    }
  }

  const placed = orders.filter((order) => order.status === 'PLACED')
  const preparing = orders.filter((order) => order.status === 'PREPARING')
  const ready = orders.filter((order) => order.status === 'READY')

  return (
    <>
      <PageMeta title="Kitchen" noIndex />

      <PageHeader
        title="Kitchen"
        subtitle="Everything waiting on the kitchen, oldest first. Colour shows how long it has been waiting."
        breadcrumbs={[{ label: 'Restaurant' }, { label: 'Kitchen' }]}
        actions={
          <div className="flex items-center gap-3">
            <Switch
              label="Auto-refresh"
              checked={autoRefresh}
              onChange={(event) => setAutoRefresh(event.target.checked)}
            />
            <Button
              variant="secondary"
              size="sm"
              iconLeft={RefreshCw}
              onClick={() => refresh({ quiet: true })}
            >
              Refresh
            </Button>
          </div>
        }
      >
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-neutral-500">
          <span className="inline-flex items-center gap-1.5">
            {autoRefresh ? (
              <Play size={12} aria-hidden="true" className="text-success" />
            ) : (
              <Pause size={12} aria-hidden="true" />
            )}
            {autoRefresh ? `Refreshing every ${REFRESH_MS / 1000}s` : 'Auto-refresh paused'}
            {lastRefresh && ` · last checked ${timeOnly(lastRefresh)}`}
          </span>

          {/* Legend: the colour rail means nothing without it. */}
          <span className="flex items-center gap-3">
            {URGENCY.map((band) => (
              <span key={band.key} className="inline-flex items-center gap-1.5">
                <span aria-hidden="true" className={cn('h-2.5 w-2.5 rounded-sm', band.rail)} />
                {band.label}
                {band.max !== Infinity ? ` (<${band.max}m)` : ''}
              </span>
            ))}
          </span>
        </div>
      </PageHeader>

      {loading ? (
        <div role="status" aria-busy="true" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <span className="sr-only">Loading the kitchen queue</span>
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-52" rounded="rounded-lg" />
          ))}
        </div>
      ) : error ? (
        <Card>
          <ErrorState message={error} onRetry={refresh} />
        </Card>
      ) : orders.length === 0 ? (
        <Card>
          <EmptyState
            icon={ChefHat}
            title="Nothing in the queue"
            description="New orders appear here automatically the moment they're placed. Nothing to do right now."
          />
        </Card>
      ) : (
        <div className="space-y-8">
          <Column
            title="New"
            icon={Timer}
            orders={placed}
            changed={changed}
            busyId={busyId}
            onTransition={handleTransition}
          />
          <Column
            title="Preparing"
            icon={Flame}
            orders={preparing}
            changed={changed}
            busyId={busyId}
            onTransition={handleTransition}
          />
          <Column
            title="Ready to go"
            icon={Check}
            orders={ready}
            changed={changed}
            busyId={busyId}
            onTransition={handleTransition}
          />
        </div>
      )}
    </>
  )
}

function Column({ title, icon: Icon, orders, changed, busyId, onTransition }) {
  if (orders.length === 0) return null

  return (
    <section aria-labelledby={`kitchen-${title}`}>
      <h2
        id={`kitchen-${title}`}
        className="mb-3 flex items-center gap-2 text-sm font-semibold text-neutral-900"
      >
        <Icon size={16} aria-hidden="true" className="text-neutral-400" />
        {title}
        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
          {orders.length}
        </span>
      </h2>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {orders.map((order) => (
          <OrderTicket
            key={order.id}
            order={order}
            highlighted={changed.has(order.id)}
            busy={busyId === order.id}
            onTransition={onTransition}
          />
        ))}
      </div>
    </section>
  )
}

function OrderTicket({ order, highlighted, busy, onTransition }) {
  const waited = minutesSince(order.createdAt)
  const band = urgencyFor(waited)
  const typeMeta = statusMeta(ORDER_TYPE, order.orderType)

  const where = order.table
    ? `Table ${order.table.tableNumber}`
    : order.booking?.room
      ? `Room ${order.booking.room.roomNumber}`
      : order.orderType === 'DELIVERY'
        ? 'Delivery'
        : 'Counter'

  return (
    <Card
      variant="default"
      className={cn('flex overflow-hidden', highlighted && 'animate-pulse-highlight')}
    >
      {/* The wait-time rail. Paired with the legend above and the minute count
          below, so urgency is never carried by colour alone. */}
      <span aria-hidden="true" className={cn('w-1.5 shrink-0', band.rail)} />

      <div className="flex min-w-0 flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-base font-semibold text-neutral-900">#{order.id}</p>
            <p className="mt-0.5 truncate text-xs text-neutral-500">
              {typeMeta.label} · {where}
            </p>
          </div>
          <StatusChip map={ORDER_STATUS} value={order.status} size="sm" />
        </div>

        <p
          className={cn(
            'mt-2 inline-flex items-center gap-1.5 text-xs font-medium',
            band.key === 'late' ? 'text-danger' : band.key === 'warm' ? 'text-warning' : 'text-neutral-500'
          )}
        >
          <Timer size={13} aria-hidden="true" />
          Waiting {waited} min
          <span className="font-normal text-neutral-400">· {relativeTime(order.createdAt)}</span>
        </p>

        <ul className="mt-3 flex-1 space-y-1 border-t border-neutral-100 pt-3">
          {(order.items ?? []).map((item) => (
            <li key={item.id} className="flex items-baseline gap-2 text-sm">
              <span className="font-semibold tabular-nums text-neutral-900">{item.quantity}×</span>
              <span className="min-w-0 flex-1 text-neutral-700">{item.food?.name ?? item.name}</span>
            </li>
          ))}
        </ul>

        {order.orderType === 'DELIVERY' && order.deliveryAddress && (
          <p className="mt-2 flex items-start gap-1.5 rounded bg-neutral-50 px-2.5 py-2 text-xs text-neutral-600">
            <Bike size={13} aria-hidden="true" className="mt-0.5 shrink-0" />
            <span className="min-w-0">{order.deliveryAddress}</span>
          </p>
        )}

        <div className="mt-4">
          {order.status === 'PLACED' && (
            <Button
              size="lg"
              fullWidth
              loading={busy}
              iconLeft={Flame}
              onClick={() => onTransition(order, 'PREPARING')}
            >
              Start preparing
            </Button>
          )}

          {order.status === 'PREPARING' && (
            <Button
              size="lg"
              fullWidth
              variant="accent"
              loading={busy}
              iconLeft={Check}
              onClick={() => onTransition(order, 'READY')}
            >
              Mark ready
            </Button>
          )}

          {order.status === 'READY' && (
            <Badge tone="info" size="lg" className="w-full justify-center py-2">
              Waiting for collection
            </Badge>
          )}
        </div>
      </div>
    </Card>
  )
}
