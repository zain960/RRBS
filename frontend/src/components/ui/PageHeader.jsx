import cn from '../../lib/cn'
import Breadcrumbs from './Breadcrumbs'

/**
 * The top of every admin screen: title, one line of context, and the primary
 * action on the right.
 *
 * Uniform on purpose — spec §4 asks for one pattern across the back office, and
 * a header that moves between screens is what makes an admin feel assembled
 * from parts.
 *
 * Title is Title Case, subtitle is a sentence (spec §10).
 */
export default function PageHeader({
  title,
  subtitle,
  breadcrumbs,
  actions,
  className,
  children,
}) {
  return (
    <header className={cn('mb-6', className)}>
      {breadcrumbs && <Breadcrumbs items={breadcrumbs} className="mb-2" />}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-neutral-900">{title}</h1>
          {subtitle && (
            <p className="mt-1 text-sm leading-relaxed text-neutral-500">{subtitle}</p>
          )}
        </div>

        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>

      {children && <div className="mt-4">{children}</div>}
    </header>
  )
}

/**
 * The filter strip that sits between a page header and its table: search on the
 * left, filters and view switches on the right.
 */
export function FilterBar({ className, children }) {
  return (
    <div
      className={cn(
        'mb-4 flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-3 shadow-card',
        'sm:flex-row sm:flex-wrap sm:items-center',
        className
      )}
    >
      {children}
    </div>
  )
}
