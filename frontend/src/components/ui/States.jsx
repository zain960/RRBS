import { AlertTriangle, Inbox, RefreshCw } from 'lucide-react'

import cn from '../../lib/cn'
import Button from './Button'

/**
 * Empty and error states.
 *
 * These are not decoration. An empty list and a failed load look identical if
 * both render as blank space, and a guest cannot tell whether they have no
 * bookings or the server is down. Every list and detail screen in the app is
 * required to render one of these (spec §5).
 *
 * Copy convention: title states the fact, description says what to do next.
 */

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  size = 'md',
  className,
}) {
  const padding = size === 'sm' ? 'py-8' : 'py-14'

  return (
    <div className={cn('px-6 text-center', padding, className)}>
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-neutral-100 text-neutral-400">
        <Icon size={22} aria-hidden="true" />
      </span>
      <p className="mt-4 text-sm font-semibold text-neutral-900">{title}</p>
      {description && (
        <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-neutral-500">
          {description}
        </p>
      )}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  )
}

/**
 * A failed load, with a way back. `onRetry` is optional — omit it where
 * retrying the same request cannot help and the user has to change something.
 */
export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  retryLabel = 'Try again',
  size = 'md',
  className,
}) {
  const padding = size === 'sm' ? 'py-8' : 'py-14'

  return (
    <div role="alert" className={cn('px-6 text-center', padding, className)}>
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-red-50 text-danger">
        <AlertTriangle size={22} aria-hidden="true" />
      </span>
      <p className="mt-4 text-sm font-semibold text-neutral-900">{title}</p>
      {message && (
        <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-neutral-500">{message}</p>
      )}
      {onRetry && (
        <div className="mt-5 flex justify-center">
          <Button variant="secondary" size="sm" iconLeft={RefreshCw} onClick={onRetry}>
            {retryLabel}
          </Button>
        </div>
      )}
    </div>
  )
}

/**
 * Inline error card — for a failure beside content that is still usable, where
 * blanking the whole panel would lose more than it explains.
 */
export function InlineError({ message, onRetry, className }) {
  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3',
        className
      )}
    >
      <AlertTriangle size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-danger" />
      <p className="flex-1 text-sm text-red-900">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="shrink-0 text-sm font-medium text-red-900 underline underline-offset-2 hover:text-red-700"
        >
          Retry
        </button>
      )}
    </div>
  )
}

/** Wraps any state above in a full-width row, for use inside a `<tbody>`. */
export function TableState({ colSpan, children }) {
  return (
    <tr>
      <td colSpan={colSpan} className="p-0">
        {children}
      </td>
    </tr>
  )
}
