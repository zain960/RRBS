import { format, formatDistanceToNowStrict, isValid, parseISO } from 'date-fns'

/**
 * One place that turns API values into display strings.
 *
 * Money arrives from the API as a decimal *string* (`"6000"`, `"1499.50"`) —
 * never a number — because the backend stores `Decimal(10,2)` and JS floats
 * would round it (CLAUDE.md §3 Money). These helpers parse for display only;
 * no arithmetic happens here.
 *
 * Datetimes arrive as UTC ISO strings and are converted to the viewer's locale
 * at this layer and nowhere else (CLAUDE.md §3 Datetimes).
 */

/** Confirm with the client before launch (SRS §10). */
const CURRENCY = 'PKR'
const LOCALE = undefined // follow the browser

const currencyFormatter = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: CURRENCY,
  maximumFractionDigits: 0,
})

const currencyWithPaisaFormatter = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: CURRENCY,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const numberFormatter = new Intl.NumberFormat(LOCALE)

/**
 * Money for display. Whole amounts drop the decimals — a room rate reads as
 * "PKR 6,000", not "PKR 6,000.00" — but anything with paisa keeps both digits
 * so a bill line never appears to have been rounded.
 */
export function money(value, { alwaysDecimals = false } = {}) {
  if (value === null || value === undefined || value === '') return '—'
  const amount = Number(value)
  if (!Number.isFinite(amount)) return String(value)
  const hasFraction = Math.round(amount * 100) % 100 !== 0
  return (alwaysDecimals || hasFraction ? currencyWithPaisaFormatter : currencyFormatter).format(
    amount
  )
}

/** A signed amount, for refunds and deltas. */
export function signedMoney(value) {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return money(value)
  return `${amount > 0 ? '+' : ''}${money(amount)}`
}

export function number(value) {
  const n = Number(value)
  return Number.isFinite(n) ? numberFormatter.format(n) : '—'
}

export function percent(value, digits = 1) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  return `${n.toFixed(digits).replace(/\.0+$/, '')}%`
}

function toDate(value) {
  if (!value) return null
  const date = value instanceof Date ? value : parseISO(String(value))
  return isValid(date) ? date : null
}

/** "Aug 5, 2026" */
export function dateOnly(value) {
  const date = toDate(value)
  return date ? format(date, 'MMM d, yyyy') : '—'
}

/** "Aug 5, 8:24 PM" — the workhorse for bookings and orders. */
export function dateTime(value) {
  const date = toDate(value)
  return date ? format(date, 'MMM d, h:mm a') : '—'
}

/** "Aug 5, 2026, 8:24 PM" — where the year genuinely matters. */
export function dateTimeLong(value) {
  const date = toDate(value)
  return date ? format(date, 'MMM d, yyyy, h:mm a') : '—'
}

/** "8:24 PM" */
export function timeOnly(value) {
  const date = toDate(value)
  return date ? format(date, 'h:mm a') : '—'
}

/** "12 minutes ago" — kitchen queue and notification timestamps. */
export function relativeTime(value) {
  const date = toDate(value)
  if (!date) return '—'
  return `${formatDistanceToNowStrict(date)} ago`
}

/** Minutes elapsed since `value`, for wait-time colour coding. */
export function minutesSince(value) {
  const date = toDate(value)
  if (!date) return 0
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000))
}

/** A check-in → check-out window on one line. */
export function dateRange(from, to) {
  const start = toDate(from)
  const end = toDate(to)
  if (!start || !end) return '—'
  const sameDay = format(start, 'yyyy-MM-dd') === format(end, 'yyyy-MM-dd')
  return sameDay
    ? `${format(start, 'MMM d, h:mm a')} → ${format(end, 'h:mm a')}`
    : `${format(start, 'MMM d, h:mm a')} → ${format(end, 'MMM d, h:mm a')}`
}

/** `<input type="datetime-local">` wants local wall time, not a UTC ISO string. */
export function toLocalInputValue(value) {
  const date = toDate(value) ?? new Date()
  const offset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

/** Initials for an avatar fallback: "System Administrator" → "SA". */
export function initials(name) {
  if (!name) return '?'
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}
