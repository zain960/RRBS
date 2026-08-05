import { Check } from 'lucide-react'

import cn from '../../lib/cn'

/**
 * Horizontal progress indicator for a multi-step flow.
 *
 * Purely an indicator — steps are not clickable. In the booking flow a
 * completed step has already created server-side state (a held booking, a
 * recorded payment), so jumping back into it would mean either re-creating it
 * or silently editing it. The flow's own Back buttons handle the cases where
 * going back is safe.
 *
 * `steps` is `[{ key, label }]`; `current` is the active key.
 */
export default function Stepper({ steps, current, className }) {
  const currentIndex = steps.findIndex((step) => step.key === current)

  return (
    <nav aria-label="Progress" className={className}>
      <p className="sr-only" aria-live="polite">
        Step {currentIndex + 1} of {steps.length}: {steps[currentIndex]?.label}
      </p>

      <ol className="flex items-center">
        {steps.map((step, index) => {
          const done = index < currentIndex
          const active = index === currentIndex

          return (
            <li
              key={step.key}
              className={cn('flex items-center', index < steps.length - 1 && 'flex-1')}
            >
              <div className="flex items-center gap-2.5">
                <span
                  aria-hidden="true"
                  className={cn(
                    'grid h-8 w-8 shrink-0 place-items-center rounded-full border text-xs font-semibold',
                    'transition-colors duration-state ease-in-out',
                    done && 'border-primary-800 bg-primary-800 text-white',
                    active && 'border-accent-500 bg-accent-500 text-white',
                    !done && !active && 'border-neutral-300 bg-white text-neutral-400'
                  )}
                >
                  {done ? <Check size={15} strokeWidth={3} /> : index + 1}
                </span>

                <span
                  className={cn(
                    'hidden whitespace-nowrap text-sm font-medium sm:block',
                    active ? 'text-neutral-900' : done ? 'text-neutral-600' : 'text-neutral-400'
                  )}
                >
                  {step.label}
                </span>
              </div>

              {index < steps.length - 1 && (
                <span
                  aria-hidden="true"
                  className={cn(
                    'mx-3 h-px flex-1 transition-colors duration-state',
                    done ? 'bg-primary-800' : 'bg-neutral-200'
                  )}
                />
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
