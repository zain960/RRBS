import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { useAuth } from '../context/AuthContext'
import { Spinner } from './ui'

/**
 * Route guard.
 *
 *   Not signed in    -> /login (remembering where they were headed)
 *   Wrong role       -> /403
 *
 * `roles` is a list of role names; omit it to require only authentication.
 * This is a UX guard — the API enforces the same rules server-side.
 */
export default function ProtectedRoute({ roles, children }) {
  const { isAuthenticated, loading, role } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex min-h-screen items-center justify-center gap-3 bg-neutral-50 text-sm text-neutral-500"
      >
        <Spinner />
        Restoring your session…
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (roles && !roles.includes(role)) {
    return <Navigate to="/403" replace />
  }

  return children ?? <Outlet />
}
