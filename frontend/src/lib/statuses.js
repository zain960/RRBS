/**
 * The single source of truth for how every enum in the system is *named* and
 * *coloured* in the UI.
 *
 * Before this file the same status could render three ways on three screens.
 * Every chip, badge, filter dropdown and legend now reads from here, so adding
 * a status is one edit rather than a hunt (CLAUDE.md §3 — the API's machine
 * codes stay canonical; these are their human labels).
 *
 * Tones map to the Badge component's variants, not to raw colours, so the
 * palette can shift without touching this file.
 */

/** Tone vocabulary shared by every status family below. */
export const TONES = {
  neutral: 'neutral',
  info: 'info',
  progress: 'progress',
  success: 'success',
  warning: 'warning',
  danger: 'danger',
  accent: 'accent',
}

/**
 * Bookings (SRS §5.1). Pending is warm because it is waiting on the guest;
 * Confirmed is informational; Checked-in is the "live" green; Checked-out is
 * closed and therefore quiet; No-show is a warning, not an error, because it is
 * a normal operational outcome logged separately from a cancellation.
 */
export const BOOKING_STATUS = {
  PENDING: { label: 'Pending', tone: TONES.warning },
  CONFIRMED: { label: 'Confirmed', tone: TONES.info },
  CHECKED_IN: { label: 'Checked-in', tone: TONES.success },
  CHECKED_OUT: { label: 'Checked-out', tone: TONES.neutral },
  CANCELLED: { label: 'Cancelled', tone: TONES.danger },
  NO_SHOW: { label: 'No-show', tone: TONES.warning },
}

/**
 * Orders (SRS §5.2). Everything still being worked on is warm, every terminal
 * "the guest has it" state is green, and Billed to Room is accent because it is
 * the one outcome that moves money onto a booking rather than closing out.
 */
export const ORDER_STATUS = {
  PLACED: { label: 'Placed', tone: TONES.warning },
  PREPARING: { label: 'Preparing', tone: TONES.progress },
  READY: { label: 'Ready', tone: TONES.info },
  SERVED: { label: 'Served', tone: TONES.success },
  PICKED_UP: { label: 'Picked up', tone: TONES.success },
  DISPATCHED: { label: 'Dispatched', tone: TONES.info },
  DELIVERED: { label: 'Delivered', tone: TONES.success },
  BILLED_TO_ROOM: { label: 'Billed to room', tone: TONES.accent },
  CANCELLED: { label: 'Cancelled', tone: TONES.danger },
}

export const ORDER_TYPE = {
  DINE_IN: { label: 'Dine-in', icon: 'UtensilsCrossed' },
  TAKEAWAY: { label: 'Takeaway', icon: 'ShoppingBag' },
  DELIVERY: { label: 'Delivery', icon: 'Bike' },
  ROOM_SERVICE: { label: 'Room service', icon: 'BellRing' },
}

/** Rooms (SRS §4.2). Maintenance is a warning: it removes the room from sale. */
export const ROOM_STATUS = {
  AVAILABLE: { label: 'Available', tone: TONES.success },
  OCCUPIED: { label: 'Occupied', tone: TONES.info },
  RESERVED: { label: 'Reserved', tone: TONES.warning },
  MAINTENANCE: { label: 'Maintenance', tone: TONES.danger },
}

export const TABLE_STATUS = {
  FREE: { label: 'Free', tone: TONES.success },
  OCCUPIED: { label: 'Occupied', tone: TONES.info },
  RESERVED: { label: 'Reserved', tone: TONES.warning },
}

export const TABLE_LOCATION = {
  INDOOR: { label: 'Indoor' },
  OUTDOOR: { label: 'Outdoor' },
}

export const PAYMENT_STATUS = {
  PENDING: { label: 'Pending', tone: TONES.warning },
  COMPLETED: { label: 'Completed', tone: TONES.success },
  FAILED: { label: 'Failed', tone: TONES.danger },
  REFUNDED: { label: 'Refunded', tone: TONES.neutral },
}

export const PAYMENT_TYPE = {
  FULL: { label: 'Full', tone: TONES.success },
  ADVANCE: { label: 'Advance', tone: TONES.info },
  BALANCE: { label: 'Balance', tone: TONES.info },
  REFUND: { label: 'Refund', tone: TONES.danger },
}

export const PAYMENT_METHOD = {
  CASH: { label: 'Cash', icon: 'Banknote' },
  CARD: { label: 'Card', icon: 'CreditCard' },
  ONLINE: { label: 'Online', icon: 'Globe' },
}

export const FOOD_AVAILABILITY = {
  AVAILABLE: { label: 'Available', tone: TONES.success },
  UNAVAILABLE: { label: 'Unavailable', tone: TONES.neutral },
}

export const USER_STATUS = {
  ACTIVE: { label: 'Active', tone: TONES.success },
  INACTIVE: { label: 'Inactive', tone: TONES.neutral },
}

export const DISCOUNT_TYPE = {
  PERCENTAGE: { label: 'Percentage' },
  FIXED_AMOUNT: { label: 'Fixed amount' },
}

export const COUPON_APPLICABILITY = {
  ROOMS: { label: 'Rooms', tone: TONES.info },
  FOOD: { label: 'Food', tone: TONES.accent },
  BOTH: { label: 'Both', tone: TONES.neutral },
}

/**
 * Look up a status in one of the maps above.
 *
 * Falls back to a de-underscored version of the raw value rather than throwing:
 * a status the API adds before the UI knows about it should render legibly and
 * in a neutral tone, not crash the screen.
 */
export function statusMeta(map, value) {
  if (!value) return { label: '—', tone: TONES.neutral }
  return (
    map[value] ?? {
      label: String(value)
        .toLowerCase()
        .replace(/_/g, ' ')
        .replace(/^./, (c) => c.toUpperCase()),
      tone: TONES.neutral,
    }
  )
}

/** `{ value, label }` pairs for a Select or a filter chip row. */
export function statusOptions(map) {
  return Object.entries(map).map(([value, meta]) => ({ value, label: meta.label }))
}
