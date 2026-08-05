import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'

import cn from '../lib/cn'

const ToastContext = createContext(null)

/** Spec §2: auto-dismiss 4s. */
const DEFAULT_DURATION = 4000

/** Errors stay up longer — they usually carry something to act on. */
const ERROR_DURATION = 6000

/**
 * Transient feedback, top-right (spec §2).
 *
 * The public API is unchanged from the previous implementation
 * (`toast.success` / `.error` / `.warning` / `.info`) so no calling screen had
 * to change when the visuals did.
 *
 * A toast is for confirming something that already happened. Anything the user
 * must act on belongs inline on the form, where it survives the four seconds.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const nextId = useRef(1)
  const timers = useRef(new Map())

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
  }, [])

  const push = useCallback(
    (message, variant = 'info', duration = DEFAULT_DURATION) => {
      const id = nextId.current++
      setToasts((current) => [...current, { id, message, variant }])
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), duration)
      )
      return id
    },
    [dismiss]
  )

  const value = useMemo(
    () => ({
      toasts,
      dismiss,
      toast: {
        success: (message) => push(message, 'success'),
        error: (message) => push(message, 'error', ERROR_DURATION),
        warning: (message) => push(message, 'warning', ERROR_DURATION),
        info: (message) => push(message, 'info'),
      },
    }),
    [toasts, dismiss, push]
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  )
}

const VARIANTS = {
  success: {
    icon: CheckCircle2,
    accent: 'bg-success',
    iconClassName: 'text-success',
  },
  error: {
    icon: XCircle,
    accent: 'bg-danger',
    iconClassName: 'text-danger',
  },
  warning: {
    icon: AlertTriangle,
    accent: 'bg-warning',
    iconClassName: 'text-warning',
  },
  info: {
    icon: Info,
    accent: 'bg-info',
    iconClassName: 'text-info',
  },
}

function ToastViewport({ toasts, onDismiss }) {
  return (
    <div
      // `aria-live` has to exist in the DOM before the first message lands, or
      // the initial toast is never announced — so this container renders even
      // when the list is empty.
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed inset-x-4 top-4 z-[60] flex flex-col items-end gap-2 sm:left-auto sm:right-4 sm:w-full sm:max-w-sm"
    >
      <AnimatePresence initial={false}>
        {toasts.map((toast) => {
          const variant = VARIANTS[toast.variant] ?? VARIANTS.info
          const Icon = variant.icon

          return (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24, transition: { duration: 0.15 } }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              role={toast.variant === 'error' ? 'alert' : 'status'}
              className="pointer-events-auto flex w-full overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-hover"
            >
              {/* A colour stripe rather than a tinted card: the message stays
                  on white, so long error text keeps its contrast ratio. */}
              <span className={cn('w-1 shrink-0', variant.accent)} aria-hidden="true" />

              <div className="flex flex-1 items-start gap-3 px-3.5 py-3">
                <Icon
                  size={18}
                  aria-hidden="true"
                  className={cn('mt-0.5 shrink-0', variant.iconClassName)}
                />
                <p className="flex-1 text-sm leading-relaxed text-neutral-800">{toast.message}</p>
                <button
                  type="button"
                  onClick={() => onDismiss(toast.id)}
                  aria-label="Dismiss notification"
                  className="-m-1 shrink-0 rounded-sm p-1 text-neutral-400 transition-colors duration-hover hover:text-neutral-700"
                >
                  <X size={15} aria-hidden="true" />
                </button>
              </div>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used inside a <ToastProvider>')
  return context.toast
}
