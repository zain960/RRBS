import { Info } from 'lucide-react'
import { useState } from 'react'

import { changePassword } from '../../api/auth'
import { errorDetails, errorMessage } from '../../api/client'
import PageMeta from '../../components/PageMeta'
import {
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  FormSection,
  Input,
  PageHeader,
} from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'

const MIN_PASSWORD_LENGTH = 8

/**
 * The signed-in staff member's own account.
 *
 * Open to every back-office role: changing your own password is not a
 * privileged action, and the API scopes it to the bearer token regardless of
 * what this screen sends. Editing *other* people's accounts is staff
 * management, which this phase does not include — hence the read-only profile.
 */
export default function MyAccount() {
  const { user, role } = useAuth()
  const toast = useToast()

  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [fieldErrors, setFieldErrors] = useState({})
  const [saving, setSaving] = useState(false)

  function update(field) {
    return (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()

    // Checked here rather than server-side: the confirmation box exists to catch
    // a typo before it becomes a password nobody knows, and the API has no use
    // for a field whose only job is to equal another one.
    if (form.newPassword !== form.confirmPassword) {
      setFieldErrors({ confirmPassword: 'The two passwords do not match.' })
      return
    }

    setFieldErrors({})
    setSaving(true)

    try {
      await changePassword(form.currentPassword, form.newPassword)
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      toast.success('Password changed.')
    } catch (err) {
      setFieldErrors(errorDetails(err) ?? {})
      toast.error(errorMessage(err, 'Could not change your password.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageMeta title="My account" noIndex />

      <PageHeader
        title="My account"
        subtitle="Your sign-in details."
        breadcrumbs={[{ label: 'Settings' }, { label: 'My account' }]}
      />

      <div className="max-w-xl space-y-6">
        <Card>
          <CardHeader title="Profile" />
          <CardBody>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-neutral-400">
                  Name
                </dt>
                <dd className="mt-1 text-sm text-neutral-900">{user?.fullName ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-neutral-400">
                  Role
                </dt>
                <dd className="mt-1 text-sm text-neutral-900">{role ?? '—'}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium uppercase tracking-wider text-neutral-400">
                  Email
                </dt>
                <dd className="mt-1 text-sm text-neutral-900">{user?.email ?? '—'}</dd>
              </div>
            </dl>

            <p className="mt-5 flex items-start gap-2.5 rounded-lg border border-neutral-200 bg-neutral-50 px-3.5 py-3 text-xs leading-relaxed text-neutral-600">
              <Info size={16} aria-hidden="true" className="mt-px shrink-0 text-info" />
              Your name, email and role are set by a Super Admin. Ask them to change these.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Change password"
            subtitle="You will stay signed in on this device."
          />
          <form onSubmit={handleSubmit} noValidate>
            <CardBody className="space-y-5">
              <Input
                label="Current password"
                id="currentPassword"
                type="password"
                autoComplete="current-password"
                required
                value={form.currentPassword}
                onChange={update('currentPassword')}
                error={fieldErrors.currentPassword}
              />

              <FormSection columns={2}>
                <Input
                  label="New password"
                  id="newPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
                  value={form.newPassword}
                  onChange={update('newPassword')}
                  error={fieldErrors.newPassword}
                />

                <Input
                  label="Confirm new password"
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={form.confirmPassword}
                  onChange={update('confirmPassword')}
                  error={fieldErrors.confirmPassword}
                />
              </FormSection>
            </CardBody>

            <CardFooter className="justify-end">
              <Button type="submit" loading={saving}>
                Change password
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </>
  )
}
