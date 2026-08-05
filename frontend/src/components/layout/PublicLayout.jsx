import { Menu as MenuIcon, UtensilsCrossed, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'

import { useAuth } from '../../context/AuthContext'
import cn from '../../lib/cn'
import { Avatar, Button, DropdownMenu } from '../ui'
import Brand from './Brand'

/**
 * Shell for every guest-facing screen.
 *
 * The header has two appearances. Over a hero image it is transparent with
 * white text; everywhere else — and as soon as the page scrolls — it is solid
 * white with a hairline border. Pages opt in with `transparentHeader`, which
 * only the landing page sets.
 *
 * `sticky` rather than `fixed`, so the header stays in flow and cannot cover the
 * first section on a short page. That means it does *not* overlap what follows
 * on its own — so in transparent mode the content is pulled up by exactly the
 * header's height and the hero rises to meet it. Without that the "transparent"
 * header shows the page's own neutral-50 background instead of the hero, and its
 * white text lands on cream: unreadable. Heroes opting in must leave room at the
 * top (the landing hero carries `pt-24` and up).
 */

/** Header height, matched by the negative pull below. Keep the two in step. */
const HEADER_HEIGHT = 'h-16'

const LINKS = [
  { to: '/rooms', label: 'Rooms' },
  { to: '/menu', label: 'Menu' },
  { to: '/order', label: 'Order food' },
]

export default function PublicLayout({ transparentHeader = false }) {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const { isAuthenticated, user, role, logout } = useAuth()

  useEffect(() => {
    if (!transparentHeader) return undefined
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [transparentHeader])

  // Navigating with the mobile sheet open should close it.
  useEffect(() => setMobileOpen(false), [location.pathname])

  const solid = !transparentHeader || scrolled || mobileOpen
  const tone = solid ? 'dark' : 'light'

  return (
    <div className="flex min-h-screen flex-col bg-neutral-50">
      {/* Keyboard users land here first and can jump the whole nav (spec §9). */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[70] focus:rounded focus:bg-primary-800 focus:px-4 focus:py-2 focus:text-sm focus:text-white"
      >
        Skip to content
      </a>

      <header
        className={cn(
          'sticky top-0 z-40 transition-all duration-state ease-in-out',
          solid
            ? 'border-b border-neutral-200 bg-white/95 backdrop-blur'
            : // Not fully transparent: a scrim that fades out downward. The hero's
              // own gradient is lightest on the right, which is exactly where
              // "Sign in" sits, so white-on-image needs its own guarantee (spec §9).
              'bg-gradient-to-b from-primary-900/50 to-transparent'
        )}
      >
        <div
          className={cn(
            'mx-auto flex max-w-7xl items-center gap-6 px-4 sm:px-6 lg:px-8',
            HEADER_HEIGHT
          )}
        >
          <Brand tone={tone} />

          <nav
            aria-label="Primary"
            className="hidden flex-1 items-center justify-center gap-1 lg:flex"
          >
            {LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  cn(
                    'rounded-sm px-3 py-2 text-sm font-medium transition-colors duration-hover',
                    solid
                      ? isActive
                        ? 'text-primary-800'
                        : 'text-neutral-600 hover:text-neutral-900'
                      : isActive
                        ? 'text-white'
                        : 'text-white/80 hover:text-white'
                  )
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2 lg:ml-0">
            {isAuthenticated ? (
              <DropdownMenu
                align="right"
                trigger={({ toggle, ref }) => (
                  <button
                    ref={ref}
                    type="button"
                    onClick={toggle}
                    className={cn(
                      'flex items-center gap-2 rounded-full py-1 pl-1 pr-2.5 transition-colors duration-hover',
                      solid ? 'hover:bg-neutral-100' : 'hover:bg-white/10'
                    )}
                  >
                    <Avatar name={user?.fullName} size="sm" />
                    <span
                      className={cn(
                        'hidden max-w-[10rem] truncate text-sm font-medium sm:block',
                        solid ? 'text-neutral-700' : 'text-white'
                      )}
                    >
                      {user?.fullName}
                    </span>
                  </button>
                )}
                items={[
                  { label: 'My bookings', to: '/my-bookings' },
                  { label: 'My orders', to: '/my-orders' },
                  { label: 'Account', to: '/account' },
                  // Staff get a way back to the desk they actually work at.
                  ...(role && role !== 'Customer'
                    ? [{ label: 'Back office', to: '/admin', separatorBefore: true }]
                    : []),
                  { label: 'Sign out', onSelect: logout, danger: true, separatorBefore: true },
                ]}
              />
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  to="/login"
                  className={cn('hidden sm:inline-flex', !solid && 'text-white hover:bg-white/10')}
                >
                  Sign in
                </Button>
                <Button variant="accent" size="sm" to="/book" className="hidden sm:inline-flex">
                  Book a room
                </Button>
              </>
            )}

            <button
              type="button"
              onClick={() => setMobileOpen((open) => !open)}
              aria-expanded={mobileOpen}
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              className={cn(
                'grid h-9 w-9 place-items-center rounded-sm transition-colors duration-hover lg:hidden',
                solid ? 'text-neutral-700 hover:bg-neutral-100' : 'text-white hover:bg-white/10'
              )}
            >
              {mobileOpen ? (
                <X size={20} aria-hidden="true" />
              ) : (
                <MenuIcon size={20} aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="border-t border-neutral-200 bg-white lg:hidden">
            <nav aria-label="Mobile" className="mx-auto max-w-7xl space-y-1 px-4 py-3 sm:px-6">
              {LINKS.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={({ isActive }) =>
                    cn(
                      'block rounded px-3 py-2.5 text-sm font-medium',
                      isActive
                        ? 'bg-neutral-100 text-primary-800'
                        : 'text-neutral-600 hover:bg-neutral-50'
                    )
                  }
                >
                  {link.label}
                </NavLink>
              ))}
              {!isAuthenticated && (
                <div className="flex gap-2 pt-2">
                  <Button variant="secondary" size="sm" to="/login" fullWidth>
                    Sign in
                  </Button>
                  <Button variant="accent" size="sm" to="/book" fullWidth>
                    Book a room
                  </Button>
                </div>
              )}
            </nav>
          </div>
        )}
      </header>

      <main id="main" className={cn('flex-1', transparentHeader && '-mt-16')}>
        <Outlet />
      </main>

      <SiteFooter />
    </div>
  )
}

const FOOTER_COLUMNS = [
  {
    title: 'Stay',
    links: [
      { label: 'Browse rooms', to: '/rooms' },
      { label: 'Book a room', to: '/book' },
      { label: 'My bookings', to: '/my-bookings' },
    ],
  },
  {
    title: 'Eat',
    links: [
      { label: 'Full menu', to: '/menu' },
      { label: 'Order food', to: '/order' },
      { label: 'My orders', to: '/my-orders' },
    ],
  },
  {
    title: 'Contact',
    links: [
      { label: 'reservations@rrbs.local', href: 'mailto:reservations@rrbs.local' },
      { label: '+92 000 0000000', href: 'tel:+920000000000' },
      { label: 'Front desk, open 24 hours', href: null },
    ],
  },
]

function SiteFooter() {
  return (
    <footer className="border-t border-neutral-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 lg:grid-cols-4">
          <div className="col-span-2 lg:col-span-1">
            <Brand size="lg" />
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-neutral-500">
              Rooms by the hour, the day or the night — with the kitchen open to guests and
              neighbours alike. One bill at checkout.
            </p>
          </div>

          {FOOTER_COLUMNS.map((column) => (
            <div key={column.title}>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                {column.title}
              </h2>
              <ul className="mt-3 space-y-2">
                {column.links.map((link) => (
                  <li key={link.label}>
                    {link.to ? (
                      <Link
                        to={link.to}
                        className="rounded-sm text-sm text-neutral-600 transition-colors duration-hover hover:text-primary-800"
                      >
                        {link.label}
                      </Link>
                    ) : link.href ? (
                      <a
                        href={link.href}
                        className="rounded-sm text-sm text-neutral-600 transition-colors duration-hover hover:text-primary-800"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <span className="text-sm text-neutral-500">{link.label}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-neutral-200 pt-6 sm:flex-row sm:items-center">
          <p className="flex items-center gap-2 text-xs text-neutral-400">
            <UtensilsCrossed size={14} aria-hidden="true" />
            © {new Date().getFullYear()} RRBS. All rights reserved.
          </p>
          <p className="text-xs text-neutral-400">
            Rates shown include applicable taxes at checkout.
          </p>
        </div>
      </div>
    </footer>
  )
}
