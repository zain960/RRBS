import { Banknote, ReceiptText, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import { errorMessage } from '../../api/client'
import { listOrders, payOrder, updateOrderStatus } from '../../api/orders'
import PageMeta from '../../components/PageMeta'
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  Drawer,
  EmptyState,
  FilterBar,
  PageHeader,
  ResponsiveTable,
  SelectControl,
  StatusChip,
} from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { dateTime, money, relativeTime } from '../../lib/format'
import { ORDER_STATUS, ORDER_TYPE, statusMeta, statusOptions } from '../../lib/statuses'

/**
 * Which role may move an order into which status (SRS §3, §4.5). This mirrors
 * TRANSITION_ROLES in the order service so a button never appears for an action
 * the API will refuse — the API is still the enforcement point.
 */
const TRANSITION_ROLES = {
  PREPARING: ['Kitchen Staff', 'Super Admin'],
  READY: ['Kitchen Staff', 'Super Admin'],
  SERVED: ['Waiter', 'Super Admin'],
  PICKED_UP: ['Waiter', 'Super Admin'],
  DISPATCHED: ['Manager', 'Receptionist', 'Super Admin'],
  DELIVERED: ['Manager', 'Receptionist', 'Super Admin'],
  BILLED_TO_ROOM: ['Manager', 'Receptionist', 'Super Admin'],
  CANCELLED: ['Waiter', 'Manager', 'Receptionist', 'Super Admin'],
}

const PAYMENT_ROLES = ['Waiter', 'Manager', 'Receptionist', 'Super Admin']

/** An order is settled once its payments cover the total. */
function outstandingOf(order) {
  const paid = (order.payments ?? [])
    .filter((payment) => payment.status === 'COMPLETED')
    .reduce(
      (sum, payment) =>
        payment.paymentType === 'REFUND' ? sum - Number(payment.amount) : sum + Number(payment.amount),
      0
    )
  return Math.max(0, Number(order.pricing.totalAmount) - paid)
}

function whereOf(order) {
  if (order.table) return `Table ${order.table.tableNumber}`
  if (order.booking?.room) return `Room ${order.booking.room.roomNumber}`
  if (order.deliveryAddress) return order.deliveryAddress
  return '—'
}

/**
 * The order ledger (SRS §4.5).
 *
 * Every order in one list, whatever its type. Row click opens the detail
 * drawer; the status buttons live there rather than on the row, so the table
 * stays readable and the action is taken with the full order in view.
 */
