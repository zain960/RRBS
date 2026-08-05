import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  BellRing,
  Bike,
  ShoppingBag,
  UtensilsCrossed,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { errorDetails, errorMessage } from '../api/client'
import { fetchMenu } from '../api/foods'
import { createOrder, listRoomServiceBookings } from '../api/orders'
import { getTaxSettings } from '../api/settings'
import { listAvailableTables } from '../api/tables'
import CouponField, { PriceBreakdown } from '../components/domain/CouponField'
import FoodCard from '../components/domain/FoodCard'
import PageMeta from '../components/PageMeta'
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  ErrorState,
  Select,
  SkeletonCard,
  SkeletonGroup,
  Stepper,
  Tabs,
  Textarea,
} from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { useToast } from '../context/ToastContext'
import cn from '../lib/cn'
import { dateRange, money } from '../lib/format'
import { CartDrawer } from './Menu'

/**
 * Customer ordering flow (SRS §4.5, Figure 2):
 *   pick order type → browse the menu → checkout → confirmation
 *
 * All four types share the menu and cart; only the checkout step differs. Room
 * Service is offered only while the guest has a Checked-in booking (SRS §5.2) —
 * the eligible stays come from the server, never from a flag the client decides
 * for itself.
 */

const STEPS = [
  { key: 'type', label: 'Order type' },
  { key: 'menu', label: 'Choose dishes' },
  { key: 'checkout', label: 'Checkout' },
  { key: 'done', label: 'Placed' },
]

const TYPES = [
  {
    value: 'DINE_IN',
    label: 'Dine-in',
    icon: UtensilsCrossed,
    blurb: 'Eat in the restaurant. Your order is linked to your table.',
  },
  {
    value: 'TAKEAWAY',
    label: 'Takeaway',
    icon: ShoppingBag,
    blurb: 'Collect at the counter once your order is Ready.',
  },
  {
    value: 'DELIVERY',
    label: 'Delivery',
    icon: Bike,
    blurb: 'Brought to your address. A delivery address is required.',
  },
  {
    value: 'ROOM_SERVICE',
    label: 'Room service',
    icon: BellRing,
    blurb: 'Billed to your room and settled at checkout.',
    requiresCheckedIn: true,
  },
]

