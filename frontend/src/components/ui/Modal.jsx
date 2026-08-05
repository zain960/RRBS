import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useId } from 'react'
import { createPortal } from 'react-dom'

import cn from '../../lib/cn'
import useFocusTrap from '../../lib/useFocusTrap'
import Button from './Button'

/**
 * Centred dialog.
 *
 * Rendered through a portal on `document.body` so a modal opened from deep
 * inside a card is never clipped by an ancestor's `overflow` or stacking
 * context — the bug that makes hand-rolled modals mysteriously disappear.
 *
 * Backdrop fades, card scales 0.95 → 1 (spec §6). Focus is trapped and Escape
 * closes, via useFocusTrap.
 *
 * `closeOnBackdrop` should be false for a form with unsaved input — losing a
 * half-typed booking to a stray click is worse than an extra button press.
 */

const SIZES = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
}

export default function Modal({
  open,
  onClose,
  title,
  description,
  size = 'md',
  footer,
  closeOnBackdrop = true,
  children,
  className,
}) {
  const titleId = useId()
  const descriptionId = useId()
  const containerRef = useFocusTrap(open, onClose)

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="fixed inset-0 bg-primary-900/50 backdrop-blur-[2px]"
            onMouseDown={closeOnBackdrop ? onClose : undefined}
            aria-hidden="true"
          />

          <div className="relative flex min-h-full items-start justify-center p-4 sm:items-center sm:p-6">
            <motion.div
              ref={containerRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={title ? titleId : undefined}
              aria-describedby={description ? descriptionId : undefined}
              tabIndex={-1}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className={cn(
                'w-full rounded-xl bg-white shadow-modal outline-none',
                SIZES[size] ?? SIZES.md,
                className
              )}
            >
              {(title || description) && (
                <div className="flex items-start justify-between gap-4 border-b border-neutral-200 px-6 py-4">
                  <div className="min-w-0">
                    {title && (
                      <h2 id={titleId} className="text-lg font-semibold text-neutral-900">
                        {title}
                      </h2>
                    )}
                    {description && (
                      <p id={descriptionId} className="mt-1 text-sm text-neutral-500">
                        {description}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    iconOnly
                    iconLeft={X}
                    onClick={onClose}
                    aria-label="Close dialog"
                    className="-mr-1.5 -mt-0.5 shrink-0"
                  />
                </div>
              )}

              <div className="px-6 py-5">{children}</div>

              {footer && (
                <div className="flex items-center justify-end gap-2 border-t border-neutral-200 bg-neutral-50/60 px-6 py-4">
                  {footer}
                </div>
              )}
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  )
}

/**
 * Confirmation before something destructive or irreversible — cancelling a
 * booking, deleting a room type.
 *
 * `tone="danger"` is the default because that is what confirmation is usually
 * for; pass `tone="primary"` for a merely significant action (marking a
 * no-show) so red keeps its meaning.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  loading = false,
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      closeOnBackdrop={!loading}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm leading-relaxed text-neutral-600">{message}</p>
    </Modal>
  )
}
