import { forwardRef } from 'react'

import cn from '../../lib/cn'
import Field, { controlBase, controlTone, useField } from './Field'

/**
 * Multi-line text. Height is set by `rows`, and resizing is vertical-only —
 * a horizontally resizable textarea breaks the column it sits in.
 */
const Textarea = forwardRef(function Textarea(
  { label, hint, error, required, rows = 4, className, fieldClassName, id, maxLength, value, ...props },
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
      <TextareaControl
        ref={ref}
        rows={rows}
        className={className}
        maxLength={maxLength}
        value={value}
        {...props}
      />
      {maxLength && (
        <p className="text-right text-xs text-neutral-400">
          {String(value ?? '').length} / {maxLength}
        </p>
      )}
    </Field>
  )
})

export const TextareaControl = forwardRef(function TextareaControl(
  { rows = 4, className, ...props },
  ref
) {
  const field = useField()

  return (
    <textarea
      ref={ref}
      id={field?.id}
      rows={rows}
      aria-describedby={field?.describedBy}
      aria-invalid={field?.invalid || undefined}
      required={field?.required}
      className={cn(
        controlBase,
        controlTone(field?.invalid),
        'resize-y px-3 py-2.5 text-sm leading-relaxed',
        className
      )}
      {...props}
    />
  )
})

export default Textarea
