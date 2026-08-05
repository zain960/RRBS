import { forwardRef } from 'react'

import cn from '../../lib/cn'
import Field, { controlBase, controlSizes, controlTone, useField } from './Field'

/**
 * Text input with optional prefix/suffix icons.
 *
 * The icons are decorative — padding shifts to make room for them, and they
 * carry `aria-hidden`, because an icon that repeats the label ("mail" next to
 * "Email") is noise in a screen reader.
 *
 * A suffix that is interactive (a currency unit is not, a clear button is)
 * should be passed as `suffix` rather than `iconRight`.
 */
const Input = forwardRef(function Input(
  {
    label,
    hint,
    error,
    required,
    size = 'md',
    iconLeft: IconLeft,
    iconRight: IconRight,
    suffix,
    className,
    fieldClassName,
    id,
    ...props
  },
  ref
) {
  return (
    <Field
      label={label}
      hint={hint}
      error={error}
      required={required}
      htmlFor={id}
      className={fieldClassName}
    >
      <InputControl
        ref={ref}
        size={size}
        iconLeft={IconLeft}
        iconRight={IconRight}
        suffix={suffix}
        className={className}
        {...props}
      />
    </Field>
  )
})

/** The bare control, for the rare caller that supplies its own Field. */
export const InputControl = forwardRef(function InputControl(
  { size = 'md', iconLeft: IconLeft, iconRight: IconRight, suffix, className, ...props },
  ref
) {
  const field = useField()
  const iconPx = size === 'lg' ? 20 : 18

  return (
    <div className="relative flex items-center">
      {IconLeft && (
        <IconLeft
          size={iconPx}
          aria-hidden="true"
          className="pointer-events-none absolute left-3 text-neutral-400"
        />
      )}

      <input
        ref={ref}
        id={field?.id}
        aria-describedby={field?.describedBy}
        aria-invalid={field?.invalid || undefined}
        required={field?.required}
        className={cn(
          controlBase,
          controlSizes[size] ?? controlSizes.md,
          controlTone(field?.invalid),
          IconLeft && (size === 'lg' ? 'pl-11' : 'pl-10'),
          (IconRight || suffix) && (size === 'lg' ? 'pr-11' : 'pr-10'),
          className
        )}
        {...props}
      />

      {IconRight && !suffix && (
        <IconRight
          size={iconPx}
          aria-hidden="true"
          className="pointer-events-none absolute right-3 text-neutral-400"
        />
      )}

      {suffix && (
        <span className="absolute right-3 text-sm text-neutral-500">{suffix}</span>
      )}
    </div>
  )
})

export default Input