export default function Orders() {
  const toast = useToast()
  const { role } = useAuth()

  const [orders, setOrders] = useState([])
  const [filters, setFilters] = useState({ status: '', orderType: '' })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [pendingId, setPendingId] = useState(null)

  const [selected, setSelected] = useState(null)
  const [settleTarget, setSettleTarget] = useState(null)

  const refresh = useCallback(
    async ({ quiet = false } = {}) => {
      if (!quiet) setLoading(true)
      try {
        const rows = await listOrders({ ...filters, pageSize: 100 })
        setOrders(rows)
        setError(null)
        // Keep the open drawer in step with the refreshed data.
        setSelected((current) =>
          current ? (rows.find((order) => order.id === current.id) ?? null) : null
        )
      } catch (err) {
        setError(errorMessage(err, 'Could not load orders.'))
      } finally {
        if (!quiet) setLoading(false)
      }
    },
    [filters]
  )

  useEffect(() => {
    refresh()
  }, [refresh])

  async function handleTransition(order, status) {
    setPendingId(order.id)
    try {
      await updateOrderStatus(order.id, status)
      toast.success(`Order #${order.id} marked ${statusMeta(ORDER_STATUS, status).label.toLowerCase()}.`)
      refresh({ quiet: true })
    } catch (err) {
      // 403 when the role may not make this transition, 409 when it is illegal
      // for this order's type or current status.
      toast.error(errorMessage(err, 'Could not update the order.'))
    } finally {
      setPendingId(null)
    }
  }

  /** Settles the bill in cash — this is what frees a dine-in table (SRS §5.2). */
  async function handleSettle() {
    const order = settleTarget
    setPendingId(order.id)
    try {
      await payOrder(order.id, {
        amount: outstandingOf(order).toFixed(2),
        method: 'CASH',
        payment_type: 'FULL',
      })
      toast.success(`Order #${order.id} settled.`)
      setSettleTarget(null)
      refresh({ quiet: true })
    } catch (err) {
      toast.error(errorMessage(err, 'Could not record the payment.'))
    } finally {
      setPendingId(null)
    }
  }

  const columns = [
    {
      key: 'order',
      header: 'Order',
      primary: true,
      render: (order) => (
        <div className="min-w-0">
          <p className="font-medium text-neutral-900">#{order.id}</p>
          <p className="truncate text-xs text-neutral-500">
            {order.customer?.fullName ?? 'Walk-in'} · {relativeTime(order.createdAt)}
          </p>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (order) => (
        <span className="text-neutral-600">{statusMeta(ORDER_TYPE, order.orderType).label}</span>
      ),
    },
    {
      key: 'where',
      header: 'Where',
      hideBelow: 'lg',
      render: (order) => (
        <span className="block max-w-[16rem] truncate text-neutral-600" title={whereOf(order)}>
          {whereOf(order)}
        </span>
      ),
    },
    {
      key: 'items',
      header: 'Items',
      align: 'right',
      hideBelow: 'md',
      render: (order) => (
        <span className="tabular-nums text-neutral-600">{(order.items ?? []).length}</span>
      ),
    },
    {
      key: 'total',
      header: 'Total',
      align: 'right',
      render: (order) => {
        const outstanding = outstandingOf(order)
        return (
          <div>
            <p className="font-medium tabular-nums text-neutral-900">
              {money(order.pricing.totalAmount)}
            </p>
            {outstanding > 0 && order.orderType !== 'ROOM_SERVICE' && (
              <p className="text-xs text-warning">{money(outstanding)} due</p>
            )}
          </div>
        )
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (order) => <StatusChip map={ORDER_STATUS} value={order.status} />,
    },
  ]

  const filtered = filters.status || filters.orderType

  return (
    <>
      <PageMeta title="Orders" noIndex />

      <PageHeader
        title="Orders"
        subtitle="Every order across dine-in, takeaway, delivery and room service."
        breadcrumbs={[{ label: 'Restaurant' }, { label: 'Orders' }]}
        actions={
          <Button variant="secondary" iconLeft={RefreshCw} onClick={() => refresh({ quiet: true })}>
            Refresh
          </Button>
        }
      />

      <FilterBar>
        <div className="w-full sm:w-48">
          <label htmlFor="filter-status" className="sr-only">
            Filter by status
          </label>
          <SelectControl
            id="filter-status"
            size="sm"
            value={filters.status}
            onChange={(event) =>
              setFilters((current) => ({ ...current, status: event.target.value }))
            }
            options={[{ value: '', label: 'All statuses' }, ...statusOptions(ORDER_STATUS)]}
          />
        </div>

        <div className="w-full sm:w-44">
          <label htmlFor="filter-type" className="sr-only">
            Filter by order type
          </label>
          <SelectControl
            id="filter-type"
            size="sm"
            value={filters.orderType}
            onChange={(event) =>
              setFilters((current) => ({ ...current, orderType: event.target.value }))
            }
            options={[{ value: '', label: 'All types' }, ...statusOptions(ORDER_TYPE)]}
          />
        </div>

        {filtered && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFilters({ status: '', orderType: '' })}
          >
            Clear filters
          </Button>
        )}

        <p className="text-xs text-neutral-500 sm:ml-auto" aria-live="polite">
          {loading ? 'Loading…' : `${orders.length} order${orders.length === 1 ? '' : 's'}`}
        </p>
      </FilterBar>

      <Card className="overflow-hidden">
        <ResponsiveTable
          columns={columns}
          rows={orders}
          rowKey={(order) => order.id}
          onRowClick={setSelected}
          loading={loading}
          error={error}
          onRetry={refresh}
          caption="Orders across every service type"
          empty={
            <EmptyState
              icon={ReceiptText}
              title={filtered ? 'No orders match these filters' : 'No orders yet'}
              description={
                filtered
                  ? 'Try clearing the filters to see everything.'
                  : 'Orders appear here the moment a guest or a waiter places one.'
              }
              action={
                filtered ? (
                  <Button
                    variant="secondary"
                    onClick={() => setFilters({ status: '', orderType: '' })}
                  >
                    Clear filters
                  </Button>
                ) : null
              }
            />
          }
        />
      </Card>

      <OrderDrawer
        order={selected}
        onClose={() => setSelected(null)}
        role={role}
        busy={pendingId === selected?.id}
        onTransition={handleTransition}
        onSettle={() => setSettleTarget(selected)}
      />

      <ConfirmDialog
        open={Boolean(settleTarget)}
        onClose={() => setSettleTarget(null)}
        onConfirm={handleSettle}
        loading={pendingId === settleTarget?.id}
        tone="primary"
        title="Settle this bill in cash?"
        message={
          settleTarget
            ? `Records a cash payment of ${money(outstandingOf(settleTarget))} against order #${settleTarget.id}. This is what frees the table.`
            : ''
        }
        confirmLabel="Record payment"
      />
    </>
  )
}

