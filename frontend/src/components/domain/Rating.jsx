import { Star } from 'lucide-react'
import { useState } from 'react'

import cn from '../../lib/cn'

const SIZES = { sm: 14, md: 17, lg: 22 }

/**
 * Read-only star rating.
 *
 * The stars carry `aria-hidden` and the value is announced once as text, so a
 * screen reader hears "4.5 out of 5" rather than five separate icons.
 */
export function RatingStars({ value = 0, count, size = 'md', className }) {
  const px = SIZES[size] ?? SIZES.md
  const rounded = Math.round(Number(value) || 0)

  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <span className="flex items-center gap-0.5" aria-hidden="true">
        {Array.from({ length: 5 }).map((_, index) => (
          <Star
            key={index}
            size={px}
            className={index < rounded ? 'fill-accent-400 text-accent-400' : 'text-neutral-200'}
          />
        ))}
      </span>

      {value ? (
        <span className="text-sm text-neutral-500">
          <span className="sr-only">Rated </span>
          {Number(value).toFixed(1)}
          <span className="sr-only"> out of 5</span>
          {count !== undefined && (
            <span className="text-neutral-400">
              {' '}
              ({count})<span className="sr-only"> reviews</span>
            </span>
          )}
        </span>
      ) : (
        <span className="text-sm text-neutral-400">No reviews</span>
      )}
    </span>
  )
}

/**
 * Interactive star picker.
 *
 * A real radio group underneath: each star is a radio input, so arrow keys and
 * space work, and the current value is announced. Hover only affects the
 * preview, never the value.
 */
export function RatingInput({ value, onChange, name = 'rating', error }) {
  const [hovered, setHovered] = useState(0)
  const shown = hovered || value

  return (
    <div>
      <div
        role="radiogroup"
        aria-label="Rating out of 5"
        className="flex items-center gap-1"
        onMouseLeave={() => setHovered(0)}
      >
        {[1, 2, 3, 4, 5].map((star) => (
          <label
            key={star}
            onMouseEnter={() => setHovered(star)}
            className="cursor-pointer rounded-sm p-0.5"
          >
            <input
              type="radio"
              name={name}
              value={star}
              checked={value === star}
              onChange={() => onChange(star)}
              className="peer sr-only"
            />
            <Star
              size={28}
              aria-hidden="true"
              className={cn(
                'transition-colors duration-hover',
                'peer-focus-visible:ring-2 peer-focus-visible:ring-accent-500 peer-focus-visible:ring-offset-2',
                star <= shown ? 'fill-accent-400 text-accent-400' : 'text-neutral-300'
              )}
            />
            <span className="sr-only">
              {star} star{star === 1 ? '' : 's'}
            </span>
          </label>
        ))}

        <span className="ml-2 text-sm text-neutral-500" aria-live="polite">
          {value ? `${value} of 5` : 'Tap a star'}
        </span>
      </div>

      {error && (
        <p role="alert" className="mt-1.5 text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
