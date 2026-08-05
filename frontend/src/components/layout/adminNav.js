import {
  BadgePercent,
  BarChart3,
  Bed,
  BookOpen,
  CalendarCheck,
  ChefHat,
  CreditCard,
  LayoutDashboard,
  ReceiptText,
  Settings2,
  Sofa,
  Tags,
  UsersRound,
  Utensils,
} from 'lucide-react'

/**
 * The back-office navigation, grouped by the job being done rather than by the
 * table being edited — a receptionist thinks "front desk", not "bookings table".
 *
 * `roles` mirrors the route guards in App.jsx. This is a *display* filter only:
 * hiding a link the user cannot use keeps the sidebar honest, but the route
 * still re-checks and the API enforces it independently (CLAUDE.md §4).
 */

const SETUP_ROLES = ['Super Admin', 'Manager']
const FRONT_DESK_ROLES = ['Super Admin', 'Manager', 'Receptionist']
const FINANCE_ROLES = ['Super Admin', 'Manager', 'Accountant']

export const NAV_SECTIONS = [
  {
    title: 'Overview',
    items: [
      {
        to: '/admin/dashboard',
        label: 'Dashboard',
        icon: LayoutDashboard,
        roles: ['Super Admin', 'Manager', 'Receptionist', 'Accountant'],
      },
    ],
  },
  {
    title: 'Front desk',
    items: [
      { to: '/admin/bookings', label: 'Bookings', icon: CalendarCheck, roles: FRONT_DESK_ROLES },
      { to: '/admin/customers', label: 'Customers', icon: UsersRound, roles: FRONT_DESK_ROLES },
    ],
  },
  {
    title: 'Restaurant',
    items: [
      {
        to: '/admin/orders',
        label: 'Orders',
        icon: ReceiptText,
        roles: [...FRONT_DESK_ROLES, 'Waiter', 'Kitchen Staff'],
      },
      {
        to: '/admin/kitchen',
        label: 'Kitchen',
        icon: ChefHat,
        roles: ['Super Admin', 'Manager', 'Kitchen Staff'],
      },
      { to: '/admin/tables', label: 'Tables', icon: Sofa, roles: [...SETUP_ROLES, 'Waiter'] },
    ],
  },
  {
    title: 'Property',
    items: [
      { to: '/admin/rooms', label: 'Rooms', icon: Bed, roles: SETUP_ROLES },
      { to: '/admin/room-types', label: 'Room types', icon: BookOpen, roles: SETUP_ROLES },
    ],
  },
  {
    title: 'Menu',
    items: [
      { to: '/admin/menu', label: 'Dishes', icon: Utensils, roles: SETUP_ROLES },
      { to: '/admin/categories', label: 'Categories', icon: Tags, roles: SETUP_ROLES },
    ],
  },
  {
    title: 'Finance',
    items: [
      { to: '/admin/payments', label: 'Payments', icon: CreditCard, roles: FINANCE_ROLES },
      { to: '/admin/coupons', label: 'Coupons', icon: BadgePercent, roles: SETUP_ROLES },
      { to: '/admin/reports', label: 'Reports', icon: BarChart3, roles: FINANCE_ROLES },
    ],
  },
  {
    title: 'Settings',
    items: [
      { to: '/admin/settings/tax', label: 'Tax rates', icon: Settings2, roles: ['Super Admin'] },
    ],
  },
]

/** Sections with no visible item for this role drop out entirely. */
export function navForRole(role) {
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => !item.roles || item.roles.includes(role)),
  })).filter((section) => section.items.length > 0)
}

/**
 * Flat lookup for the top bar's page title and breadcrumb trail.
 * Longest match wins, so /admin/settings/tax does not resolve to /admin/settings.
 */
export function findNavItem(pathname) {
  let best = null
  for (const section of NAV_SECTIONS) {
    for (const item of section.items) {
      if (pathname === item.to || pathname.startsWith(`${item.to}/`)) {
        if (!best || item.to.length > best.to.length) best = { ...item, section: section.title }
      }
    }
  }
  return best
}
