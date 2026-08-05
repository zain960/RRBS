import { Pencil, Plus, Sofa, Trash2, Users } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import { errorDetails, errorMessage } from '../../api/client'
import {
  createTable,
  deleteTable,
  listTables,
  updateTable,
  updateTableStatus,
} from '../../api/tables'
import PageMeta from '../../components/PageMeta'
import RoleGate from '../../components/RoleGate'
import {
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  FilterBar,
  FormSection,
  Input,
  Modal,
  PageHeader,
  Select,
  SelectControl,
  Skeleton,
  StatusChip,
  ToggleGroup,
} from '../../components/ui'
import { useToast } from '../../context/ToastContext'
import cn from '../../lib/cn'
import { statusMeta, statusOptions, TABLE_LOCATION, TABLE_STATUS } from '../../lib/statuses'

const EMPTY_FORM = { tableNumber: '', capacity: '', location: 'INDOOR', status: 'FREE' }

/**
 * The floor plan (SRS §4.4).
 *
 * Rendered as a grid of table cards rather than a list, because a waiter reads
 * this as a room: what is free, what is taken, where. Status is a control on
 * each card, since moving a table between Free / Reserved / Occupied is the
 * whole job during service.
 *
 * Waiters may set status but not add or remove tables — the buttons that do
 * that sit behind a RoleGate, and the API enforces the same split (SRS §3).
 */
