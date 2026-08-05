import { useAuth } from '../context/AuthContext'

/**
 * Conditionally renders UI for specific roles — for hiding controls the current
 * user may not use (e.g. a "Manage roles" button for anyone but Super Admin).
 *
 *   <RoleGate roles={['Super Admin', 'Manager']}>
 *     <button>Edit rates</button>
 *   </RoleGate>
 *
 * Presentation only. Hiding a control is not access control: the endpoint
 * behind it must still be guarded by requireRole() on the server.
 */
export default function RoleGate({ roles, children, fallback = null }) {
  const { role, isAuthenticated } = useAuth()

  if (!isAuthenticated) return fallback
  if (roles && !roles.includes(role)) return fallback

  return children
}
