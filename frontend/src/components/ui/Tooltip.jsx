import { useId, useState } from 'react'

import cn from '../../lib/cn'

/**
 * Tooltip.
 *
 * Opens on hover *and* on focus, so the hint is reachable by keyboard — a
 * hover-only tooltip is invisible to anyone not using a mouse (spec §9).
 *
 * The tip is wired with `aria-describedby`, which means it supplements the
 * control's name rather than replacing it. Never put essential information
 * here: a tooltip is unreachable on touch, so anything a user must know to
 * proceed belongs in a hint line instead.
 */

const SIDES = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
}

export default function Tooltip({ content, side = 'top', children, className }) {
  const [open, setOpen] = useState(false)
  const id = useId()

  if (!content) return children

  return (
    <span
      className={cn('relative inline-flex', className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocusCapture={() => setOpen(true)}
      onBlurCapture={() => setOpen(false)}
    >
      <span aria-describedby={open ? id : undefined} className="inline-flex">
        {children}
      </span>

      {open && (
        <span
          role="tooltip"
          id={id}
          className={cn(
            'pointer-events-none absolute z-50 w-max max-w-xs animate-fade-in',
            'rounded-sm bg-primary-900 px-2 py-1 text-xs font-medium text-white shadow-hover',
            SIDES[side] ?? SIDES.top
          )}
        >
          {content}
        </span>
      )}
    </span>
  )
}
