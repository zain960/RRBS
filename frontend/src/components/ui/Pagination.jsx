import { ChevronLeft, ChevronRight } from 'lucide-react'

import cn from '../../lib/cn'
import { number } from '../../lib/format'

/**
 * Pagination bound to the API's `meta` envelope (`page`, `pageSize`, `total` —
 * CLAUDE.md §3), so a caller passes the envelope straight through rather than
 * deriving page counts itself.
 *
 * Renders nothing when everything fits on one page: a lone "1" is furniture.
 *
 * The window is at most seven slots, with ellipses standing in for the skipped
 * ranges, so the control's width does not depend on how many records exist.
 */

function pageWindow(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1)

  if (current <= 4) return [1, 2, 3, 4, 5, '…', total]
  if (current >= total - 3) return [1, '…', total - 4, total - 3, total - 2, total - 1, total]
  return [1, '…', current - 1, current, current + 1, '…', total]
}

export default function Pagination({ page, pageSize, total, onPageChange, className }) {
  const totalPages = Math.max(1, Math.ceil((total ?? 0) / (pageSize || 1)))
  if (totalPages <= 1) return null

  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  const stepClasses =
    'inline-flex h-8 w-8 items-center justify-center rounded-sm border border-neutral-300 ' +
    'text-neutral-600 transition-colors duration-hover hover:bg-neutral-50 hover:text-neutral-900 ' +
    'disabled:pointer-events-none disabled:opacity-40'

  return (
    <nav
      aria-label="Pagination"
      className={cn(
        'flex flex-col-reverse items-center justify-between gap-3 border-t border-neutral-200 px-4 py-3 sm:flex-row',
        className
      )}
    >
      <p className="text-xs text-neutral-500">
        Showing <span className="font-medium text-neutral-700">{number(from)}</span>–
        <span className="font-medium text-neutral-700">{number(to)}</span> of{' '}
        <span className="font-medium text-neutral-700">{number(total)}</span>
      </p>

      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className={stepClasses}
        >
          <ChevronLeft size={16} aria-hidden="true" />
        </button>

        {pageWindow(page, totalPages).map((entry, index) =>
          entry === '…' ? (
            <span key={`gap-${index}`} className="px-1.5 text-sm text-neutral-400" aria-hidden="true">
              …
            </span>
          ) : (
            <button
              key={entry}
              type="button"
              aria-label={`Page ${entry}`}
              aria-current={entry === page ? 'page' : undefined}
              onClick={() => onPageChange(entry)}
              className={cn(
                'inline-flex h-8 min-w-8 items-center justify-center rounded-sm px-2 text-sm font-medium',
                'transition-colors duration-hover',
                entry === page
                  ? 'bg-primary-800 text-white'
                  : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
              )}
            >
              {entry}
            </button>
          )
        )}

        <button
          type="button"
          aria-label="Next page"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className={stepClasses}
        >
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>
    </nav>
  )
}
