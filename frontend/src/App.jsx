import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'

import AdminLayout from './components/layout/AdminLayout'
import PublicLayout from './components/layout/PublicLayout'
import ProtectedRoute from './components/ProtectedRoute'
import { AuthProvider, useAuth } from './context/AuthContext'
import { CartProvider } from './context/CartContext'
import { ToastProvider } from './context/ToastContext'
import Account from './pages/Account'
import Book from './pages/Book'
import Forbidden from './pages/Forbidden'
import Landing from './pages/Landing'
import Login from './pages/Login'
import MenuPage from './pages/Menu'
import MyBookings from './pages/MyBookings'
import MyOrders from './pages/MyOrders'
import NotFound from './pages/NotFound'
import Order from './pages/Order'
import Register from './pages/Register'
import RoomsBrowse from './pages/Rooms'
import AdminBookings from './pages/admin/Bookings'
import BookingDetail from './pages/admin/BookingDetail'
import Categories from './pages/admin/Categories'
import Coupons from './pages/admin/Coupons'
import Customers from './pages/admin/Customers'
import AdminDashboard from './pages/admin/Dashboard'
import Kitchen from './pages/admin/Kitchen'
import Menu from './pages/admin/Menu'
import Orders from './pages/admin/Orders'
import Payments from './pages/admin/Payments'
import Reports from './pages/admin/Reports'
import Rooms from './pages/admin/Rooms'
import RoomTypes from './pages/admin/RoomTypes'
import Tables from './pages/admin/Tables'
import TaxSettings from './pages/admin/TaxSettings'

// Property and menu setup is Super Admin / Manager.
const SETUP_ROLES = ['Super Admin', 'Manager']

// Front-desk operations also include Receptionist (SRS §3).
const FRONT_DESK_ROLES = ['Super Admin', 'Manager', 'Receptionist']

// Waiters work the floor plan but not the rest of the back office (SRS §3).
const FLOOR_ROLES = [...SETUP_ROLES, 'Waiter']

// Everyone who works an order: the kitchen cooks it, waiters serve it, the
// front desk dispatches and bills it (SRS §4.5).
const ORDER_ROLES = [...FRONT_DESK_ROLES, 'Waiter', 'Kitchen Staff']

// The kitchen queue is the kitchen's screen; managers oversee it.
const KITCHEN_ROLES = ['Super Admin', 'Manager', 'Kitchen Staff']

// Financial reports: Manager, Accountant and Super Admin only (SRS §5.4).
const FINANCE_ROLES = ['Super Admin', 'Manager', 'Accountant']

// The dashboard carries today's revenue, so it stays with the roles that may
// see money — the front desk included, but not the kitchen or waiters (SRS §4.10).
const DASHBOARD_ROLES = ['Super Admin', 'Manager', 'Receptionist', 'Accountant']

// System-level settings are Super Admin only (SRS §3).
const SYSTEM_ROLES = ['Super Admin']

// The outer /admin gate is the union of every screen below it; each route
// re-checks its own roles, and the API enforces all of this independently.
const ADMIN_ROLES = [
  ...new Set([...FRONT_DESK_ROLES, ...FLOOR_ROLES, ...ORDER_ROLES, ...FINANCE_ROLES]),
]

/**
 * The first screen each role can actually use. The dashboard is the landing
 * page for everyone who may see it (SRS §4.10); the kitchen and waiters have no
 * access to revenue figures, so they land on their own working screens.
 */
function AdminHome() {
  const { role } = useAuth()
  if (role === 'Kitchen Staff') return <Navigate to="/admin/kitchen" replace />
  if (role === 'Waiter') return <Navigate to="/admin/orders" replace />
  return <Navigate to="/admin/dashboard" replace />
}

/**
 * Scrolls to the top on navigation.
 *
 * Without this, following a room card from halfway down /rooms opens /book
 * already scrolled past its first step — the browser preserves scroll position
 * across a client-side route change.
 */
