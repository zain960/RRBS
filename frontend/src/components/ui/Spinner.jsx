import cn from '../../lib/cn'

/**
 * Indeterminate spinner, sized by className.
 *
 * Used for button actions only — lists get skeletons instead, because a
 * skeleton preserves the page's shape while a spinner collapses it and makes
 * the layout jump when data lands (spec §5 Data states).
 */
export default function Spinner({ className = 'h-5 w-5', label }) {
  return (
    <>
      <svg
        className={cn('animate-spin', className)}
        viewBox="0 0 24 24"
        aria-hidden="true"
        focusable="false"
      >
        <circle
          cx="12"
          cy="12"
          r="9"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          className="opacity-20"
        />
        <path
          d="M21 12a9 9 0 0 0-9-9"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
      {label && <span className="sr-only">{label}</span>}
    </>
  )
}
