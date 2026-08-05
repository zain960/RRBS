import { ArrowRight, Lock, Mail, MapPin, Phone, User } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { errorDetails, errorMessage } from '../api/client'
import SplitScreen from '../components/layout/SplitScreen'
import PageMeta from '../components/PageMeta'
import { Button, InlineError, Input, Textarea } from '../components/ui'
import { useAuth } from '../context/AuthContext'

const EMPTY = { fullName: '', email: '', phone: '', password: '', address: '' }

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)

  function update(field) {
    return (event) => setForm((previous) => ({ ...previous, [field]: event.target.value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError(null)
    setFieldErrors({})
    setSubmitting(true)
    try {
      // Registration returns a token, so the customer is signed in immediately.
      await register(form)
      // Self-registration always creates a Customer (SRS §3), so the guest area
      // is the right landing place.
      navigate('/my-bookings', { replace: true })
    } catch (err) {
      setError(errorMessage(err, 'Unable to create your account.'))
      setFieldErrors(errorDetails(err) ?? {})
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <PageMeta title="Create an account" noIndex />

      <SplitScreen
        image="https://images.unsplash.com/photo-1445019980597-93fa8acb246c?auto=format&fit=crop&w=1400&q=70"
        quote="Keep your bookings, orders and receipts together — and skip re-typing your details every time."
        attribution="Guest accounts at RRBS"
        contentClassName="max-w-lg"
      >
        <div className="mb-8">
          <h1 className="font-display text-3xl font-semibold text-neutral-900">
            Create your account
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-neutral-500">
            A guest account keeps your booking history and lets you order room service while you're
            checked in.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <Input
            label="Full name"
            id="fullName"
            required
            autoComplete="name"
            iconLeft={User}
            value={form.fullName}
            onChange={update('fullName')}
            error={fieldErrors.fullName}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Email"
              id="email"
              type="email"
              required
              autoComplete="email"
              iconLeft={Mail}
              value={form.email}
              onChange={update('email')}
              error={fieldErrors.email}
            />
            <Input
              label="Phone"
              id="phone"
              type="tel"
              required
              autoComplete="tel"
              iconLeft={Phone}
              value={form.phone}
              onChange={update('phone')}
              error={fieldErrors.phone}
            />
          </div>

          <Input
            label="Password"
            id="password"
            type="password"
            required
            autoComplete="new-password"
            iconLeft={Lock}
            hint="At least eight characters."
            value={form.password}
            onChange={update('password')}
            error={fieldErrors.password}
          />

          <Textarea
            label="Delivery address"
            id="address"
            rows={3}
            hint="Optional — needed only if you order delivery."
            value={form.address}
            onChange={update('address')}
            error={fieldErrors.address}
          />

          {error && <InlineError message={error} />}

          <Button type="submit" size="lg" fullWidth loading={submitting} iconRight={ArrowRight}>
            Create account
          </Button>
        </form>

        <p className="mt-6 text-sm text-neutral-500">
          Already registered?{' '}
          <Link
            to="/login"
            className="rounded-sm font-medium text-primary-700 underline underline-offset-4 hover:text-primary-800"
          >
            Sign in
          </Link>
        </p>

        <p className="mt-8 flex items-start gap-2 border-t border-neutral-200 pt-6 text-xs leading-relaxed text-neutral-400">
          <MapPin size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
          Staff accounts are created by a Super Admin, not here. This form always creates a guest
          account.
        </p>
      </SplitScreen>
    </>
  )
}
