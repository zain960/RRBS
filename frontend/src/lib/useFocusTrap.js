import { useEffect, useRef } from 'react'

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

/**
 * Traps keyboard focus inside an overlay while it is open, and hands focus back
 * to whatever opened it on close.
 *
 * Without this, tabbing out of a modal lands on the page behind it — the dialog
 * is still visually on top, so a keyboard user is typing into something they
 * cannot see (spec §9). Escape closes, which is the other half of the contract.
 *
 * Returns a ref to attach to the overlay container.
 */
export default function useFocusTrap(open, onClose) {
  const containerRef = useRef(null)
  const previouslyFocused = useRef(null)

  useEffect(() => {
    if (!open) return undefined

    previouslyFocused.current = document.activeElement

    // Focus the first control, falling back to the container itself so the
    // dialog is always the active element even when it holds no controls.
    const container = containerRef.current
    const first = container?.querySelector(FOCUSABLE)
    ;(first ?? container)?.focus({ preventScroll: true })

    function onKeyDown(event) {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose?.()
        return
      }

      if (event.key !== 'Tab') return

      const items = Array.from(container?.querySelectorAll(FOCUSABLE) ?? []).filter(
        (element) => element.offsetParent !== null
      )
      if (items.length === 0) {
        event.preventDefault()
        return
      }

      const firstItem = items[0]
      const lastItem = items[items.length - 1]

      // Wrap around at both ends rather than escaping to the page behind.
      if (event.shiftKey && document.activeElement === firstItem) {
        event.preventDefault()
        lastItem.focus()
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault()
        firstItem.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown, true)

    // The page behind must not scroll under the overlay.
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      document.body.style.overflow = previousOverflow
      previouslyFocused.current?.focus?.({ preventScroll: true })
    }
  }, [open, onClose])

  return containerRef
}
