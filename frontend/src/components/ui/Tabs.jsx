import { useRef } from 'react'

import cn from '../../lib/cn'

/**
 * Tab bar.
 *
 * Controlled — the caller owns the active tab, because on several screens it is
 * also a URL parameter and a component-local copy would drift from it.
 *
 * Implements the ARIA tabs pattern: the list is one tab stop, arrow keys move
 * between tabs, Home/End jump to the ends. Panels are the caller's job; pass
 * `panelId` on each tab if you render them.
 *
 * `variant="underline"` for page-level navigation, `"pill"` for filtering a
 * list in place — the visual difference tells the user whether the page is
 * changing or just the data in it.
 */

export default function Tabs({
  tabs,
  value,
  onChange,
  variant = 'underline',
  size = 'md',
  className,
  ariaLabel = 'Tabs',
}) {
  const listRef = useRef(null)

  function onKeyDown(event) {
    const index = tabs.findIndex((tab) => tab.value === value)
    if (index === -1) return

    let next = null
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length
    if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length
    if (event.key === 'Home') next = 0
    if (event.key === 'End') next = tabs.length - 1
    if (next === null) return

    event.preventDefault()
    onChange(tabs[next].value)
    listRef.current?.querySelectorAll('[role="tab"]')[next]?.focus()
  }

  const sizes = {
    sm: 'text-sm h-9',
    md: 'text-sm h-11',
  }

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className={cn(
        'no-scrollbar flex items-center overflow-x-auto',
        variant === 'underline' ? 'gap-1 border-b border-neutral-200' : 'gap-1.5',
        className
      )}
    >
      {tabs.map((tab) => {
        const active = tab.value === value

        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={tab.panelId}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(tab.value)}
            className={cn(
              'inline-flex shrink-0 items-center gap-2 whitespace-nowrap px-3 font-medium',
              'transition-colors duration-hover ease-out',
              sizes[size] ?? sizes.md,
              variant === 'underline' &&
                cn(
                  '-mb-px border-b-2',
                  active
                    ? 'border-primary-800 text-primary-800'
                    : 'border-transparent text-neutral-500 hover:border-neutral-300 hover:text-neutral-800'
                ),
              variant === 'pill' &&
                cn(
                  'rounded-full border',
                  active
                    ? 'border-primary-800 bg-primary-800 text-white'
                    : 'border-neutral-300 bg-white text-neutral-600 hover:border-neutral-400 hover:text-neutral-900'
                )
            )}
          >
            {tab.icon && <tab.icon size={16} aria-hidden="true" />}
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 text-[11px] font-semibold',
                  active && variant === 'pill'
                    ? 'bg-white/20 text-white'
                    : 'bg-neutral-100 text-neutral-600'
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
