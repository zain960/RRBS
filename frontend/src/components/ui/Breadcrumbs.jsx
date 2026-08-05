import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'

import cn from '../../lib/cn'

/**
 * Breadcrumb trail.
 *
 * `items` is `[{ label, to? }]`; the last entry is always the current page and
 * renders as plain text with `aria-current="page"` rather than a link to
 * itself.
 *
 * Separators are `aria-hidden` — a screen reader reads the list structure, and
 * hearing "chevron right" between every level is noise.
 */
export default function Breadcrumbs({ items = [], className }) {
  if (items.length === 0) return null

  return (
    <nav aria-label="Breadcrumb" className={cn('min-w-0', className)}>
      <ol className="flex items-center gap-1.5 text-sm">
        {items.map((item, index) => {
          const last = index === items.length - 1

          return (
            <li key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-1.5">
              {index > 0 && (
                <ChevronRight size={14} aria-hidden="true" className="shrink-0 text-neutral-300" />
              )}

              {last || !item.to ? (
                <span
                  aria-current={last ? 'page' : undefined}
                  className={cn(
                    'truncate',
                    last ? 'font-medium text-neutral-700' : 'text-neutral-500'
                  )}
                >
                  {item.label}
                </span>
              ) : (
                <Link
                  to={item.to}
                  className="truncate rounded-sm text-neutral-500 transition-colors duration-hover hover:text-neutral-800"
                >
                  {item.label}
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
