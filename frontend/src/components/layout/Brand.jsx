import { Link } from 'react-router-dom'

import cn from '../../lib/cn'

/**
 * The RRBS wordmark.
 *
 * A serif "RRBS" with an accent rule under it — the one place the display face
 * appears in the back office, because a brand mark is a brand mark on both
 * sides of the app.
 *
 * `tone="light"` is for the transparent-over-hero header, where the mark sits
 * on a photograph rather than on white.
 */
export default function Brand({ to = '/', tone = 'dark', size = 'md', className }) {
  const sizes = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-2xl',
  }

  return (
    <Link
      to={to}
      className={cn('group inline-flex items-baseline gap-1.5 rounded-sm', className)}
      aria-label="RRBS home"
    >
      <span
        className={cn(
          'font-display font-semibold tracking-tight transition-colors duration-state',
          sizes[size] ?? sizes.md,
          tone === 'light' ? 'text-white' : 'text-primary-800'
        )}
      >
        RRBS
      </span>
      <span
        aria-hidden="true"
        className={cn(
          'h-1.5 w-1.5 rounded-full transition-colors duration-state',
          tone === 'light' ? 'bg-accent-300' : 'bg-accent-500'
        )}
      />
    </Link>
  )
}