function OrderDrawer({ order, onClose, role, busy, onTransition, onSettle }) {
  if (!order) {
    return <Drawer open={false} onClose={onClose} />
  }

  const outstanding = outstandingOf(order)
  const canSettle =
    order.orderType !== 'ROOM_SERVICE' &&
    order.status !== 'CANCELLED' &&
    outstanding > 0 &&
    PAYMENT_ROLES.includes(role)

  const transitions = (order.allowedNext ?? []).filter((next) =>
    (TRANSITION_ROLES[next] ?? []).includes(role)
  )

  return (
    <Drawer
      open
      onClose={onClose}
      title={`Order #${order.id}`}
      description={`${statusMeta(ORDER_TYPE, order.orderType).label} · ${dateTime(order.createdAt)}`}
      footer={
        <div className="flex w-full flex-wrap justify-end gap-2">
          {canSettle && (
            <Button variant="secondary" iconLeft={Banknote} loading={busy} onClick={onSettle}>
              Settle {money(outstanding)}
            </Button>
          )}
          {transitions.map((next) => (
            <Button
              key={next}
              variant={next === 'CANCELLED' ? 'danger' : 'primary'}
              loading={busy}
              onClick={() => onTransition(order, next)}
            >
              Mark {statusMeta(ORDER_STATUS, next).label.toLowerCase()}
            </Button>
          ))}
          {transitions.length === 0 && !canSettle && (
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          <StatusChip map={ORDER_STATUS} value={order.status} size="lg" />
          {outstanding > 0 && order.orderType !== 'ROOM_SERVICE' && (
            <Badge tone="warning" size="lg">
              {money(outstanding)} outstanding
            </Badge>
          )}
        </div>

        <dl className="space-y-2.5">
          <Row label="Customer" value={order.customer?.fullName ?? 'Walk-in'} />
          <Row label="Where" value={whereOf(order)} />
          <Row label="Placed" value={dateTime(order.createdAt)} />
        </dl>

        <section>
          <h3 className="mb-2 text-sm font-semibold text-neutral-900">Items</h3>
          <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200">
            {(order.items ?? []).map((item) => (
              <li key={item.id} className="flex items-baseline justify-between gap-3 px-3.5 py-2.5">
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
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold text-neutral-900">Bill</h3>
          <dl className="space-y-2 text-sm">
            <Row label="Subtotal" value={money(order.pricing.subtotal)} />
            <Row label="Discount" value={`− ${money(order.pricing.discountAmount)}`} />
            <Row label="Tax" value={money(order.pricing.taxAmount)} />
            <div className="border-t border-neutral-200 pt-2">
              <Row
                label="Total"
                value={money(order.pricing.totalAmount, { alwaysDecimals: true })}
                strong
              />
            </div>
          </dl>
        </section>

        {(order.payments ?? []).length > 0 && (
          <section>
            <h3 className="mb-2 text-sm font-semibold text-neutral-900">Payments</h3>
            <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200">
              {order.payments.map((payment) => (
                <li
                  key={payment.id}
                  className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm"
                >
                  <span className="text-neutral-600">
                    {payment.paymentType} · {payment.method}
                  </span>
                  <span className="tabular-nums font-medium text-neutral-900">
                    {money(payment.amount)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </Drawer>
  )
}

function Row({ label, value, strong }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className={strong ? 'font-medium text-neutral-900' : 'text-sm text-neutral-500'}>
        {label}
      </dt>
      <dd
        className={
          strong
            ? 'text-base font-semibold tabular-nums text-neutral-900'
            : 'text-sm tabular-nums text-neutral-800'
        }
      >
        {value}
      </dd>
    </div>
  )
}
