import { AlertTriangle, ArrowRight, Lock, Mail } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'

import { errorMessage } from '../api/client'
import SplitScreen from '../components/layout/SplitScreen'
import PageMeta from '../components/PageMeta'
import { Button, Input, InlineError } from '../components/ui'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const expired = searchParams.get('expired') === '1'
  const requestedPath = location.state?.from?.pathname ?? null

  async function handleSubmit(event) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const signedIn = await login(email, password)

      // Back where they were headed if they were bounced here; otherwise the
      // back office for staff and the guest area for customers (SRS §3).
      const home = signedIn?.accountType === 'staff' ? '/admin' : '/my-bookings'
      navigate(requestedPath ?? home, { replace: true })
    } catch (err) {
      setError(errorMessage(err, 'Unable to sign in.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <PageMeta title="Sign in" noIndex />

      <SplitScreen
        quote="Everything the front desk, the kitchen and the guest need — in one place."
        attribution="Restaurant & Room Booking System"
      >
        <div className="mb-8">
          <h1 className="font-display text-3xl font-semibold text-neutral-900">Welcome back</h1>
          <p className="mt-2 text-sm leading-relaxed text-neutral-500">
            Sign in to manage your bookings and orders. Staff accounts land in the back office.
          </p>
        </div>

        {expired && (
          <div
            role="status"
            className="mb-5 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3"
          >
            <AlertTriangle size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-warning" />
            <p className="text-sm text-amber-900">
              Your session expired after eight hours. Please sign in again.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <Input
            label="Email"
            id="email"
            type="email"
            autoComplete="username"
            required
            iconLeft={Mail}
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />

          <Input
            label="Password"
            id="password"
            type="password"
            autoComplete="current-password"
            required
            iconLeft={Lock}
            placeholder="••••••••"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />

          {error && <InlineError message={error} />}

          <Button type="submit" size="lg" fullWidth loading={submitting} iconRight={ArrowRight}>
            Sign in
          </Button>
        </form>

        <p className="mt-6 text-sm text-neutral-500">
          No account?{' '}
          <Link
            to="/register"
            className="rounded-sm font-medium text-primary-700 underline underline-offset-4 hover:text-primary-800"
          >
            Register as a guest
          </Link>
        </p>

        <p className="mt-8 border-t border-neutral-200 pt-6 text-xs leading-relaxed text-neutral-400">
          Booking a room does not require an account — you can check availability and order food as
          a guest.{' '}
          <Link to="/" className="rounded-sm underline underline-offset-2 hover:text-neutral-600">
            Back to the site
          </Link>
        </p>
      </SplitScreen>
    </>
  )
}
