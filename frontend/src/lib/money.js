/**
 * Exact money arithmetic for the presentation layer.
 *
 * The API sends money as decimal strings because the database stores
 * `Decimal(10,2)`, and `0.1 + 0.2` in JS floats is not `0.3` — a bill that adds
 * up on the server must not disagree with the one on screen (CLAUDE.md §3
 * Money).
 *
 * Everything here works in integer paisa and converts back at the end, so no
 * intermediate value is ever a fraction. This is for *displaying* a figure the
 * server has not pre-computed (a running paid total). Anything charged is
 * calculated server-side and read from the stored columns — never recomputed
 * here (CLAUDE.md §4: prices are locked at confirmation).
 */

/** A decimal money string to integer paisa. Non-numeric input counts as zero. */
function toPaisa(value) {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return 0
  return Math.round(amount * 100)
}

/** Integer paisa back to the decimal string shape the API uses. */
function fromPaisa(paisa) {
  const sign = paisa < 0 ? '-' : ''
  const absolute = Math.abs(paisa)
  return `${sign}${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, '0')}`
}

/** Sum of money strings, as a money string. */
export function sumMoney(values) {
  return fromPaisa(values.reduce((total, value) => total + toPaisa(value), 0))
}

/** `a - b`, as a money string. */
export function subtractMoney(a, b) {
  return fromPaisa(toPaisa(a) - toPaisa(b))
}

/** `a - b`, floored at zero — an overpaid booking has no negative balance due. */
export function remainingMoney(a, b) {
  return fromPaisa(Math.max(0, toPaisa(a) - toPaisa(b)))
}

/** True when the amount is more than zero. */
export function isPositiveMoney(value) {
  return toPaisa(value) > 0
}