export default function Order() {
  const toast = useToast()
  const { isAuthenticated } = useAuth()
  const cart = useCart()

  const [step, setStep] = useState('type')
  const [orderType, setOrderType] = useState(null)

  const [menu, setMenu] = useState([])
  const [loadingMenu, setLoadingMenu] = useState(true)
  const [menuError, setMenuError] = useState(null)
  const [activeCategory, setActiveCategory] = useState('all')
  const [cartOpen, setCartOpen] = useState(false)

  const [stays, setStays] = useState([])
  const [tables, setTables] = useState([])
  const [checkout, setCheckout] = useState({
    tableId: '',
    bookingId: '',
    deliveryAddress: '',
    couponCode: '',
  })

  const [placed, setPlaced] = useState(null)
  const [couponResult, setCouponResult] = useState(null)
  const [foodTaxRate, setFoodTaxRate] = useState(0)
  const [fieldErrors, setFieldErrors] = useState({})
  const [busy, setBusy] = useState(false)

  const loadMenu = useCallback(() => {
    setLoadingMenu(true)
    setMenuError(null)
    fetchMenu()
      .then(setMenu)
      .catch((error) => setMenuError(errorMessage(error, 'Could not load the menu.')))
      .finally(() => setLoadingMenu(false))
  }, [])

  useEffect(loadMenu, [loadMenu])

  useEffect(() => {
    getTaxSettings()
      .then((settings) => setFoodTaxRate(Number(settings.foodTaxRate)))
      .catch(() => setFoodTaxRate(0))
  }, [])

  // Which stays are eligible for room service is the server's call (SRS §5.2).
  useEffect(() => {
    if (!isAuthenticated) return
    listRoomServiceBookings()
      .then(setStays)
      .catch(() => setStays([]))
  }, [isAuthenticated])

  useEffect(() => {
    if (orderType !== 'DINE_IN') return
    listAvailableTables()
      .then(setTables)
      .catch((error) => toast.error(errorMessage(error, 'Could not load free tables.')))
  }, [orderType, toast])

  const subtotal = cart.subtotal
  const discount = couponResult?.valid ? Number(couponResult.discountAmount) : 0
  const tax = ((subtotal - discount) * foodTaxRate) / 100
  const total = subtotal - discount + tax

  const tabs = useMemo(
    () => [
      { value: 'all', label: 'Everything' },
      ...menu.map((entry) => ({
        value: String(entry.id),
        label: entry.categoryName,
        count: entry.items?.length ?? 0,
      })),
    ],
    [menu]
  )

  const visibleCategories = useMemo(
    () =>
      activeCategory === 'all'
        ? menu
        : menu.filter((entry) => String(entry.id) === activeCategory),
    [menu, activeCategory]
  )

  function chooseType(type) {
    if (type.requiresCheckedIn && !isAuthenticated) {
      toast.info('Sign in to order room service for your stay.')
      return
    }
    if (type.requiresCheckedIn && stays.length === 0) {
      toast.info('Room service is available once you are checked in.')
      return
    }
    setOrderType(type.value)
    setStep('menu')
  }

  async function handlePlaceOrder(event) {
    event.preventDefault()
    setBusy(true)
    setFieldErrors({})

    const payload = {
      order_type: orderType,
      items: cart.items.map((line) => ({ food_id: line.id, quantity: line.quantity })),
      coupon_code: checkout.couponCode || null,
    }

    if (orderType === 'DINE_IN') payload.table_id = checkout.tableId || null
    if (orderType === 'ROOM_SERVICE') payload.booking_id = checkout.bookingId || null
    if (orderType === 'DELIVERY') payload.delivery_address = checkout.deliveryAddress || null

    try {
      const order = await createOrder(payload)
      setPlaced(order)
      cart.clear()
      setStep('done')
      toast.success('Your order is in — the kitchen has it.')
    } catch (error) {
      setFieldErrors(errorDetails(error) ?? {})
      toast.error(errorMessage(error, 'Could not place your order.'))
    } finally {
      setBusy(false)
    }
  }

  function startOver() {
    setStep('type')
    setOrderType(null)
    setPlaced(null)
    setCouponResult(null)
    setCheckout({ tableId: '', bookingId: '', deliveryAddress: '', couponCode: '' })
  }

  return (
    <>
      <PageMeta
        title="Order food"
        description="Order from the kitchen for dine-in, takeaway, delivery or room service."
      />

      <div className="border-b border-neutral-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
          <h1 className="font-display text-3xl font-semibold text-neutral-900">Order food</h1>
          <Stepper steps={STEPS} current={step} className="mt-6" />
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-8 pb-28 sm:px-6 lg:px-8">
        {/* ── Step 1: order type ───────────────────────────────────────── */}
        {step === 'type' && (
          <section>
            <h2 className="mb-1 text-lg font-semibold text-neutral-900">How would you like it?</h2>
            <p className="mb-6 text-sm text-neutral-500">
              You can change this before you check out.
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              {TYPES.map((type) => {
                const locked =
                  type.requiresCheckedIn && (!isAuthenticated || stays.length === 0)

                return (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => chooseType(type)}
                    aria-disabled={locked}
                    className={cn(
                      'group flex flex-col items-start gap-3 rounded-lg border bg-white p-6 text-left',
                      'transition-all duration-hover ease-out',
                      locked
                        ? 'cursor-not-allowed border-neutral-200 opacity-60'
                        : 'border-neutral-200 shadow-card hover:border-neutral-300 hover:shadow-hover'
                    )}
                  >
                    <span
                      className={cn(
                        'grid h-12 w-12 place-items-center rounded-lg',
                        locked
                          ? 'bg-neutral-100 text-neutral-400'
                          : 'bg-accent-50 text-accent-600 transition-transform duration-hover group-hover:scale-105'
                      )}
                    >
                      <type.icon size={24} aria-hidden="true" />
                    </span>

                    <span className="flex items-center gap-2">
                      <span className="text-base font-semibold text-neutral-900">{type.label}</span>
                      {locked && (
                        <Badge tone="neutral" size="sm">
                          Checked-in guests
                        </Badge>
                      )}
                    </span>

                    <span className="text-sm leading-relaxed text-neutral-500">{type.blurb}</span>
                  </button>
                )
              })}
            </div>

            {cart.count > 0 && (
              <p className="mt-6 text-sm text-neutral-500">
                You already have {cart.count} {cart.count === 1 ? 'item' : 'items'} in your order —
                pick a type to carry on.
              </p>
            )}
          </section>
        )}

        {/* ── Step 2: menu ─────────────────────────────────────────────── */}
        {step === 'menu' && (
          <section>
            <div className="mb-5 flex items-center justify-between gap-3">
              <Button variant="ghost" size="sm" iconLeft={ArrowLeft} onClick={() => setStep('type')}>
                Change type
              </Button>
              <Badge tone="primary" size="lg">
                {TYPES.find((type) => type.value === orderType)?.label}
              </Badge>
            </div>

            {loadingMenu ? (
              <SkeletonGroup
                label="Loading the menu"
                className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
              >
                {Array.from({ length: 6 }).map((_, index) => (
                  <SkeletonCard key={index} aspect="aspect-[4/3]" />
                ))}
              </SkeletonGroup>
            ) : menuError ? (
              <Card>
                <ErrorState message={menuError} onRetry={loadMenu} />
              </Card>
            ) : menu.length === 0 ? (
              <Card>
                <EmptyState
                  icon={UtensilsCrossed}
                  title="The menu is being prepared"
                  description="Dishes will appear here as soon as the kitchen publishes them."
                />
              </Card>
            ) : (
              <>
                <Tabs
                  tabs={tabs}
                  value={activeCategory}
                  onChange={setActiveCategory}
                  variant="pill"
                  ariaLabel="Menu categories"
                  className="mb-6"
                />

                <div className="space-y-10">
                  {visibleCategories.map((entry) => (
                    <div key={entry.id}>
                      <h2 className="mb-4 font-display text-xl font-semibold text-neutral-900">
                        {entry.categoryName}
                      </h2>
                      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                        {(entry.items ?? []).map((food) => (
                          <FoodCard
                            key={food.id}
                            food={food}
                            quantity={cart.quantityOf(food.id)}
                            onAdd={cart.add}
                            onRemove={cart.remove}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        )}

        {/* ── Step 3: checkout ─────────────────────────────────────────── */}
        {step === 'checkout' && (
          <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
            <Card>
              <CardHeader
                title="Checkout"
                subtitle={`${TYPES.find((type) => type.value === orderType)?.label} · ${
                  cart.count
                } ${cart.count === 1 ? 'item' : 'items'}`}
              />
              <CardBody>
                <form onSubmit={handlePlaceOrder} className="space-y-5">
                  {orderType === 'DINE_IN' && (
                    <Select
                      label="Table"
                      id="tableId"
                      required
                      value={checkout.tableId}
                      onChange={(event) =>
                        setCheckout((current) => ({ ...current, tableId: event.target.value }))
                      }
                      placeholder="Choose a free table"
                      options={tables.map((table) => ({
                        value: String(table.id),
                        label: `Table ${table.tableNumber} · seats ${table.capacity} · ${table.location === 'INDOOR' ? 'Indoor' : 'Outdoor'}`,
                      }))}
                      hint={
                        tables.length === 0
                          ? 'No tables are free right now — ask a waiter to seat you.'
                          : 'The table becomes Occupied once your order is placed.'
                      }
                      error={fieldErrors.table_id}
                    />
                  )}

                  {orderType === 'ROOM_SERVICE' && (
                    <Select
                      label="Your stay"
                      id="bookingId"
                      required
                      value={checkout.bookingId}
                      onChange={(event) =>
                        setCheckout((current) => ({ ...current, bookingId: event.target.value }))
                      }
                      placeholder="Choose the stay to bill"
                      options={stays.map((stay) => ({
                        value: String(stay.id),
                        label: `Room ${stay.room?.roomNumber} · ${dateRange(
                          stay.checkInDatetime,
                          stay.checkOutDatetime
                        )}`,
                      }))}
                      hint="Charged to your room and settled when you check out."
                      error={fieldErrors.booking_id}
                    />
                  )}

                  {orderType === 'DELIVERY' && (
                    <Textarea
                      label="Delivery address"
                      id="deliveryAddress"
                      required
                      rows={3}
                      value={checkout.deliveryAddress}
                      onChange={(event) =>
                        setCheckout((current) => ({
                          ...current,
                          deliveryAddress: event.target.value,
                        }))
                      }
                      hint="Street, building and any landmark that helps the rider find you."
                      error={fieldErrors.delivery_address}
                    />
                  )}

                  <CouponField
                    target="FOOD"
                    subtotal={subtotal}
                    value={checkout.couponCode}
                    onChange={(value) =>
                      setCheckout((current) => ({ ...current, couponCode: value }))
                    }
                    onResult={setCouponResult}
                    error={fieldErrors.coupon_code}
                  />

                  <div className="flex flex-col-reverse gap-2 border-t border-neutral-200 pt-5 sm:flex-row sm:justify-between">
                    <Button
                      variant="ghost"
                      type="button"
                      onClick={() => setStep('menu')}
                      iconLeft={ArrowLeft}
                      disabled={busy}
                    >
                      Back to the menu
                    </Button>
                    <Button
                      type="submit"
                      size="lg"
                      loading={busy}
                      disabled={cart.count === 0}
                      iconRight={ArrowRight}
                    >
                      Place order
                    </Button>
                  </div>
                </form>
              </CardBody>
            </Card>

            <Card variant="elevated" className="h-fit lg:sticky lg:top-24">
              <CardHeader title="Your order" />
              <CardBody className="space-y-4">
                <ul className="space-y-2">
                  {cart.items.map((line) => (
                    <li key={line.id} className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="min-w-0 text-neutral-700">
                        <span className="font-medium text-neutral-900">{line.quantity}×</span>{' '}
                        {line.name}
                      </span>
                      <span className="shrink-0 tabular-nums text-neutral-600">
                        {money(Number(line.price) * line.quantity)}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="border-t border-neutral-200 pt-4">
                  <PriceBreakdown
                    subtotal={subtotal}
                    discountAmount={discount}
                    taxAmount={tax}
                    totalAmount={total}
                    note="Estimated — the kitchen prices your order when it is placed, and that figure is the one stored."
                  />
                </div>
              </CardBody>
            </Card>
          </div>
        )}

        {/* ── Step 4: confirmation ─────────────────────────────────────── */}
        {step === 'done' && placed && (
          <div className="mx-auto max-w-2xl">
            <Card variant="elevated" className="overflow-hidden">
              <div className="bg-primary-800 px-6 py-8 text-center">
                <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-white/10 text-white">
                  <BadgeCheck size={28} aria-hidden="true" />
                </span>
                <h2 className="mt-4 font-display text-2xl font-semibold text-white">
                  Order #{placed.id} is in
                </h2>
                <p className="mt-1.5 text-sm text-white/70">
                  {placed.statusLabel ?? 'Placed'} · the kitchen has started on it.
                </p>
              </div>

              <CardBody className="space-y-5">
                <ul className="divide-y divide-neutral-100 border-y border-neutral-200">
                  {(placed.items ?? []).map((item) => (
                    <li key={item.id} className="flex items-baseline justify-between gap-4 py-2.5">
                      <span className="text-sm text-neutral-700">
                        <span className="font-medium text-neutral-900">{item.quantity}×</span>{' '}
                        {item.food?.name ?? item.name}
                      </span>
                      <span className="text-sm tabular-nums text-neutral-600">
                        {money(item.subtotal ?? Number(item.unitPrice) * item.quantity)}
                      </span>
                    </li>
                  ))}
                </ul>

                <PriceBreakdown
                  subtotal={placed.pricing.subtotal}
                  discountAmount={placed.pricing.discountAmount}
                  taxAmount={placed.pricing.taxAmount}
                  totalAmount={placed.pricing.totalAmount}
                />

                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button to="/my-orders" size="lg" fullWidth>
                    Track my orders
                  </Button>
                  <Button variant="secondary" size="lg" fullWidth onClick={startOver}>
                    Order something else
                  </Button>
                </div>
              </CardBody>
            </Card>
          </div>
        )}
      </div>

      {/* Floating cart, on the menu step only — checkout already shows it. */}
      {step === 'menu' && cart.count > 0 && (
        <div className="fixed bottom-5 left-1/2 z-40 -translate-x-1/2 animate-fade-in-up">
          <Button
            size="lg"
            variant="accent"
            iconLeft={ShoppingBag}
            onClick={() => setCartOpen(true)}
            className="shadow-hover"
          >
            {cart.count} {cart.count === 1 ? 'item' : 'items'} · {money(cart.subtotal)}
          </Button>
        </div>
      )}

      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        cart={cart}
        onCheckout={() => {
          setCartOpen(false)
          setStep('checkout')
        }}
      />
    </>
  )
}
