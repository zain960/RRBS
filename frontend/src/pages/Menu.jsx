import { ArrowRight, Minus, Plus, ShoppingBag, Trash2, UtensilsCrossed } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { errorMessage } from '../api/client'
import { fetchMenu } from '../api/foods'
import FoodCard from '../components/domain/FoodCard'
import PageMeta from '../components/PageMeta'
import {
  Button,
  Card,
  Drawer,
  EmptyState,
  ErrorState,
  Image,
  SkeletonCard,
  SkeletonGroup,
  Tabs,
} from '../components/ui'
import { useCart } from '../context/CartContext'
import { money } from '../lib/format'

/**
 * The public menu.
 *
 * Browsing and ordering are deliberately separate screens: this one is
 * shareable and needs no decisions, while /order asks for an order type, a
 * table or an address. Items added here travel to /order through the cart
 * context, so nothing is lost crossing between them.
 */
export default function Menu() {
  const navigate = useNavigate()
  const cart = useCart()

  const [menu, setMenu] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [category, setCategory] = useState('all')
  const [cartOpen, setCartOpen] = useState(false)

  const load = useMemo(
    () => () => {
      setLoading(true)
      setError(null)
      fetchMenu()
        .then(setMenu)
        .catch((err) => setError(errorMessage(err, 'Could not load the menu.')))
        .finally(() => setLoading(false))
    },
    []
  )

  useEffect(load, [load])

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

  const visible = useMemo(
    () => (category === 'all' ? menu : menu.filter((entry) => String(entry.id) === category)),
    [menu, category]
  )

  return (
    <>
      <PageMeta
        title="Menu"
        description="Starters, mains, BBQ and grill, beverages, desserts and sides — available for dine-in, takeaway, delivery and room service."
      />

      <div className="border-b border-neutral-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <h1 className="font-display text-4xl font-semibold text-neutral-900">From the kitchen</h1>
          <p className="mt-2 max-w-2xl text-base leading-relaxed text-neutral-500">
            Everything below is cooked to order. Add what you want, then choose dine-in, takeaway,
            delivery or room service at checkout.
          </p>
        </div>

        {/* Sticky under the site header (h-16), so the category row stays
            reachable while scrolling a long menu. */}
        {!loading && !error && menu.length > 0 && (
          <div className="sticky top-16 z-30 border-t border-neutral-200 bg-white/95 backdrop-blur">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <Tabs
                tabs={tabs}
                value={category}
                onChange={setCategory}
                ariaLabel="Menu categories"
                className="border-0"
              />
            </div>
          </div>
        )}
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 pb-28 sm:px-6 lg:px-8">
        {loading ? (
          <SkeletonGroup label="Loading the menu" className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <SkeletonCard key={index} aspect="aspect-[4/3]" />
            ))}
          </SkeletonGroup>
        ) : error ? (
          <Card>
            <ErrorState message={error} onRetry={load} />
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
          <div className="space-y-12">
            {visible.map((entry) => (
              <section key={entry.id} aria-labelledby={`category-${entry.id}`}>
                <h2
                  id={`category-${entry.id}`}
                  className="mb-5 font-display text-2xl font-semibold text-neutral-900"
                >
                  {entry.categoryName}
                </h2>

                {(entry.items ?? []).length === 0 ? (
                  <EmptyState
                    size="sm"
                    icon={UtensilsCrossed}
                    title="Nothing in this category yet"
                    description="Check back later — the kitchen updates the menu regularly."
                  />
                ) : (
                  <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {entry.items.map((food) => (
                      <FoodCard
                        key={food.id}
                        food={food}
                        quantity={cart.quantityOf(food.id)}
                        onAdd={cart.add}
                        onRemove={cart.remove}
                      />
                    ))}
                  </div>
                )}
              </section>
            ))}
          </div>
        )}
      </div>

      {/* Floating cart (spec §4). Only appears once there is something in it. */}
      {cart.count > 0 && (
        <div className="fixed bottom-5 right-5 z-40 animate-fade-in-up">
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
          navigate('/order')
        }}
      />
    </>
  )
}

/**
 * The cart as a side sheet. Shared shape with the order flow's review step, but
 * this one only summarises — pricing, tax and coupons are the server's job at
 * order creation (CLAUDE.md §4), so the total here is explicitly indicative.
 */
export function CartDrawer({ open, onClose, cart, onCheckout }) {
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Your order"
      description={cart.count > 0 ? `${cart.count} ${cart.count === 1 ? 'item' : 'items'}` : undefined}
      footer={
        cart.count > 0 ? (
          <div className="w-full space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-neutral-500">Subtotal</span>
              <span className="font-semibold text-neutral-900">{money(cart.subtotal)}</span>
            </div>
            <p className="text-xs leading-relaxed text-neutral-400">
              Discounts and tax are calculated at checkout, where the kitchen confirms the final
              price.
            </p>
            <Button fullWidth size="lg" iconRight={ArrowRight} onClick={onCheckout}>
              Continue to checkout
            </Button>
          </div>
        ) : null
      }
    >
      {cart.count === 0 ? (
        <EmptyState
          icon={ShoppingBag}
          title="Your order is empty"
          description="Add a dish from the menu and it will show up here."
          action={
            <Button variant="secondary" onClick={onClose}>
              Back to the menu
            </Button>
          }
        />
      ) : (
        <ul className="divide-y divide-neutral-200">
          {cart.items.map((line) => (
            <li key={line.id} className="flex gap-3 py-3">
              <Image
                src={line.imageUrl}
                alt=""
                aspect="aspect-square"
                rounded="rounded"
                className="w-16 shrink-0"
                sizes="64px"
                maxWidth={256}
                fallbackIcon={UtensilsCrossed}
              />

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-neutral-900">{line.name}</p>
                <p className="mt-0.5 text-sm text-neutral-500">{money(line.price)} each</p>

                <div className="mt-2 flex items-center gap-1 rounded border border-neutral-300 p-0.5 w-fit">
                  <button
                    type="button"
                    onClick={() => cart.setQuantity(line.id, line.quantity - 1)}
                    aria-label={`Remove one ${line.name}`}
                    className="grid h-6 w-6 place-items-center rounded-sm text-neutral-600 transition-colors duration-hover hover:bg-neutral-100"
                  >
                    <Minus size={13} aria-hidden="true" />
                  </button>
                  <span className="min-w-5 text-center text-sm font-semibold">{line.quantity}</span>
                  <button
                    type="button"
                    onClick={() => cart.setQuantity(line.id, line.quantity + 1)}
                    aria-label={`Add one more ${line.name}`}
                    className="grid h-6 w-6 place-items-center rounded-sm text-neutral-600 transition-colors duration-hover hover:bg-neutral-100"
                  >
                    <Plus size={13} aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div className="flex shrink-0 flex-col items-end justify-between">
                <p className="text-sm font-semibold text-neutral-900">
                  {money(Number(line.price) * line.quantity)}
                </p>
                <button
                  type="button"
                  onClick={() => cart.setQuantity(line.id, 0)}
                  aria-label={`Remove ${line.name} from your order`}
                  className="rounded-sm p-1 text-neutral-400 transition-colors duration-hover hover:text-danger"
                >
                  <Trash2 size={15} aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Drawer>
  )
}
