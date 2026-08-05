import cn from '../../lib/cn'

/**
 * Loading placeholders.
 *
 * A skeleton stands in for the shape that is coming, so the page does not jump
 * when data lands. Lists, cards and images all get one; only button actions get
 * a spinner (spec §5).
 *
 * The whole group is wrapped in one `role="status"` with an accessible label
 * rather than announcing each bar, so a screen reader hears "Loading bookings"
 * once instead of forty times.
 */

export default function Skeleton({ className, rounded = 'rounded' }) {
  return <span className={cn('skeleton block', rounded, className)} aria-hidden="true" />
}

export function SkeletonText({ lines = 3, className }) {
  return (
    <div className={cn('space-y-2', className)} aria-hidden="true">
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          className={cn('h-3.5', index === lines - 1 ? 'w-2/3' : 'w-full')}
          rounded="rounded-sm"
        />
      ))}
    </div>
  )
}

/** Mirrors a room/food card: image block, title, meta line, action. */
export function SkeletonCard({ aspect = 'aspect-[16/9]', className }) {
  return (
    <div
      className={cn('overflow-hidden rounded-lg border border-neutral-200 bg-white', className)}
      aria-hidden="true"
    >
      <Skeleton className={cn('w-full', aspect)} rounded="rounded-none" />
      <div className="space-y-3 p-4">
        <Skeleton className="h-4 w-1/2" rounded="rounded-sm" />
        <Skeleton className="h-3 w-full" rounded="rounded-sm" />
        <div className="flex items-center justify-between pt-1">
          <Skeleton className="h-4 w-20" rounded="rounded-sm" />
          <Skeleton className="h-8 w-20" />
        </div>
      </div>
    </div>
  )
}

/** Table body placeholder — same column count as the real thing. */
export function SkeletonRows({ rows = 5, columns = 4 }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <tr key={rowIndex} className="border-b border-neutral-100 last:border-0">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <td key={colIndex} className="px-4 py-3.5">
              <Skeleton
                className={cn('h-3.5', colIndex === 0 ? 'w-3/4' : 'w-1/2')}
                rounded="rounded-sm"
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

export function SkeletonImage({ className, rounded = 'rounded-lg' }) {
  return <Skeleton className={className} rounded={rounded} />
}

/**
 * Wrap a skeleton group so its loading state is announced once.
 * `label` should name what is loading: "Loading today's bookings".
 */
export function SkeletonGroup({ label = 'Loading…', className, children }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  )
}