export default function Tables() {
  const toast = useToast()

  const [tables, setTables] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filters, setFilters] = useState({ status: '', location: '' })

  const [editing, setEditing] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [fieldErrors, setFieldErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [statusBusy, setStatusBusy] = useState(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setTables(await listTables(filters))
    } catch (err) {
      setError(errorMessage(err, 'Could not load the floor plan.'))
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
    setModalOpen(true)
  }

  function openEdit(table) {
    setEditing(table)
    setForm({
      tableNumber: table.tableNumber,
      capacity: String(table.capacity),
      location: table.location,
      status: table.status,
    })
    setFieldErrors({})
    setModalOpen(true)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setFieldErrors({})
    setSaving(true)

    const payload = {
      tableNumber: form.tableNumber,
      capacity: form.capacity,
      location: form.location,
      status: form.status,
    }

    try {
      if (editing) {
        await updateTable(editing.id, payload)
        toast.success(`Table ${payload.tableNumber} updated.`)
      } else {
        await createTable(payload)
        toast.success(`Table ${payload.tableNumber} added.`)
      }
      setModalOpen(false)
      refresh()
    } catch (err) {
      setFieldErrors(errorDetails(err) ?? {})
      toast.error(errorMessage(err, 'Could not save the table.'))
    } finally {
      setSaving(false)
    }
  }

  async function handleStatus(table, status) {
    setStatusBusy(table.id)
    try {
      await updateTableStatus(table.id, status)
      refresh()
    } catch (err) {
      toast.error(errorMessage(err, 'Could not change the table status.'))
    } finally {
      setStatusBusy(null)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await deleteTable(deleteTarget.id)
      toast.success('Table removed.')
      setDeleteTarget(null)
      refresh()
    } catch (err) {
      toast.error(errorMessage(err, 'Could not delete the table.'))
    } finally {
      setDeleting(false)
    }
  }

  const free = tables.filter((table) => table.status === 'FREE').length

  return (
    <>
      <PageMeta title="Tables" noIndex />

      <PageHeader
        title="Tables"
        subtitle="The restaurant floor. A table becomes occupied automatically when a dine-in order is placed."
        breadcrumbs={[{ label: 'Restaurant' }, { label: 'Tables' }]}
        actions={
          <RoleGate roles={['Super Admin', 'Manager']}>
            <Button iconLeft={Plus} onClick={openCreate}>
              New table
            </Button>
          </RoleGate>
        }
      />

      <FilterBar>
        <ToggleGroup
          ariaLabel="Filter by status"
          size="sm"
          value={filters.status}
          onChange={(value) => setFilters((current) => ({ ...current, status: value }))}
          options={[{ value: '', label: 'All' }, ...statusOptions(TABLE_STATUS)]}
        />

        <div className="w-full sm:w-40">
          <label htmlFor="filter-location" className="sr-only">
            Filter by location
          </label>
          <SelectControl
            id="filter-location"
            size="sm"
            value={filters.location}
            onChange={(event) =>
              setFilters((current) => ({ ...current, location: event.target.value }))
            }
            options={[{ value: '', label: 'Indoor and outdoor' }, ...statusOptions(TABLE_LOCATION)]}
          />
        </div>

        <p className="text-xs text-neutral-500 sm:ml-auto" aria-live="polite">
          {loading ? 'Loading…' : `${free} of ${tables.length} free`}
        </p>
      </FilterBar>

      {loading ? (
        <div role="status" aria-busy="true" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <span className="sr-only">Loading the floor plan</span>
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-44" rounded="rounded-lg" />
          ))}
        </div>
      ) : error ? (
        <Card>
          <ErrorState message={error} onRetry={refresh} />
        </Card>
      ) : tables.length === 0 ? (
        <Card>
          <EmptyState
            icon={Sofa}
            title={filters.status || filters.location ? 'No tables match' : 'No tables yet'}
            description={
              filters.status || filters.location
                ? 'Try clearing the filters to see the whole floor.'
                : 'Add the tables in your restaurant so waiters can seat guests against them.'
            }
            action={
              filters.status || filters.location ? (
                <Button variant="secondary" onClick={() => setFilters({ status: '', location: '' })}>
                  Clear filters
                </Button>
              ) : (
                <RoleGate roles={['Super Admin', 'Manager']}>
                  <Button iconLeft={Plus} onClick={openCreate}>
                    Add the first table
                  </Button>
                </RoleGate>
              )
            }
          />
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {tables.map((table) => {
            return (
              <li key={table.id}>
                <Card
                  variant="default"
                  className={cn(
                    'flex h-full flex-col p-4',
                    table.status === 'OCCUPIED' && 'border-sky-200 bg-sky-50/40',
                    table.status === 'RESERVED' && 'border-amber-200 bg-amber-50/40'
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-display text-xl font-semibold text-neutral-900">
                        {table.tableNumber}
                      </p>
                      <p className="mt-0.5 inline-flex items-center gap-1.5 text-xs text-neutral-500">
                        <Users size={12} aria-hidden="true" />
                        Seats {table.capacity} ·{' '}
                        {statusMeta(TABLE_LOCATION, table.location).label}
                      </p>
                    </div>
                    <StatusChip map={TABLE_STATUS} value={table.status} size="sm" />
                  </div>

                  <div className="mt-auto space-y-2 pt-4">
                    <label htmlFor={`table-status-${table.id}`} className="sr-only">
                      Status for table {table.tableNumber}
                    </label>
                    <SelectControl
                      id={`table-status-${table.id}`}
                      size="sm"
                      value={table.status}
                      disabled={statusBusy === table.id}
                      onChange={(event) => handleStatus(table, event.target.value)}
                      options={statusOptions(TABLE_STATUS)}
                    />

                    <RoleGate roles={['Super Admin', 'Manager']}>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          iconLeft={Pencil}
                          onClick={() => openEdit(table)}
                          className="flex-1"
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          iconOnly
                          iconLeft={Trash2}
                          aria-label={`Delete table ${table.tableNumber}`}
                          className="text-danger hover:bg-red-50"
                          onClick={() => setDeleteTarget(table)}
                        />
                      </div>
                    </RoleGate>
                  </div>
                </Card>
              </li>
            )
          })}
        </ul>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Edit table ${editing.tableNumber}` : 'New table'}
        size="md"
        closeOnBackdrop={false}
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <FormSection columns={2}>
            <Input
              label="Table number"
              id="tableNumber"
              required
              maxLength={10}
              value={form.tableNumber}
              onChange={(event) =>
                setForm((current) => ({ ...current, tableNumber: event.target.value }))
              }
              error={fieldErrors.tableNumber}
            />
            <Input
              label="Capacity"
              id="capacity"
              type="number"
              min={1}
              required
              iconLeft={Users}
              value={form.capacity}
              onChange={(event) =>
                setForm((current) => ({ ...current, capacity: event.target.value }))
              }
              error={fieldErrors.capacity}
            />
            <Select
              label="Location"
              id="location"
              required
              value={form.location}
              onChange={(event) =>
                setForm((current) => ({ ...current, location: event.target.value }))
              }
              options={statusOptions(TABLE_LOCATION)}
              error={fieldErrors.location}
            />
            <Select
              label="Status"
              id="status"
              required
              value={form.status}
              onChange={(event) =>
                setForm((current) => ({ ...current, status: event.target.value }))
              }
              options={statusOptions(TABLE_STATUS)}
              error={fieldErrors.status}
            />
          </FormSection>

          <div className="flex flex-col-reverse gap-2 border-t border-neutral-200 pt-5 sm:flex-row sm:justify-end">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {editing ? 'Save changes' : 'Add table'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Remove this table?"
        message={
          deleteTarget
            ? `Table ${deleteTarget.tableNumber} will be removed from the floor plan. Tables with orders against them cannot be deleted.`
            : ''
        }
        confirmLabel="Remove table"
      />
    </>
  )
}
