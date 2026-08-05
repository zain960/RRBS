import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useId } from 'react'
import { createPortal } from 'react-dom'

import cn from '../../lib/cn'
import useFocusTrap from '../../lib/useFocusTrap'
import Button from './Button'

/**
 * Side sheet for detail views.
 *
 * Chosen over a modal for "show me this record" because the list stays visible
 * behind it — a receptionist scanning bookings keeps their place in the table
 * while reading one of them.
 *
 * `side="bottom"` is the mobile filter sheet (spec §8): the same component, so
 * a filter panel does not need its own focus and scroll handling.
 */

const SIDES = {
  right: {
    container: 'inset-y-0 right-0 h-full w-full max-w-md',
    rounded: 'sm:rounded-l-xl',
    initial: { x: '100%' },
    animate: { x: 0 },
    exit: { x: '100%' },
  },
  left: {
    container: 'inset-y-0 left-0 h-full w-full max-w-md',
    rounded: 'sm:rounded-r-xl',
    initial: { x: '-100%' },
    animate: { x: 0 },
    exit: { x: '-100%' },
  },
  bottom: {
    container: 'inset-x-0 bottom-0 max-h-[85vh] w-full',
    rounded: 'rounded-t-2xl',
    initial: { y: '100%' },
    animate: { y: 0 },
    exit: { y: '100%' },
  },
}

export default function Drawer({
  open,
  onClose,
  title,
  description,
  side = 'right',
  footer,
  children,
  className,
}) {
  const titleId = useId()
  const config = SIDES[side] ?? SIDES.right
  const containerRef = useFocusTrap(open, onClose)

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="absolute inset-0 bg-primary-900/50 backdrop-blur-[2px]"
            onMouseDown={onClose}
            aria-hidden="true"
          />

          <motion.div
            ref={containerRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            tabIndex={-1}
            initial={config.initial}
            animate={config.animate}
            exit={config.exit}
            transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
            className={cn(
              'absolute flex flex-col bg-white shadow-modal outline-none',
              config.container,
              config.rounded,
              className
            )}
          >
            {side === 'bottom' && (
              // Grab handle: the affordance that says this sheet is dismissible.
              <div className="flex justify-center pt-3" aria-hidden="true">
                <span className="h-1 w-10 rounded-full bg-neutral-300" />
              </div>
            )}

            {(title || description) && (
              <div className="flex items-start justify-between gap-4 border-b border-neutral-200 px-5 py-4">
                <div className="min-w-0">
                  {title && (
                    <h2 id={titleId} className="text-base font-semibold text-neutral-900">
                      {title}
                    </h2>
                  )}
                  {description && (
                    <p className="mt-0.5 text-sm text-neutral-500">{description}</p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  iconOnly
                  iconLeft={X}
                  onClick={onClose}
                  aria-label="Close panel"
                  className="-mr-1.5 -mt-0.5 shrink-0"
                />
              </div>
            )}

            <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>

            {footer && (
              <div className="flex items-center justify-end gap-2 border-t border-neutral-200 bg-neutral-50/60 px-5 py-4">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  )
}
