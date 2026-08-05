import cn from '../../lib/cn'

/**
 * A titled group of fields.
 *
 * Long forms (a room type carries seven rates, a coupon eight rules) become
 * unreadable as one flat column. Grouping them under a title and a line of
 * explanation is what lets someone fill one in without the SRS open beside
 * them.
 *
 * `columns` sets the grid at `sm` and up; every field is full width on a phone
 * regardless, because two-column forms do not fit at 375px (spec §8).
 */
export default function FormSection({
  title,
  description,
  columns = 2,
  className,
  children,
}) {
  const grid = {
    1: 'sm:grid-cols-1',
    2: 'sm:grid-cols-2',
    3: 'sm:grid-cols-3',
  }

  return (
    <section className={cn('space-y-4', className)}>
      {(title || description) && (
        <div>
          {title && <h3 className="text-sm font-semibold text-neutral-900">{title}</h3>}
          {description && (
            <p className="mt-1 text-sm leading-relaxed text-neutral-500">{description}</p>
          )}
        </div>
      )}

      <div className={cn('grid grid-cols-1 gap-4', grid[columns] ?? grid[2])}>{children}</div>
    </section>
  )
}

/** Makes one field span the full width of a multi-column FormSection. */
export function FullWidth({ className, children }) {
  return <div className={cn('sm:col-span-full', className)}>{children}</div>
}

/** Separates sections inside one form without adding a heading. */
export function FormDivider({ className }) {
  return <hr className={cn('border-neutral-200', className)} />
}

/**
 * The button row at the bottom of a form. Reversed on mobile so the primary
 * action sits at the top of the stack, under the thumb.
 */
export function FormActions({ className, children }) {
  return (
    <div
      className={cn(
        'flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end',
        className
      )}
    >
      {children}
    </div>
  )
}
