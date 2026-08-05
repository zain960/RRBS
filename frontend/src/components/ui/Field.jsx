import { createContext, useContext, useId } from 'react'

import cn from '../../lib/cn'

/**
 * The label / hint / error scaffolding every form control shares.
 *
 * Controls do not each re-implement this. `Field` owns the ids and wires
 * `aria-describedby` and `aria-invalid` onto whatever control it wraps, which
 * is the part that is easy to get wrong and impossible to notice by eye
 * (spec §9 Accessibility).
 *
 * Errors are announced through `aria-live="polite"` so a validation failure
 * reaches a screen reader without stealing focus mid-typing.
 */

const FieldContext = createContext(null)

export function useField() {
  return useContext(FieldContext)
}

export default function Field({
  label,
  hint,
  error,
  required = false,
  htmlFor,
  className,
  children,
}) {
  const generatedId = useId()
  const id = htmlFor ?? generatedId
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined

  const describedBy = cn(hintId, errorId) || undefined

  return (
    <FieldContext.Provider
      value={{ id, describedBy, invalid: Boolean(error), required }}
    >
      <div className={cn('flex flex-col gap-1.5', className)}>
        {label && (
          <label htmlFor={id} className="text-sm font-medium text-neutral-800">
            {label}
            {required && (
              <span className="ml-0.5 text-danger" aria-hidden="true">
                *
              </span>
            )}
            {required && <span className="sr-only"> (required)</span>}
          </label>
        )}

        {children}

        {hint && !error && (
          <p id={hintId} className="text-xs text-neutral-500">
            {hint}
          </p>
        )}

        {error && (
          <p id={errorId} role="alert" aria-live="polite" className="text-xs font-medium text-danger">
            {error}
          </p>
        )}
      </div>
    </FieldContext.Provider>
  )
}

/**
 * Shared control chrome. Every input-like control uses this so a Select and an
 * Input are the same height and share one focus treatment.
 */
export const controlBase =
  'w-full rounded border bg-white text-neutral-900 placeholder:text-neutral-400 ' +
  'transition-colors duration-hover ease-out ' +
  'disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-500'

export const controlSizes = {
  sm: 'h-8 px-2.5 text-sm',
  md: 'h-10 px-3 text-sm',
  lg: 'h-12 px-4 text-base',
}

export function controlTone(invalid) {
  return invalid
    ? 'border-danger focus-visible:ring-danger'
    : 'border-neutral-300 hover:border-neutral-400'
}
