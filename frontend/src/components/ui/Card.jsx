import cn from '../../lib/cn'

/**
 * Surface container with optional header / body / footer slots.
 *
 * Three variants, each with a job:
 * - `default`  — a hairline border on white. The everyday container.
 * - `elevated` — shadow instead of border. For things that float above the
 *                page (a summary panel, a KPI tile).
 * - `outlined` — heavier border, no shadow. For an inert grouping where a
 *                shadow would imply interactivity.
 *
 * `interactive` adds the hover lift, and should only be set when the whole card
 * is genuinely clickable — otherwise the movement promises something that is
 * not there.
 */

const VARIANTS = {
  default: 'bg-white border border-neutral-200 shadow-card',
  elevated: 'bg-white border border-transparent shadow-hover',
  outlined: 'bg-white border border-neutral-300',
}

const PADDING = {
  none: '',
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-6',
}

export default function Card({
  variant = 'default',
  padding = 'none',
  interactive = false,
  as: Component = 'div',
  className,
  children,
  ...props
}) {
  return (
    <Component
      className={cn(
        'rounded-lg',
        VARIANTS[variant] ?? VARIANTS.default,
        PADDING[padding] ?? '',
        interactive &&
          'cursor-pointer transition-all duration-hover ease-out hover:border-neutral-300 hover:shadow-hover',
        className
      )}
      {...props}
    >
      {children}
    </Component>
  )
}

export function CardHeader({ title, subtitle, action, className, children }) {
  return (
    <div
      className={cn(
        'flex items-start justify-between gap-4 border-b border-neutral-200 px-5 py-4',
        className
      )}
    >
      {children ?? (
        <div className="min-w-0">
          {title && <h3 className="text-sm font-semibold text-neutral-900">{title}</h3>}
          {subtitle && <p className="mt-0.5 text-sm text-neutral-500">{subtitle}</p>}
        </div>
      )}
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

export function CardBody({ className, children }) {
  return <div className={cn('px-5 py-4', className)}>{children}</div>
}

export function CardFooter({ className, children }) {
  return (
    <div
      className={cn(
        'flex items-center justify-end gap-2 border-t border-neutral-200 bg-neutral-50/60 px-5 py-3',
        className
      )}
    >
      {children}
    </div>
  )
}