function ScrollToTop() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname])

  return null
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <CartProvider>
          <ScrollToTop />
          <Routes>
            {/* Full-bleed screens: these own their whole viewport and take
                neither the public header nor the admin shell. */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/403" element={<Forbidden />} />
            <Route path="/404" element={<NotFound />} />

            {/* Public: the landing page, room browsing and the menu are all
                open — an account is only needed to complete a booking or an
                order (SRS §4.3, §4.5). The landing page is the only screen
                whose header sits over a hero image. */}
            <Route element={<PublicLayout transparentHeader />}>
              <Route path="/" element={<Landing />} />
            </Route>

            <Route element={<PublicLayout />}>
              <Route path="/rooms" element={<RoomsBrowse />} />
              <Route path="/menu" element={<MenuPage />} />
              <Route path="/book" element={<Book />} />
              <Route path="/order" element={<Order />} />

              <Route
                path="/account"
                element={
                  <ProtectedRoute>
                    <Account />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/my-bookings"
                element={
                  <ProtectedRoute>
                    <MyBookings />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/my-orders"
                element={
                  <ProtectedRoute>
                    <MyOrders />
                  </ProtectedRoute>
                }
              />
            </Route>

            <Route
              path="/admin"
              element={
                <ProtectedRoute roles={ADMIN_ROLES}>
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<AdminHome />} />

              {/* Operational dashboard and reports (SRS §4.10, §4.11). */}
              <Route
                path="dashboard"
                element={
                  <ProtectedRoute roles={DASHBOARD_ROLES}>
                    <AdminDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="reports"
                element={
                  <ProtectedRoute roles={FINANCE_ROLES}>
                    <Reports />
                  </ProtectedRoute>
                }
              />

              {/* Front desk: bookings, check-in/out and the guest register. */}
              <Route
                path="bookings"
                element={
                  <ProtectedRoute roles={FRONT_DESK_ROLES}>
                    <AdminBookings />
                  </ProtectedRoute>
                }
              />
              <Route
                path="bookings/:id"
                element={
                  <ProtectedRoute roles={FRONT_DESK_ROLES}>
                    <BookingDetail />
                  </ProtectedRoute>
                }
              />
              <Route
                path="customers"
                element={
                  <ProtectedRoute roles={FRONT_DESK_ROLES}>
                    <Customers />
                  </ProtectedRoute>
                }
              />

              {/* Setup screens stay Super Admin / Manager. */}
              <Route
                path="room-types"
                element={
                  <ProtectedRoute roles={SETUP_ROLES}>
                    <RoomTypes />
                  </ProtectedRoute>
                }
              />
              <Route
                path="rooms"
                element={
                  <ProtectedRoute roles={SETUP_ROLES}>
                    <Rooms />
                  </ProtectedRoute>
                }
              />

              {/* Restaurant setup. Waiters read the floor plan and set table
                  status; adding and removing tables stays Manager-level. */}
              <Route
                path="tables"
                element={
                  <ProtectedRoute roles={FLOOR_ROLES}>
                    <Tables />
                  </ProtectedRoute>
                }
              />
              <Route
                path="categories"
                element={
                  <ProtectedRoute roles={SETUP_ROLES}>
                    <Categories />
                  </ProtectedRoute>
                }
              />
              <Route
                path="menu"
                element={
                  <ProtectedRoute roles={SETUP_ROLES}>
                    <Menu />
                  </ProtectedRoute>
                }
              />

              {/* Food ordering (SRS §4.5). Which buttons appear on an order
                  depends on the role; the API enforces the same split. */}
              <Route
                path="orders"
                element={
                  <ProtectedRoute roles={ORDER_ROLES}>
                    <Orders />
                  </ProtectedRoute>
                }
              />
              <Route
                path="kitchen"
                element={
                  <ProtectedRoute roles={KITCHEN_ROLES}>
                    <Kitchen />
                  </ProtectedRoute>
                }
              />

              {/* Money: coupons, the payment ledger and tax rates (SRS §4.6–§4.7, §9). */}
              <Route
                path="coupons"
                element={
                  <ProtectedRoute roles={SETUP_ROLES}>
                    <Coupons />
                  </ProtectedRoute>
                }
              />
              <Route
                path="payments"
                element={
                  <ProtectedRoute roles={FINANCE_ROLES}>
                    <Payments />
                  </ProtectedRoute>
                }
              />
              <Route
                path="settings/tax"
                element={
                  <ProtectedRoute roles={SYSTEM_ROLES}>
                    <TaxSettings />
                  </ProtectedRoute>
                }
              />
            </Route>

            {/* An unknown URL now explains itself rather than silently
                redirecting home, which looked like the app had lost the page. */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          </CartProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  )
}
