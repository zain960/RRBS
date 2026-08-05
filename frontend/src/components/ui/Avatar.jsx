import cn from '../../lib/cn'
import { initials } from '../../lib/format'

/**
 * Avatar with an initials fallback.
 *
 * There are no uploaded profile pictures in this phase, so initials on a tinted
 * disc are the normal case rather than the fallback — the `src` branch exists
 * so adding them later is not a rewrite.
 *
 * The disc colour is derived from the name so the same person is the same
 * colour everywhere, which makes a list of staff scannable without reading.
 */

const SIZES = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
}

const PALETTE = [
  'bg-primary-100 text-primary-800',
  'bg-accent-100 text-accent-700',
  'bg-sky-100 text-sky-800',
  'bg-green-100 text-green-800',
  'bg-orange-100 text-orange-800',
  'bg-neutral-200 text-neutral-700',
]

function toneFor(name) {
  if (!name) return PALETTE[PALETTE.length - 1]
  let hash = 0
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) >>> 0
  }
  return PALETTE[hash % PALETTE.length]
}

export default function Avatar({ name, src, size = 'md', className }) {
  const classes = cn(
    'inline-grid shrink-0 place-items-center overflow-hidden rounded-full font-semibold',
    SIZES[size] ?? SIZES.md,
    className
  )

  if (src) {
    return <img src={src} alt="" className={cn(classes, 'object-cover')} />
  }

  return (
    <span className={cn(classes, toneFor(name))} aria-hidden="true" title={name || undefined}>
      {initials(name)}
    </span>
  )
}
