import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BedDouble,
  ChefHat,
  LogIn,
  LogOut,
  Minus,
  ReceiptText,
  TrendingUp,
  UtensilsCrossed,
  Wallet,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { errorMessage } from '../../api/client'
import { getDashboardSummary, getRevenueSeries } from '../../api/dashboard'
import { listOrders } from '../../api/orders'
import PageMeta from '../../components/PageMeta'
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  ErrorState,
  PageHeader,
  Skeleton,
  StatusChip,
} from '../../components/ui'
import cn from '../../lib/cn'
import { axisProps, CHART, SERIES_ORDER } from '../../lib/chartTheme'
import { dateOnly, money, number, percent, relativeTime } from '../../lib/format'
import { ORDER_STATUS, ORDER_TYPE, statusMeta } from '../../lib/statuses'

/**
 * Operational dashboard (SRS §4.10).
 *
 * Ordered by how urgently a manager needs it: the four numbers that describe
 * right now, then the trend behind them, then the two lists that need someone
 * to act — the live kitchen queue and today's arrivals.
 */
export default function Dashboard() {
  const [summary, setSummary] = useState(null)
  const [series, setSeries] = useState([])
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [summaryData, seriesData] = await Promise.all([
        getDashboardSummary(),
        getRevenueSeries(30),
      ])
      setSummary(summaryData)
      setSeries(seriesData)
    } catch (err) {
      setError(errorMessage(err, 'Could not load the dashboard.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    listOrders({ kitchenQueue: true, pageSize: 8 })
      .then(setOrders)
      .catch(() => setOrders([]))
  }, [])

  const chartData = useMemo(
    () =>
      series.map((point) => ({
        ...point,
        rooms: Number(point.rooms),
        food: Number(point.food),
        total: Number(point.total),
      })),
    [series]
  )

  /**
   * Week-on-week change from the same series the chart draws, so the trend
   * arrow and the chart can never disagree. Null when the earlier week has no
   * revenue at all — "up ∞%" from zero is noise, not information.
   */
  const revenueTrend = useMemo(() => {
    if (chartData.length < 14) return null
    const recent = chartData.slice(-7).reduce((sum, point) => sum + point.total, 0)
    const previous = chartData.slice(-14, -7).reduce((sum, point) => sum + point.total, 0)
    if (previous === 0) return null
    return ((recent - previous) / previous) * 100
  }, [chartData])

  if (loading) return <DashboardSkeleton />

  if (error) {
    return (
      <>
        <PageMeta title="Dashboard" noIndex />
        <PageHeader title="Dashboard" />
        <Card>
          <ErrorState message={error} onRetry={load} />
        </Card>
      </>
    )
  }

  const { occupancy, todaysRevenue, todaysCheckIns, todaysCheckOuts, liveOrdersTotal } = summary

  return (
    <>
      <PageMeta title="Dashboard" noIndex />

      <PageHeader
        title="Dashboard"
        subtitle={`Today, ${dateOnly(summary.date)} — occupancy, revenue and what the kitchen is working on.`}
        actions={
          <Button variant="secondary" to="/admin/reports" iconRight={ArrowRight}>
            Reports
          </Button>
        }
      />

      {/* ── KPI row ──────────────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          icon={BedDouble}
          label="Occupancy"
          value={percent(occupancy.occupancyRate)}
          detail={`${number(occupancy.occupied)} of ${number(occupancy.total)} rooms occupied`}
          spark={chartData.map((point) => ({ v: point.rooms }))}
        />
        <KpiCard
          icon={Wallet}
          label="Today's revenue"
          value={money(todaysRevenue.total)}
          detail={`${money(todaysRevenue.rooms)} rooms · ${money(todaysRevenue.food)} food`}
          trend={revenueTrend}
          spark={chartData.map((point) => ({ v: point.total }))}
        />
        <KpiCard
          icon={ChefHat}
          label="Active orders"
          value={number(liveOrdersTotal)}
          detail={Object.entries(summary.liveOrdersByStatus)
            .filter(([, count]) => count > 0)
            .map(([status, count]) => `${count} ${statusMeta(ORDER_STATUS, status).label.toLowerCase()}`)
            .join(' · ') || 'Nothing in the queue'}
        />
        <KpiCard
          icon={LogIn}
          label="Check-ins today"
          value={`${number(todaysCheckIns.completed)} / ${number(todaysCheckIns.due)}`}
          detail={`${number(todaysCheckOuts.completed)} of ${number(todaysCheckOuts.due)} check-outs done`}
        />
      </div>

      {/* ── Trend + live queue ───────────────────────────────────────────── */}
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <RevenueChart data={chartData} />

        <Card className="flex flex-col">
          <CardHeader
            title="Live order queue"
            subtitle="Everything the kitchen and floor are working on"
            action={
              <Button variant="link" size="sm" to="/admin/kitchen" iconRight={ArrowRight}>
                Kitchen
              </Button>
            }
          />
          <CardBody className="flex-1 p-0">
            {orders.length === 0 ? (
              <EmptyState
                size="sm"
                icon={UtensilsCrossed}
                title="Nothing in the queue"
                description="New orders appear here the moment they're placed."
              />
            ) : (
              <ul className="divide-y divide-neutral-100">
                {orders.map((order) => (
                  <li key={order.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-neutral-900">
                        #{order.id} · {statusMeta(ORDER_TYPE, order.orderType).label}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-neutral-500">
                        {order.table
                          ? `Table ${order.table.tableNumber}`
                          : order.booking?.room
                            ? `Room ${order.booking.room.roomNumber}`
                            : 'Counter'}{' '}
                        · {relativeTime(order.createdAt)}
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

      {/* ── Arrivals + low stock ─────────────────────────────────────────── */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Today's movements"
            action={
              <Button variant="link" size="sm" to="/admin/bookings" iconRight={ArrowRight}>
                Bookings
              </Button>
            }
          />
          <CardBody className="grid grid-cols-2 gap-4">
            <Movement
              icon={LogIn}
              label="Check-ins"
              done={todaysCheckIns.completed}
              due={todaysCheckIns.due}
            />
            <Movement
              icon={LogOut}
              label="Check-outs"
              done={todaysCheckOuts.completed}
              due={todaysCheckOuts.due}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Unavailable menu items"
            subtitle="Marked unavailable — they cannot be added to a new order"
            action={
              <Button variant="link" size="sm" to="/admin/menu" iconRight={ArrowRight}>
                Menu
              </Button>
            }
          />
          <CardBody className="p-0">
            {summary.lowStockItems.length === 0 ? (
              <EmptyState
                size="sm"
                icon={ReceiptText}
                title="Everything is available"
                description="No dish is currently marked unavailable."
              />
            ) : (
              <ul className="divide-y divide-neutral-100">
                {summary.lowStockItems.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <span className="truncate text-sm text-neutral-800">{item.name}</span>
                    <Badge tone="neutral" size="sm">
                      Unavailable
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  )
}

/* ── Pieces ─────────────────────────────────────────────────────────────── */

function KpiCard({ icon: Icon, label, value, detail, trend, spark }) {
  const hasTrend = trend !== null && trend !== undefined && Number.isFinite(trend)
  const TrendIcon = !hasTrend ? Minus : trend > 0 ? ArrowUpRight : trend < 0 ? ArrowDownRight : Minus

  return (
    <Card variant="default" padding="md">
      <div className="flex items-start justify-between gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-neutral-100 text-neutral-500">
          <Icon size={18} aria-hidden="true" />
        </span>

        {hasTrend && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium',
              trend > 0 ? 'bg-green-50 text-green-800' : trend < 0 ? 'bg-red-50 text-red-800' : 'bg-neutral-100 text-neutral-600'
            )}
            title="Change against the previous seven days"
          >
            <TrendIcon size={12} aria-hidden="true" />
            {Math.abs(trend).toFixed(0)}%
          </span>
        )}
      </div>

      <p className="mt-3 text-xs font-medium uppercase tracking-wide text-neutral-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-neutral-900">{value}</p>
      <p className="mt-1 truncate text-xs text-neutral-500" title={detail}>
        {detail}
      </p>

      {/* Sparkline: shape only. It is deliberately unlabelled and unhoverable —
          the number above is the value, this is just its recent direction. */}
      {spark && spark.length > 1 && (
        <div className="mt-3 h-8" aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={spark} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
              <Line
                type="monotone"
                dataKey="v"
                stroke={CHART.axis}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  )
}

/**
 * Thirty-day revenue, rooms vs food.
 *
 * Stacked areas on one axis — never two y-scales — because the two streams are
 * the same unit and their sum is the number that matters. A legend is always
 * present, and the final point of each series is labelled directly, so identity
 * never rests on colour alone.
 */
function RevenueChart({ data }) {
  const empty = data.every((point) => point.total === 0)
  const last = data[data.length - 1]

  return (
    <Card className="flex flex-col">
      <CardHeader
        title="Revenue, last 30 days"
        subtitle="Payments received, net of refunds"
        action={
          <div className="flex items-center gap-3">
            {SERIES_ORDER.map((entry) => (
              <span key={entry.key} className="inline-flex items-center gap-1.5 text-xs text-neutral-600">
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 rounded-sm"
                  style={{ backgroundColor: entry.color }}
                />
                {entry.label}
              </span>
            ))}
          </div>
        }
      />
      <CardBody className="flex-1">
        {empty ? (
          <EmptyState
            size="sm"
            icon={TrendingUp}
            title="No revenue recorded yet"
            description="Once payments are taken, thirty days of rooms and food revenue appear here."
          />
        ) : (
          <>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                  <defs>
                    {SERIES_ORDER.map((entry) => (
                      <linearGradient key={entry.key} id={`fill-${entry.key}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={entry.color} stopOpacity={0.28} />
                        <stop offset="100%" stopColor={entry.color} stopOpacity={0.04} />
                      </linearGradient>
                    ))}
                  </defs>

                  <CartesianGrid stroke={CHART.grid} vertical={false} />
                  <XAxis
                    dataKey="date"
                    {...axisProps}
                    minTickGap={28}
                    tickFormatter={(value) => dateOnly(value).replace(/,.*/, '')}
                  />
                  <YAxis {...axisProps} width={64} tickFormatter={(value) => money(value)} />
                  <Tooltip content={<RevenueTooltip />} cursor={{ stroke: CHART.axis, strokeWidth: 1 }} />

                  {SERIES_ORDER.map((entry) => (
                    <Area
                      key={entry.key}
                      type="monotone"
                      dataKey={entry.key}
                      name={entry.label}
                      stackId="revenue"
                      stroke={entry.color}
                      strokeWidth={2}
                      fill={`url(#fill-${entry.key})`}
                      // A 2px surface gap keeps stacked fills from bleeding
                      // into one another where they meet.
                      activeDot={{ r: 4, strokeWidth: 2, stroke: CHART.surface }}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {last && (
              <p className="mt-2 text-xs text-neutral-500">
                Most recent day ({dateOnly(last.date)}):{' '}
                <span className="font-medium text-neutral-700">{money(last.rooms)}</span> rooms,{' '}
                <span className="font-medium text-neutral-700">{money(last.food)}</span> food.
              </p>
            )}
          </>
        )}
      </CardBody>
    </Card>
  )
}

function RevenueTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null

  const total = payload.reduce((sum, entry) => sum + (entry.value ?? 0), 0)

  return (
    <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2 shadow-hover">
      <p className="text-xs font-medium text-neutral-900">{dateOnly(label)}</p>
      <ul className="mt-1.5 space-y-1">
        {payload.map((entry) => (
          <li key={entry.dataKey} className="flex items-center gap-2 text-xs">
            <span
              aria-hidden="true"
              className="h-2 w-2 rounded-sm"
              style={{ backgroundColor: entry.stroke }}
            />
            <span className="text-neutral-500">{entry.name}</span>
            <span className="ml-auto font-medium tabular-nums text-neutral-800">
              {money(entry.value)}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-1.5 flex items-center gap-2 border-t border-neutral-100 pt-1.5 text-xs">
        <span className="text-neutral-500">Total</span>
        <span className="ml-auto font-semibold tabular-nums text-neutral-900">{money(total)}</span>
      </p>
    </div>
  )
}

function Movement({ icon: Icon, label, done, due }) {
  const pending = Math.max(0, due - done)

  return (
    <div className="rounded-lg border border-neutral-200 p-4">
      <span className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-neutral-400">
        <Icon size={14} aria-hidden="true" />
        {label}
      </span>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-neutral-900">
        {number(done)}
        <span className="text-base font-normal text-neutral-400"> / {number(due)}</span>
      </p>
      <p className="mt-1 text-xs text-neutral-500">
        {pending === 0 ? 'All done for today' : `${number(pending)} still to come`}
      </p>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">Loading the dashboard</span>
      <Skeleton className="h-8 w-48" rounded="rounded-sm" />
      <Skeleton className="mt-2 h-4 w-96 max-w-full" rounded="rounded-sm" />

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-40" rounded="rounded-lg" />
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Skeleton className="h-80" rounded="rounded-lg" />
        <Skeleton className="h-80" rounded="rounded-lg" />
      </div>
    </div>
  )
}
