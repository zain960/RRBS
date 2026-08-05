import { Pencil, Plus, TicketPercent, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import { errorDetails, errorMessage } from '../../api/client'
import {
  createCoupon,
  deleteCoupon,
  listCoupons,
  setCouponActive,
  updateCoupon,
} from '../../api/coupons'
import PageMeta from '../../components/PageMeta'
import {
  Badge,
  Button,
  Card,
  Checkbox,
  ConfirmDialog,
  DatePicker,
  EmptyState,
  FilterBar,
  FormSection,
  FullWidth,
  Input,
  Modal,
  PageHeader,
  ResponsiveTable,
  Select,
  Switch,
} from '../../components/ui'
import { useToast } from '../../context/ToastContext'
import { dateOnly, money, number } from '../../lib/format'
import { COUPON_APPLICABILITY, DISCOUNT_TYPE, statusMeta, statusOptions } from '../../lib/statuses'

const EMPTY_FILTERS = { isActive: '', applicableTo: '' }

const EMPTY_FORM = {
  code: '',
  discountType: 'PERCENTAGE',
  discountValue: '',
  applicableTo: 'BOTH',
  minAmount: '',
  usageLimit: '',
  validFrom: '',
  validTo: '',
  isActive: true,
}

const STATE_OPTIONS = [
  { value: '', label: 'All states' },
  { value: 'true', label: 'Active' },
  { value: 'false', label: 'Inactive' },
]

const APPLIES_OPTIONS = [
  { value: '', label: 'Anything' },
  ...statusOptions(COUPON_APPLICABILITY),
]

/** `valid_from` / `valid_to` are DATEs — trim any time part for the date input. */
function toDateInput(value) {
  return value ? String(value).slice(0, 10) : ''
}

/**
 * Coupons (SRS §5.3).
 *
 * Every rule visible on this screen — validity window, minimum amount,
 * applicability and remaining uses — is re-checked server-side at checkout;
 * nothing here is the enforcement point. At most one coupon applies to a
 * booking or an order, and it is never combined with loyalty redemption
 * (CLAUDE.md §4).
 *
 * Deactivating is the reversible move and deleting is not: the API refuses to
 * delete a coupon that has already been redeemed, so history stays intact.
 */
export default function Coupons() {
  const toast = useToast()

  const [coupons, setCoupons] = useState([])
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [fieldErrors, setFieldErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const [pendingId, setPendingId] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setCoupons(await listCoupons(filters))
    } catch (err) {
      setError(errorMessage(err, 'Could not load coupons.'))
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    refresh()
  }, [refresh])

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFieldErrors({})
    setFormOpen(true)
  }

  function openEdit(coupon) {
    setEditing(coupon)
    setForm({
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      applicableTo: coupon.applicableTo,
      minAmount: coupon.minAmount ?? '',
      usageLimit: coupon.usageLimit === null ? '' : String(coupon.usageLimit),
      validFrom: toDateInput(coupon.validFrom),
      validTo: toDateInput(coupon.validTo),
      isActive: coupon.isActive,
    })
    setFieldErrors({})
    setFormOpen(true)
  }

  function update(field) {
    return (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setFieldErrors({})
    setSaving(true)

    const payload = {
      code: form.code,
      discount_type: form.discountType,
      discount_value: form.discountValue,
      applicable_to: form.applicableTo,
      min_amount: form.minAmount || null,
      usage_limit: form.usageLimit || null,
      valid_from: form.validFrom,
      valid_to: form.validTo,
      is_active: form.isActive,
    }

    try {
      if (editing) {
        await updateCoupon(editing.id, payload)
        toast.success(`Coupon ${form.code.toUpperCase()} updated.`)
      } else {
        await createCoupon(payload)
        toast.success(`Coupon ${form.code.toUpperCase()} created.`)
      }
      setFormOpen(false)
      await refresh()
    } catch (err) {
      setFieldErrors(errorDetails(err) ?? {})
      toast.error(errorMessage(err, 'Could not save the coupon.'))
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleActive(coupon) {
    setPendingId(coupon.id)
    try {
      await setCouponActive(coupon.id, !coupon.isActive)
      toast.success(`${coupon.code} ${coupon.isActive ? 'deactivated' : 'activated'}.`)
      await refresh()
    } catch (err) {
      toast.error(errorMessage(err, 'Could not change the coupon.'))
    } finally {
      setPendingId(null)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await deleteCoupon(deleteTarget.id)
      toast.success(`Coupon ${deleteTarget.code} deleted.`)
      setDeleteTarget(null)
      await refresh()
    } catch (err) {
      // 409 when the coupon has already been redeemed.
      toast.error(errorMessage(err, 'Could not delete the coupon.'))
    } finally {
      setDeleting(false)
    }
  }

  const isFiltered = Object.values(filters).some(Boolean)

  const columns = [
    {
      key: 'code',
      header: 'Code',
      primary: true,
      render: (coupon) => (
        <span className="font-mono font-medium text-neutral-900">{coupon.code}</span>
      ),
    },
    {
      key: 'discount',
      header: 'Discount',
      render: (coupon) =>
        coupon.discountType === 'PERCENTAGE'
          ? `${Number(coupon.discountValue)}%`
          : money(coupon.discountValue),
    },
    {
      key: 'appliesTo',
      header: 'Applies to',
      render: (coupon) => (
        <Badge tone={statusMeta(COUPON_APPLICABILITY, coupon.applicableTo).tone} size="sm">
          {statusMeta(COUPON_APPLICABILITY, coupon.applicableTo).label}
        </Badge>
      ),
    },
    {
      key: 'minAmount',
      header: 'Min amount',
      align: 'right',
      hideBelow: 'lg',
      render: (coupon) => (
        <span className="tabular-nums text-neutral-600">
          {coupon.minAmount ? money(coupon.minAmount) : '—'}
        </span>
      ),
    },
    {
      key: 'uses',
      header: 'Uses',
      hideBelow: 'md',
      render: (coupon) => {
        const exhausted = coupon.remainingUses !== null && coupon.remainingUses === 0
        return (
          <span className="whitespace-nowrap tabular-nums text-neutral-600">
            {number(coupon.timesUsed)}
            {coupon.usageLimit === null ? ' / ∞' : ` / ${number(coupon.usageLimit)}`}
            {exhausted && (
              <Badge tone="warning" size="sm" className="ml-2">
                Exhausted
              </Badge>
            )}
          </span>
        )
      },
    },
    {
      key: 'valid',
      header: 'Valid',
      hideBelow: 'lg',
      render: (coupon) => (
        <span className="whitespace-nowrap text-xs text-neutral-600">
          {dateOnly(coupon.validFrom)} → {dateOnly(coupon.validTo)}
        </span>
      ),
    },
    {
      key: 'state',
      header: 'State',
      render: (coupon) => (
        // A switch, not a chip: this takes effect the moment it is flipped,
        // which is exactly the distinction the primitive encodes.
        <Switch
          checked={coupon.isActive}
          disabled={pendingId === coupon.id}
          aria-label={`${coupon.isActive ? 'Deactivate' : 'Activate'} ${coupon.code}`}
          onClick={(event) => event.stopPropagation()}
          onChange={() => handleToggleActive(coupon)}
        />
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      width: 'w-24',
      render: (coupon) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            iconLeft={Pencil}
            aria-label={`Edit ${coupon.code}`}
            onClick={(event) => {
              event.stopPropagation()
              openEdit(coupon)
            }}
          />
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            iconLeft={Trash2}
            aria-label={`Delete ${coupon.code}`}
            className="text-danger hover:bg-red-50"
            onClick={(event) => {
              event.stopPropagation()
              setDeleteTarget(coupon)
            }}
          />
        </div>
      ),
    },
  ]

  const isPercentage = form.discountType === 'PERCENTAGE'

  return (
    <>
      <PageMeta title="Coupons" noIndex />

      <PageHeader
        title="Coupons"
        subtitle="Checked against validity window, minimum amount, applicability and remaining uses at checkout. One coupon per booking or order."
        breadcrumbs={[{ label: 'Finance' }, { label: 'Coupons' }]}
        actions={
          <Button iconLeft={Plus} onClick={openCreate}>
            New coupon
          </Button>
        }
      />

      <FilterBar className="sm:items-end">
        <Select
          label="State"
          size="sm"
          fieldClassName="w-full sm:w-40"
          value={filters.isActive}
          onChange={(event) => setFilters((f) => ({ ...f, isActive: event.target.value }))}
          options={STATE_OPTIONS}
        />

        <Select
          label="Applies to"
          size="sm"
          fieldClassName="w-full sm:w-40"
          value={filters.applicableTo}
          onChange={(event) => setFilters((f) => ({ ...f, applicableTo: event.target.value }))}
          options={APPLIES_OPTIONS}
        />

        {isFiltered && (
          <Button variant="ghost" size="sm" onClick={() => setFilters(EMPTY_FILTERS)}>
            Clear filters
          </Button>
        )}

        <p className="text-xs text-neutral-500 sm:ml-auto" aria-live="polite">
          {loading
            ? 'Loading…'
            : `${number(coupons.length)} coupon${coupons.length === 1 ? '' : 's'}`}
        </p>
      </FilterBar>

      <Card className="overflow-hidden">
        <ResponsiveTable
          columns={columns}
          rows={coupons}
          rowKey={(coupon) => coupon.id}
          onRowClick={openEdit}
          loading={loading}
          error={error}
          onRetry={refresh}
          caption="Discount coupons"
          empty={
            <EmptyState
              icon={TicketPercent}
              title={isFiltered ? 'No coupons match these filters' : 'No coupons yet'}
              description={
                isFiltered
                  ? 'Clear the filters to see every coupon, including expired ones.'
                  : 'A coupon discounts a booking or an order at checkout. Create one to run a promotion.'
              }
              action={
                isFiltered ? (
                  <Button variant="secondary" onClick={() => setFilters(EMPTY_FILTERS)}>
                    Clear filters
                  </Button>
                ) : (
                  <Button iconLeft={Plus} onClick={openCreate}>
                    Create the first coupon
                  </Button>
                )
              }
            />
          }
        />
      </Card>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? `Edit ${editing.code}` : 'New coupon'}
        description="Rules are re-checked at checkout, so a coupon can be edited while it is live."
        size="lg"
        closeOnBackdrop={false}
      >
        <form onSubmit={handleSubmit} className="space-y-6" noValidate>
          <FormSection columns={2}>
            <FullWidth>
              <Input
                label="Code"
                id="code"
                required
                autoFocus
                maxLength={30}
                className="font-mono uppercase"
                hint="What the guest types at checkout. Case is ignored."
                value={form.code}
                onChange={(event) =>
                  setForm((f) => ({ ...f, code: event.target.value.toUpperCase() }))
                }
                error={fieldErrors.code}
              />
            </FullWidth>

            <Select
              label="Discount type"
              id="discountType"
              value={form.discountType}
              onChange={update('discountType')}
              options={statusOptions(DISCOUNT_TYPE)}
              error={fieldErrors.discountType}
            />

            <Input
              label={isPercentage ? 'Percentage' : 'Amount'}
              id="discountValue"
              inputMode="decimal"
              required
              suffix={isPercentage ? '%' : undefined}
              placeholder={isPercentage ? '10' : '500.00'}
              value={form.discountValue}
              onChange={update('discountValue')}
              error={fieldErrors.discountValue}
            />

            <FullWidth>
              <Select
                label="Applies to"
                id="applicableTo"
                value={form.applicableTo}
                onChange={update('applicableTo')}
                options={statusOptions(COUPON_APPLICABILITY)}
                hint="Rooms-only coupons are rejected on a food order, and the reverse."
                error={fieldErrors.applicableTo}
              />
            </FullWidth>

            <Input
              label="Minimum amount"
              id="minAmount"
              inputMode="decimal"
              placeholder="No minimum"
              hint="Optional. Checked against the subtotal, before tax."
              value={form.minAmount}
              onChange={update('minAmount')}
              error={fieldErrors.minAmount}
            />

            <Input
              label="Usage limit"
              id="usageLimit"
              type="number"
              min={1}
              placeholder="Unlimited"
              hint="Optional. Total redemptions across all guests."
              value={form.usageLimit}
              onChange={update('usageLimit')}
              error={fieldErrors.usageLimit}
            />

            <DatePicker
              label="Valid from"
              id="validFrom"
              required
              max={form.validTo || undefined}
              value={form.validFrom}
              onChange={update('validFrom')}
              error={fieldErrors.validFrom}
            />

            <DatePicker
              label="Valid to"
              id="validTo"
              required
              min={form.validFrom || undefined}
              value={form.validTo}
              onChange={update('validTo')}
              error={fieldErrors.validTo}
            />

            <FullWidth>
              <Checkbox
                label="Active"
                description="Inactive coupons are rejected at checkout but keep their history."
                checked={form.isActive}
                onChange={(event) => setForm((f) => ({ ...f, isActive: event.target.checked }))}
              />
            </FullWidth>
          </FormSection>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" type="button" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {editing ? 'Save changes' : 'Create coupon'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete this coupon?"
        message={
          deleteTarget
            ? `"${deleteTarget.code}" will be removed. A coupon that has already been redeemed cannot be deleted — deactivate it instead so past bookings keep their discount.`
            : ''
        }
        confirmLabel="Delete coupon"
      />
    </>
  )
}
