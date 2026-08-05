import { forwardRef, useId } from 'react'
import { Check, Minus } from 'lucide-react'

import cn from '../../lib/cn'

/**
 * Checkbox, Radio and Switch.
 *
 * All three keep a real native input underneath — visually hidden via `sr-only`
 * rather than `display:none`, so it stays focusable, keyboard-operable and
 * announced with the right role. The visible box is a sibling that reacts to
 * `peer-*` state. This is what makes tabbing and space/enter work without any
 * key handlers of our own (spec §9).
 */

const boxBase =
  'grid place-items-center shrink-0 border transition-all duration-hover ease-out ' +
  'peer-focus-visible:ring-2 peer-focus-visible:ring-accent-500 peer-focus-visible:ring-offset-2 ' +
  'peer-disabled:opacity-50 peer-disabled:cursor-not-allowed'

export const Checkbox = forwardRef(function Checkbox(
  { label, description, indeterminate = false, className, id, ...props },
  ref
) {
  const generatedId = useId()
  const inputId = id ?? generatedId

  return (
    <label
      htmlFor={inputId}
      className={cn(
        'group flex cursor-pointer items-start gap-2.5',
        props.disabled && 'cursor-not-allowed',
        className
      )}
    >
      <input
        ref={ref}
        id={inputId}
        type="checkbox"
        className="peer sr-only"
        aria-checked={indeterminate ? 'mixed' : undefined}
        {...props}
      />
      <span
        aria-hidden="true"
        className={cn(
          boxBase,
          'mt-0.5 h-[18px] w-[18px] rounded-sm border-neutral-300 bg-white',
          'group-hover:border-neutral-400',
          'peer-checked:border-primary-800 peer-checked:bg-primary-800 peer-checked:text-white',
          // The tick lives inside this span, so it is a *descendant* of the
          // peer's sibling, not a sibling itself — `peer-checked:opacity-100`
          // on the icon would never match. Reveal it from the box instead.
          'peer-checked:[&_svg]:opacity-100',
          indeterminate && 'border-primary-800 bg-primary-800 text-white'
        )}
      >
        {indeterminate ? (
          <Minus size={13} strokeWidth={3} />
        ) : (
          <Check size={13} strokeWidth={3} className="opacity-0 transition-opacity duration-hover" />
        )}
      </span>

      {(label || description) && (
        <span className="min-w-0">
          {label && <span className="block text-sm text-neutral-800">{label}</span>}
          {description && (
            <span className="block text-xs text-neutral-500">{description}</span>
          )}
        </span>
      )}
    </label>
  )
})

export const Radio = forwardRef(function Radio(
  { label, description, className, id, ...props },
  ref
) {
  const generatedId = useId()
  const inputId = id ?? generatedId

  return (
    <label
      htmlFor={inputId}
      className={cn(
        'group flex cursor-pointer items-start gap-2.5',
        props.disabled && 'cursor-not-allowed',
        className
      )}
    >
      <input ref={ref} id={inputId} type="radio" className="peer sr-only" {...props} />
      <span
        aria-hidden="true"
        className={cn(
          boxBase,
          'mt-0.5 h-[18px] w-[18px] rounded-full border-neutral-300 bg-white',
          'group-hover:border-neutral-400',
          'peer-checked:border-primary-800',
          "peer-checked:after:h-2 peer-checked:after:w-2 peer-checked:after:rounded-full",
          'peer-checked:after:bg-primary-800 after:content-[""]'
        )}
      />

      {(label || description) && (
        <span className="min-w-0">
          {label && <span className="block text-sm text-neutral-800">{label}</span>}
          {description && (
            <span className="block text-xs text-neutral-500">{description}</span>
          )}
        </span>
      )}
    </label>
  )
})

/**
 * A switch is for a setting that applies immediately (a room going into
 * Maintenance); a checkbox is for a value submitted with a form. Use the one
 * that matches when the change takes effect.
 */
export const Switch = forwardRef(function Switch(
  { label, description, className, id, ...props },
  ref
) {
  const generatedId = useId()
  const inputId = id ?? generatedId

  return (
    <label
      htmlFor={inputId}
      className={cn(
        'group flex cursor-pointer items-start gap-3',
        props.disabled && 'cursor-not-allowed',
        className
      )}
    >
      <input ref={ref} id={inputId} type="checkbox" role="switch" className="peer sr-only" {...props} />
      <span
        aria-hidden="true"
        className={cn(
          'relative mt-0.5 h-[22px] w-[38px] shrink-0 rounded-full border border-neutral-300 bg-neutral-200',
          'transition-colors duration-state ease-in-out',
          'peer-focus-visible:ring-2 peer-focus-visible:ring-accent-500 peer-focus-visible:ring-offset-2',
          'peer-disabled:opacity-50',
          'peer-checked:border-primary-800 peer-checked:bg-primary-800',
          'after:absolute after:left-[2px] after:top-[2px] after:h-[16px] after:w-[16px]',
          'after:rounded-full after:bg-white after:shadow-sm after:transition-transform after:duration-state',
          'peer-checked:after:translate-x-[16px] after:content-[""]'
        )}
      />

      {(label || description) && (
        <span className="min-w-0">
          {label && <span className="block text-sm text-neutral-800">{label}</span>}
          {description && (
            <span className="block text-xs text-neutral-500">{description}</span>
          )}
        </span>
      )}
    </label>
  )
})

/**
 * Segmented control for a small set of mutually exclusive choices — a status
 * filter, a date granularity. Above about five options use a Select instead;
 * the segments stop being readable.
 *
 * Roving focus is deliberate: the group is one tab stop and arrow keys move
 * between options, which is the expected behaviour for a radiogroup.
 */
export function ToggleGroup({ value, onChange, options = [], size = 'md', className, ariaLabel }) {
  const sizes = {
    sm: 'h-8 text-xs px-2.5',
    md: 'h-9 text-sm px-3',
    lg: 'h-11 text-sm px-4',
  }

  function onKeyDown(event) {
    const index = options.findIndex((option) => option.value === value)
    if (index === -1) return
    let next = null
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % options.length
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp')
      next = (index - 1 + options.length) % options.length
    if (next === null) return
    event.preventDefault()
    onChange(options[next].value)
  }

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className={cn(
        'inline-flex items-center gap-0.5 rounded border border-neutral-300 bg-neutral-100 p-0.5',
        className
      )}
    >
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm font-medium',
              'transition-all duration-hover ease-out disabled:opacity-50',
              sizes[size] ?? sizes.md,
              selected
                ? 'bg-white text-primary-800 shadow-card'
                : 'text-neutral-600 hover:text-neutral-900'
            )}
          >
            {option.icon && <option.icon size={16} aria-hidden="true" />}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

export default Checkbox
