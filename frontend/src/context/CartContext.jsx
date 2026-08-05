import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const CartContext = createContext(null)

const STORAGE_KEY = 'rrbs.cart'

/**
 * The food cart, shared by the public menu and the order flow.
 *
 * Before this existed the cart lived inside `/order`, so browsing `/menu` and
 * then starting an order lost everything the guest had picked. It is persisted
 * to localStorage for the same reason: a cart that evaporates on refresh is a
 * cart the guest rebuilds from memory.
 *
 * Lines store a snapshot of name and price alongside the id. The price shown in
 * the cart is *indicative only* — the server prices the order at creation and
 * that figure is what gets stored (CLAUDE.md §4, prices locked at confirmation).
 */
export function CartProvider({ children }) {
  const [lines, setLines] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return stored ? JSON.parse(stored) : {}
    } catch {
      return {}
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lines))
    } catch {
      // A full or disabled storage quota must not break ordering.
    }
  }, [lines])

  const add = useCallback((food, quantity = 1) => {
    if (food.availabilityStatus === 'UNAVAILABLE') return
    setLines((current) => {
      const existing = current[food.id]
      const next = (existing?.quantity ?? 0) + quantity
      if (next <= 0) {
        const { [food.id]: _removed, ...rest } = current
        return rest
      }
      return {
        ...current,
        [food.id]: {
          id: food.id,
          name: food.name,
          price: food.price,
          imageUrl: food.imageUrl ?? null,
          quantity: next,
        },
      }
    })
  }, [])

  const remove = useCallback((food) => add(food, -1), [add])

  const setQuantity = useCallback((foodId, quantity) => {
    setLines((current) => {
      if (!current[foodId]) return current
      if (quantity <= 0) {
        const { [foodId]: _removed, ...rest } = current
        return rest
      }
      return { ...current, [foodId]: { ...current[foodId], quantity } }
    })
  }, [])

  const clear = useCallback(() => setLines({}), [])

  const value = useMemo(() => {
    const items = Object.values(lines)
    return {
      lines,
      items,
      count: items.reduce((total, line) => total + line.quantity, 0),
      // Indicative subtotal for the cart badge; the server is authoritative.
      subtotal: items.reduce((total, line) => total + Number(line.price) * line.quantity, 0),
      quantityOf: (foodId) => lines[foodId]?.quantity ?? 0,
      add,
      remove,
      setQuantity,
      clear,
    }
  }, [lines, add, remove, setQuantity, clear])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const context = useContext(CartContext)
  if (!context) throw new Error('useCart must be used inside a <CartProvider>')
  return context
}
