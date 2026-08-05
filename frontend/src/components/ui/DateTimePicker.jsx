import { forwardRef } from 'react'
import { CalendarDays, Clock } from 'lucide-react'

import cn from '../../lib/cn'
import Field, { controlBase, controlSizes, controlTone, useField } from './Field'

/**
 * Date, time and datetime inputs.
 *
 * These wrap the native pickers rather than shipping a calendar widget. A
 * booking is made against a wall-clock moment the guest already has in mind, so
 * the platform picker — which handles locale, 12/24h and touch targets — is
 * both faster to use and cheaper to keep accessible than a custom one.
 *
 * The value is local wall time (`YYYY-MM-DDTHH:mm`); converting to and from UTC
 * for the API is the caller's job via `toLocalInputValue` in lib/format
 * (CLAUDE.md §3 Datetimes).
 *
 * The native indicator is hidden and replaced with a token-coloured icon that
 * opens the picker on click, so these match Input and Select visually.
 */

function PickerBase({ kind, size, className, icon: Icon, ...props }) {
  const field = useField()

  return (
    <div className="relative flex items-center">
      <input
        type={kind}
        id={field?.id}
        aria-describedby={field?.describedBy}
        aria-invalid={field?.invalid || undefined}
        required={field?.required}
        className={cn(
          controlBase,
          controlSizes[size] ?? controlSizes.md,
          controlTone(field?.invalid),
          'pr-10 [&::-webkit-calendar-picker-indicator]:absolute',
          '[&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:h-full',
          '[&::-webkit-calendar-picker-indicator]:w-10 [&::-webkit-calendar-picker-indicator]:cursor-pointer',
          '[&::-webkit-calendar-picker-indicator]:opacity-0',
          className
        )}
        {...props}
      />
      <Icon
        size={18}
        aria-hidden="true"
        className="pointer-events-none absolute right-3 text-neutral-400"
      />
    </div>
  )
}

function make(kind, Icon, displayName) {
  const Component = forwardRef(function Picker(
    { label, hint, error, required, size = 'md', className, fieldClassName, id, ...props },
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
        <PickerBase ref={ref} kind={kind} size={size} icon={Icon} className={className} {...props} />
      </Field>
    )
  })
  Component.displayName = displayName
  return Component
}

export const DatePicker = make('date', CalendarDays, 'DatePicker')
export const TimePicker = make('time', Clock, 'TimePicker')
export const DateTimePicker = make('datetime-local', CalendarDays, 'DateTimePicker')

export default DateTimePicker
