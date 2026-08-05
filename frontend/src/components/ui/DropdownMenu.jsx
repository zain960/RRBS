import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import cn from '../../lib/cn'

/**
 * Dropdown menu.
 *
 * `trigger` is a render prop receiving `{ open, toggle, ref }` so the caller
 * supplies its own button — the menu should not dictate what opens it.
 *
 * Closes on outside click, on Escape, and on choosing an item. Escape returns
 * focus to the trigger; without that, dismissing a menu with the keyboard drops
 * focus to the top of the document (spec §9).
 *
 * Items: `[{ label, icon?, onSelect?, to?, danger?, disabled?, separatorBefore? }]`
 */
export default function DropdownMenu({
  trigger,
  items = [],
  align = 'right',
  width = 'w-56',
  className,
}) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)
  const triggerRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined

    function onPointerDown(event) {
      if (!containerRef.current?.contains(event.target)) setOpen(false)
    }

    function onKeyDown(event) {
      if (event.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {trigger({ open, toggle: () => setOpen((value) => !value), ref: triggerRef })}

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, scale: 0.96, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -4 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className={cn(
              'absolute z-40 mt-1.5 overflow-hidden rounded-lg border border-neutral-200 bg-white p-1 shadow-hover',
              width,
              align === 'right' ? 'right-0 origin-top-right' : 'left-0 origin-top-left'
            )}
          >
            {items.map((item, index) => {
              if (item.separatorBefore && index > 0) {
                return (
                  <div key={`sep-${index}`}>
                    <div className="my-1 h-px bg-neutral-200" role="separator" />
                    <MenuItem item={item} onDone={() => setOpen(false)} />
                  </div>
                )
              }
              return <MenuItem key={item.label} item={item} onDone={() => setOpen(false)} />
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function MenuItem({ item, onDone }) {
  const classes = cn(
    'flex w-full items-center gap-2.5 rounded-sm px-2.5 py-2 text-left text-sm',
    'transition-colors duration-hover',
    item.disabled && 'pointer-events-none opacity-50',
    item.danger
      ? 'text-danger hover:bg-red-50'
      : 'text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900'
  )

  const content = (
    <>
      {item.icon && <item.icon size={16} aria-hidden="true" className="shrink-0" />}
      <span className="flex-1 truncate">{item.label}</span>
      {item.shortcut && (
        <span className="text-xs text-neutral-400" aria-hidden="true">
          {item.shortcut}
        </span>
      )}
    </>
  )

  // A menu entry that navigates stays a real link, so middle-click and
  // "copy link address" work the way they do everywhere else.
  if (item.to) {
    return (
      <Link
        role="menuitem"
        to={item.to}
        className={classes}
        onClick={() => {
          onDone()
          item.onSelect?.()
        }}
      >
        {content}
      </Link>
    )
  }

  return (
    <button
      type="button"
      role="menuitem"
      disabled={item.disabled}
      className={classes}
      onClick={() => {
        onDone()
        item.onSelect?.()
      }}
    >
      {content}
    </button>
  )
}
