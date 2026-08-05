import { AnimatePresence, motion } from 'framer-motion'
import { Bell, LogOut, Menu as MenuIcon, PanelLeftClose, Search, User, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'

import { useAuth } from '../../context/AuthContext'
import cn from '../../lib/cn'
import { Avatar, Button, DropdownMenu, InputControl } from '../ui'
import Brand from './Brand'
import { findNavItem, navForRole } from './adminNav'

/**
 * Back-office shell: fixed sidebar, top bar, content well.
 *
 * Three responsive modes, because a back office is used on all three:
 * - `xl` and up — sidebar always visible, 240px.
 * - `lg` to `xl` — sidebar collapses to icons; labels appear in a tooltip-ish
 *   title, so a manager on a 1280px laptop keeps the whole content width.
 * - below `lg` — sidebar is off-canvas behind a hamburger (spec §3).
 *
 * The collapsed preference is deliberately not persisted: it follows the
 * viewport, so resizing a window never leaves the layout in a state the user
 * cannot explain.
 */
export default function AdminLayout() {
  const { user, role, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 1280 : false
  )

  useEffect(() => {
    const onResize = () => setCollapsed(window.innerWidth < 1280)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => setMobileOpen(false), [location.pathname])

  const sections = navForRole(role)
  const current = findNavItem(location.pathname)

  return (
    <div className="min-h-screen bg-neutral-50">
      <a
        href="#admin-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[70] focus:rounded focus:bg-primary-800 focus:px-4 focus:py-2 focus:text-sm focus:text-white"
      >
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-primary-900/40 bg-primary-800 lg:flex',
          'transition-[width] duration-state ease-in-out',
          collapsed ? 'w-[72px]' : 'w-60'
        )}
      >
        <SidebarContent
          sections={sections}
          collapsed={collapsed}
          user={user}
          role={role}
          onLogout={logout}
          onToggleCollapse={() => setCollapsed((value) => !value)}
        />
      </aside>

      {/* Mobile off-canvas */}
      <AnimatePresence>
        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 bg-primary-900/60"
              onMouseDown={() => setMobileOpen(false)}
              aria-hidden="true"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
              className="absolute inset-y-0 left-0 flex w-64 flex-col bg-primary-800"
              aria-label="Back-office navigation"
            >
              <SidebarContent
                sections={sections}
                collapsed={false}
                user={user}
                role={role}
                onLogout={logout}
                onClose={() => setMobileOpen(false)}
              />
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      <div className={cn('transition-[padding] duration-state', collapsed ? 'lg:pl-[72px]' : 'lg:pl-60')}>
        <header className="sticky top-0 z-20 border-b border-neutral-200 bg-white/95 backdrop-blur">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-sm text-neutral-600 transition-colors duration-hover hover:bg-neutral-100 lg:hidden"
            >
              <MenuIcon size={20} aria-hidden="true" />
            </button>

            <div className="min-w-0 flex-1">
              <h1 className="truncate text-base font-semibold text-neutral-900">
                {current?.label ?? 'Back office'}
              </h1>
              {current?.section && (
                <p className="truncate text-xs text-neutral-400">{current.section}</p>
              )}
            </div>

            {/* Search jumps to the list screens; there is no global search index
                in this phase, so it filters bookings by reference. */}
            <form
              role="search"
              onSubmit={(event) => {
                event.preventDefault()
                const query = new FormData(event.currentTarget).get('q')?.toString().trim()
                if (query) navigate(`/admin/bookings?q=${encodeURIComponent(query)}`)
              }}
              className="hidden w-64 md:block"
            >
              <label htmlFor="admin-search" className="sr-only">
                Search bookings
              </label>
              <InputControl
                id="admin-search"
                name="q"
                type="search"
                size="sm"
                placeholder="Search bookings…"
                iconLeft={Search}
              />
            </form>

            <Button
              variant="ghost"
              size="sm"
              iconOnly
              iconLeft={Bell}
              to="/admin/bookings"
              aria-label="Notifications"
              className="shrink-0 text-neutral-500"
            />

            <DropdownMenu
              align="right"
              trigger={({ toggle, ref }) => (
                <button
                  ref={ref}
                  type="button"
                  onClick={toggle}
                  className="flex shrink-0 items-center gap-2 rounded-full py-1 pl-1 pr-2 transition-colors duration-hover hover:bg-neutral-100"
                >
                  <Avatar name={user?.fullName} size="sm" />
                  <span className="hidden max-w-[9rem] truncate text-sm font-medium text-neutral-700 sm:block">
                    {user?.fullName}
                  </span>
                </button>
              )}
              items={[
                { label: 'Guest site', to: '/', icon: User },
                { label: 'Sign out', onSelect: logout, icon: LogOut, danger: true, separatorBefore: true },
              ]}
            />
          </div>
        </header>

        <main id="admin-main" className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function SidebarContent({ sections, collapsed, user, role, onLogout, onClose, onToggleCollapse }) {
  return (
    <>
      <div
        className={cn(
          'flex h-16 shrink-0 items-center border-b border-white/10',
          collapsed ? 'justify-center px-2' : 'justify-between px-4'
        )}
      >
        {collapsed ? (
          <span className="font-display text-lg font-semibold text-white">R</span>
        ) : (
          <Brand to="/admin" tone="light" />
        )}

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="grid h-8 w-8 place-items-center rounded-sm text-white/60 transition-colors duration-hover hover:bg-white/10 hover:text-white"
          >
            <X size={18} aria-hidden="true" />
          </button>
        )}

        {onToggleCollapse && !collapsed && (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label="Collapse navigation"
            className="grid h-8 w-8 place-items-center rounded-sm text-white/50 transition-colors duration-hover hover:bg-white/10 hover:text-white"
          >
            <PanelLeftClose size={18} aria-hidden="true" />
          </button>
        )}
      </div>

      <nav
        aria-label="Back office"
        className={cn('no-scrollbar flex-1 space-y-5 overflow-y-auto py-4', collapsed ? 'px-2' : 'px-3')}
      >
        {sections.map((section) => (
          <div key={section.title}>
            {!collapsed && (
              <p className="px-2.5 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/40">
                {section.title}
              </p>
            )}
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    title={collapsed ? item.label : undefined}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 rounded text-sm font-medium',
                        'transition-colors duration-hover ease-out',
                        collapsed ? 'justify-center px-2 py-2.5' : 'px-2.5 py-2',
                        isActive
                          ? 'bg-white/15 text-white'
                          : 'text-white/65 hover:bg-white/10 hover:text-white'
                      )
                    }
                  >
                    <item.icon size={20} aria-hidden="true" className="shrink-0" />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                    {collapsed && <span className="sr-only">{item.label}</span>}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className={cn('shrink-0 border-t border-white/10 p-3', collapsed && 'px-2')}>
        {collapsed ? (
          <button
            type="button"
            onClick={onLogout}
            aria-label="Sign out"
            className="grid h-10 w-full place-items-center rounded text-white/60 transition-colors duration-hover hover:bg-white/10 hover:text-white"
          >
            <LogOut size={18} aria-hidden="true" />
          </button>
        ) : (
          <div className="flex items-center gap-2.5 rounded bg-white/5 p-2.5">
            <Avatar name={user?.fullName} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{user?.fullName}</p>
              <p className="truncate text-xs text-white/50">{role}</p>
            </div>
            <button
              type="button"
              onClick={onLogout}
              aria-label="Sign out"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-sm text-white/50 transition-colors duration-hover hover:bg-white/10 hover:text-white"
            >
              <LogOut size={16} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </>
  )
}
