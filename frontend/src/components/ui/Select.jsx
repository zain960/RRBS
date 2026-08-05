import { forwardRef } from 'react'
import { ChevronDown } from 'lucide-react'

import cn from '../../lib/cn'
import Field, { controlBase, controlSizes, controlTone, useField } from './Field'

/**
 * Native `<select>` with the browser arrow replaced by a token-coloured one.
 *
 * Native on purpose: on a phone this opens the platform picker, which beats any
 * custom listbox for reachability, and it is keyboard-accessible for free
 * (spec §9). Anything needing search or multi-select should use DropdownMenu.
 *
 * `options` is `[{ value, label, disabled? }]`; `placeholder` renders a
 * disabled first option so the empty state is visible but unselectable.
 */
const Select = forwardRef(function Select(
  {
    label,
    hint,
    error,
    required,
    size = 'md',
    options = [],
    placeholder,
    className,
    fieldClassName,
    id,
    children,
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
      <SelectControl
        ref={ref}
        size={size}
        options={options}
        placeholder={placeholder}
        className={className}
        {...props}
      >
        {children}
      </SelectControl>
    </Field>
  )
})

export const SelectControl = forwardRef(function SelectControl(
  { size = 'md', options = [], placeholder, className, children, ...props },
  ref
) {
  const field = useField()

  return (
    <div className="relative flex items-center">
      <select
        ref={ref}
        id={field?.id}
        aria-describedby={field?.describedBy}
        aria-invalid={field?.invalid || undefined}
        required={field?.required}
        className={cn(
          controlBase,
          controlSizes[size] ?? controlSizes.md,
          controlTone(field?.invalid),
          'cursor-pointer appearance-none pr-9',
          className
        )}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
        {children}
      </select>

      <ChevronDown
        size={18}
        aria-hidden="true"
        className="pointer-events-none absolute right-3 text-neutral-400"
      />
    </div>
  )
})

export default Select
