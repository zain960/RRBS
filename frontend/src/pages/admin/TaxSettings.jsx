import { Info } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import { errorDetails, errorMessage } from '../../api/client'
import { getTaxSettings, updateTaxSettings } from '../../api/settings'
import PageMeta from '../../components/PageMeta'
import {
  Button,
  Card,
  CardBody,
  CardFooter,
  ErrorState,
  FormSection,
  Input,
  PageHeader,
  Skeleton,
} from '../../components/ui'
import { useToast } from '../../context/ToastContext'
import { dateTimeLong } from '../../lib/format'

/**
 * Tax Settings (SRS §9).
 *
 * Rooms and food may carry different rates, and both are applied *after* any
 * discount (SRS §5.3). Changing a rate affects future bookings and orders only:
 * confirmed ones store the tax they were actually charged (CLAUDE.md §4), which
 * is what the notice below the fields is there to make explicit before someone
 * edits a live rate.
 */
export default function TaxSettings() {
  const toast = useToast()

  const [form, setForm] = useState({ roomTaxRate: '', foodTaxRate: '' })
  const [meta, setMeta] = useState({ updatedBy: null, updatedAt: null })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [fieldErrors, setFieldErrors] = useState({})

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    getTaxSettings()
      .then((settings) => {
        setForm({ roomTaxRate: settings.roomTaxRate, foodTaxRate: settings.foodTaxRate })
        setMeta({ updatedBy: settings.updatedBy, updatedAt: settings.updatedAt })
      })
      .catch((err) => setError(errorMessage(err, 'Could not load tax settings.')))
      .finally(() => setLoading(false))
  }, [])

  useEffect(load, [load])

  function update(field) {
    return (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setFieldErrors({})
    setSaving(true)

    try {
      const settings = await updateTaxSettings(form)
      setForm({ roomTaxRate: settings.roomTaxRate, foodTaxRate: settings.foodTaxRate })
      setMeta({ updatedBy: settings.updatedBy, updatedAt: settings.updatedAt })
      toast.success('Tax rates updated.')
    } catch (err) {
      setFieldErrors(errorDetails(err) ?? {})
      toast.error(errorMessage(err, 'Could not save the tax rates.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageMeta title="Tax Settings" noIndex />

      <PageHeader
        title="Tax Settings"
        subtitle="Applied after any discount. Rooms and food may carry different rates."
        breadcrumbs={[{ label: 'Settings' }, { label: 'Tax' }]}
      />

      <Card className="max-w-xl">
        {loading ? (
          <CardBody className="space-y-5" role="status" aria-busy="true">
            <span className="sr-only">Loading tax settings</span>
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-12 w-full" />
          </CardBody>
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <CardBody className="space-y-5">
              <FormSection columns={2}>
                <Input
                  label="Room tax rate"
                  id="roomTaxRate"
                  inputMode="decimal"
                  suffix="%"
                  required
                  value={form.roomTaxRate}
                  onChange={update('roomTaxRate')}
                  error={fieldErrors.roomTaxRate}
                />

                <Input
                  label="Food tax rate"
                  id="foodTaxRate"
                  inputMode="decimal"
                  suffix="%"
                  required
                  value={form.foodTaxRate}
                  onChange={update('foodTaxRate')}
                  error={fieldErrors.foodTaxRate}
                />
              </FormSection>

              <p className="flex items-start gap-2.5 rounded-lg border border-neutral-200 bg-neutral-50 px-3.5 py-3 text-xs leading-relaxed text-neutral-600">
                <Info size={16} aria-hidden="true" className="mt-px shrink-0 text-info" />
                Changing a rate affects new bookings and orders only. Confirmed ones keep the tax
                they were charged.
              </p>
            </CardBody>

            <CardFooter className="justify-between">
              <p className="text-xs text-neutral-400">
                {meta.updatedAt
                  ? `Last changed ${dateTimeLong(meta.updatedAt)}${
                      meta.updatedBy ? ` by ${meta.updatedBy}` : ''
                    }`
                  : 'Never changed.'}
              </p>
              <Button type="submit" loading={saving}>
                Save rates
              </Button>
            </CardFooter>
          </form>
        )}
      </Card>
    </>
  )
}
