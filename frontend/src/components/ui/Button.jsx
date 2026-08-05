import { forwardRef } from 'react'
import { Link } from 'react-router-dom'

import cn from '../../lib/cn'
import Spinner from './Spinner'

/**
 * The only button in the app.
 *
 * Renders as `<button>`, as a router `<Link>` (pass `to`) or as an `<a>` (pass
 * `href`) — a "button" that navigates should still be a link for middle-click,
 * copy-link and screen-reader semantics, so the variant is decoupled from the
 * element.
 *
 * While `loading`, the button is disabled and its label stays in place behind
 * the spinner: the width does not change, so a row of buttons never reflows
 * mid-click.
 */

const VARIANTS = {
  primary:
    'bg-primary-800 text-white shadow-card hover:bg-primary-700 hover:shadow-hover active:bg-primary-900',
  secondary:
    'bg-white text-primary-800 border border-neutral-300 hover:bg-neutral-50 hover:border-neutral-400',
  accent:
    'bg-accent-500 text-white shadow-card hover:bg-accent-600 hover:shadow-hover active:bg-accent-700',
  ghost: 'bg-transparent text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900',
  danger: 'bg-danger text-white shadow-card hover:bg-red-700 hover:shadow-hover active:bg-red-800',
  link: 'bg-transparent text-primary-700 underline-offset-4 hover:underline hover:text-primary-800 shadow-none',
}

const SIZES = {
  sm: 'h-8 gap-1.5 px-3 text-sm rounded-sm',
  md: 'h-10 gap-2 px-4 text-sm rounded',
  lg: 'h-12 gap-2 px-6 text-base rounded-lg',
}

/** Icon-only buttons stay square so they line up in a toolbar. */
const ICON_SIZES = {
  sm: 'h-8 w-8 rounded-sm',
  md: 'h-10 w-10 rounded',
  lg: 'h-12 w-12 rounded-lg',
}

const Button = forwardRef(function Button(
  {
    variant = 'primary',
    size = 'md',
    type = 'button',
    loading = false,
    disabled = false,
    iconLeft: IconLeft,
    iconRight: IconRight,
    iconOnly = false,
    fullWidth = false,
    className,
    children,
    to,
    href,
    ...props
  },
  ref
) {
  const isDisabled = disabled || loading

  const classes = cn(
    'relative inline-flex items-center justify-center font-medium',
    'transition-all duration-hover ease-out',
    'active:scale-[0.98]',
    'disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none',
    VARIANTS[variant] ?? VARIANTS.primary,
    iconOnly ? ICON_SIZES[size] ?? ICON_SIZES.md : SIZES[size] ?? SIZES.md,
    fullWidth && 'w-full',
    variant === 'link' && 'h-auto px-0',
    className
  )

  const iconPx = size === 'lg' ? 20 : 18

  const content = (
    <>
      {loading && (
        <span className="absolute inset-0 grid place-items-center">
          <Spinner className={size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'} />
        </span>
      )}
      <span
        className={cn(
          'inline-flex items-center',
          iconOnly ? '' : 'gap-2',
          loading && 'invisible'
        )}
      >
        {IconLeft && <IconLeft size={iconPx} aria-hidden="true" className="shrink-0" />}
        {!iconOnly && children}
        {IconRight && <IconRight size={iconPx} aria-hidden="true" className="shrink-0" />}
      </span>
    </>
  )

  // A disabled link is not a thing in HTML, so fall back to a real disabled
  // button rather than rendering an anchor that silently does nothing.
  if (to && !isDisabled) {
    return (
      <Link ref={ref} to={to} className={classes} {...props}>
        {content}
      </Link>
    )
  }

  if (href && !isDisabled) {
    return (
      <a ref={ref} href={href} className={classes} {...props}>
        {content}
      </a>
    )
  }

  return (
    <button
      ref={ref}
      type={type}
      className={classes}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      {...props}
    >
      {content}
    </button>
  )
})

export default Button
