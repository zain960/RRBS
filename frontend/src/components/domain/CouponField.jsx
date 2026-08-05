import { BadgeCheck, BadgePercent, XCircle } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { errorMessage } from '../../api/client'
import { validateCoupon } from '../../api/coupons'
import cn from '../../lib/cn'
import { money } from '../../lib/format'
import { Input, Spinner } from '../ui'

/** Debounce so a code is not re-checked on every keystroke. */
const DEBOUNCE_MS = 500

/**
 * Coupon code input that validates against the server as the customer types
 * (SRS §4.7). Shared by the booking and order checkouts so a code behaves
 * identically in both.
 *
 * The result here is advisory. The authoritative check happens when the booking
 * or order is created — a coupon can hit its usage limit between the two, and
 * only the server-side figures are ever stored (SRS §5.3).
 *
 * @param {'ROOMS'|'FOOD'} target which module the coupon is for
 * @param {string|number} subtotal amount the discount would apply to
 * @param {(result: object|null) => void} onResult latest validation result
 */
export default function CouponField({ target, subtotal, value, onChange, onResult, error }) {
  const [state, setState] = useState({ status: 'idle', result: null })

  // Held in a ref so the debounce effect depends only on the code and subtotal.
  const onResultRef = useRef(onResult)
  onResultRef.current = onResult

  useEffect(() => {
    const code = value.trim()

    if (!code) {
      setState({ status: 'idle', result: null })
      onResultRef.current?.(null)
      return undefined
    }

    setState((current) => ({ ...current, status: 'checking' }))

    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        const result = await validateCoupon({ code, target, subtotal: String(subtotal) })
        if (cancelled) return
        setState({ status: 'done', result })
        onResultRef.current?.(result)
      } catch (err) {
        if (cancelled) return
        // A transport failure, not a rejected coupon — those come back as 200.
        setState({
          status: 'done',
          result: { valid: false, message: errorMessage(err, 'Could not check that code.') },
        })
        onResultRef.current?.(null)
      }
    }, DEBOUNCE_MS)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [value, target, subtotal])

  const { status, result } = state
  const rejected = status === 'done' && result?.valid === false
  const accepted = status === 'done' && result?.valid === true

  return (
    <div>
      <Input
        label="Coupon code"
        id="couponCode"
        value={value}
        onChange={(event) => onChange(event.target.value.toUpperCase())}
        maxLength={30}
        autoComplete="off"
        placeholder="e.g. WELCOME10"
        iconLeft={BadgePercent}
        className="uppercase"
        error={error || (rejected ? result.message : undefined)}
        aria-describedby="couponFeedback"
      />

      {/* Live region so the outcome is announced as it arrives, without
          stealing focus from the field being typed into (spec §9). */}
      <p
        id="couponFeedback"
        aria-live="polite"
        className={cn(
          'mt-1.5 flex items-center gap-1.5 text-xs',
          accepted ? 'text-success' : 'text-neutral-500'
        )}
      >
        {status === 'checking' && (
          <>
            <Spinner className="h-3 w-3" />
            Checking…
          </>
        )}

        {accepted && (
          <>
            <BadgeCheck size={13} aria-hidden="true" />
            {result.message} — {money(result.discountAmount)} off.
          </>
        )}

        {rejected && (
          <>
            <XCircle size={13} aria-hidden="true" className="text-danger" />
            <span className="sr-only">{result.message}</span>
          </>
        )}

        {status === 'idle' && 'One coupon per booking or order.'}
      </p>
    </div>
  )
}

/**
 * Price breakdown in the order the SRS defines it (§5.3):
 * Subtotal − Discount + Tax = Total.
 *
 * The order of these rows is not cosmetic — tax is applied *after* the
 * discount, and showing them in this sequence is how a guest can check the
 * arithmetic against the bill.
 */
export function PriceBreakdown({ subtotal, discountAmount, taxAmount, totalAmount, note, className }) {
  const discounted = Number(discountAmount) > 0

  return (
    <dl className={cn('space-y-2 text-sm', className)}>
      <Row label="Subtotal" value={money(subtotal)} />
      <Row
        label="Discount"
        value={discounted ? `− ${money(discountAmount)}` : money(0)}
        tone={discounted ? 'success' : 'muted'}
      />
      <Row label="Tax" value={money(taxAmount)} />

      <div className="!mt-3 border-t border-neutral-200 pt-3">
        <Row label="Total" value={money(totalAmount, { alwaysDecimals: true })} strong />
      </div>

      {note && <p className="!mt-3 text-xs leading-relaxed text-neutral-500">{note}</p>}
    </dl>
  )
}

function Row({ label, value, strong, tone }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className={strong ? 'font-medium text-neutral-900' : 'text-neutral-500'}>{label}</dt>
      <dd
        className={cn(
          'tabular-nums',
          strong && 'text-base font-semibold text-neutral-900',
          !strong && tone === 'success' && 'font-medium text-success',
          !strong && tone === 'muted' && 'text-neutral-400',
          !strong && !tone && 'text-neutral-700'
        )}
      >
        {value}
      </dd>
    </div>
  )
}
