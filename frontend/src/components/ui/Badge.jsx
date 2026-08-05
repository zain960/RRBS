import cn from '../../lib/cn'
import { statusMeta } from '../../lib/statuses'

/**
 * Badge and StatusChip.
 *
 * `Badge` is the primitive: a tone and a label. `StatusChip` is the one callers
 * should reach for — hand it a status map from lib/statuses and a raw enum
 * value and it resolves the label and tone itself, which is what keeps a status
 * from rendering two different ways on two screens (spec §2).
 *
 * Tones are semantic, not colour names, so `PREPARING` asks for "progress" and
 * the palette decides that means orange.
 */

const TONES = {
  neutral: 'bg-neutral-100 text-neutral-700 border-neutral-300',
  info: 'bg-sky-50 text-sky-800 border-sky-200',
  progress: 'bg-orange-50 text-orange-800 border-orange-200',
  success: 'bg-green-50 text-green-800 border-green-200',
  warning: 'bg-amber-50 text-amber-900 border-amber-200',
  danger: 'bg-red-50 text-red-800 border-red-200',
  accent: 'bg-accent-50 text-accent-700 border-accent-200',
  primary: 'bg-primary-50 text-primary-800 border-primary-200',
}

const SIZES = {
  sm: 'h-5 px-1.5 text-[11px] gap-1',
  md: 'h-6 px-2 text-xs gap-1',
  lg: 'h-7 px-2.5 text-sm gap-1.5',
}

export default function Badge({
  tone = 'neutral',
  size = 'md',
  icon: Icon,
  dot = false,
  className,
  children,
  ...props
}) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center whitespace-nowrap rounded-full border font-medium',
        TONES[tone] ?? TONES.neutral,
        SIZES[size] ?? SIZES.md,
        className
      )}
      {...props}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" aria-hidden="true" />}
      {Icon && <Icon size={size === 'lg' ? 14 : 12} aria-hidden="true" />}
      {children}
    </span>
  )
}

/**
 * A status from one of the maps in lib/statuses.
 *
 * `map` is required so the same raw string can mean different things in
 * different families — `PENDING` is a booking awaiting payment and also a
 * payment awaiting settlement, and they are not the same chip.
 */
export function StatusChip({ map, value, size = 'md', dot = true, className }) {
  const meta = statusMeta(map, value)
  return (
    <Badge tone={meta.tone} size={size} dot={dot} className={className}>
      {meta.label}
    </Badge>
  )
}
