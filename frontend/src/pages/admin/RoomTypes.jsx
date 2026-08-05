import { BookOpen, Pencil, Plus, Trash2, Users } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import { errorDetails, errorMessage } from '../../api/client'
import { byId, listRatings } from '../../api/reviews'
import {
  createRoomType,
  deleteRoomType,
  listRoomTypes,
  updateRoomType,
} from '../../api/roomTypes'
import { RatingStars } from '../../components/domain/Rating'
import PageMeta from '../../components/PageMeta'
import {
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  FormSection,
  FullWidth,
  Image,
  Input,
  Modal,
  PageHeader,
  ResponsiveTable,
  Textarea,
} from '../../components/ui'
import { useToast } from '../../context/ToastContext'
import { money, number } from '../../lib/format'

/** The seven fixed durations, in the order they appear on a rate card (SRS §5.1). */
const RATE_FIELDS = [
  { name: 'rate2hr', label: '2 hours' },
  { name: 'rate4hr', label: '4 hours' },
  { name: 'rate6hr', label: '6 hours' },
  { name: 'rate8hr', label: '8 hours' },
  { name: 'rateFullDay', label: 'Full day' },
  { name: 'rateFullNight', label: 'Full night' },
  { name: 'rateDayNight', label: 'Day & night' },
]

const EMPTY_FORM = {
  typeName: '',
  capacity: '',
  amenities: '',
  imageUrl: '',
  ...Object.fromEntries(RATE_FIELDS.map((field) => [field.name, ''])),
}

function toForm(roomType) {
  return {
    typeName: roomType.typeName,
    capacity: String(roomType.capacity),
    amenities: roomType.amenities ?? '',
    imageUrl: roomType.imageUrl ?? '',
    ...Object.fromEntries(
      RATE_FIELDS.map((field) => [field.name, roomType.rates?.[field.name] ?? ''])
    ),
  }
}

/**
 * Room types and their rate cards (SRS §4.2).
 *
 * A type carries one rate per fixed duration. Editing a rate changes what new
 * bookings are quoted and never touches bookings already confirmed — those
 * store the amounts they were charged (CLAUDE.md §4).
 */
export default function RoomTypes() {
  const toast = useToast()

  const [roomTypes, setRoomTypes] = useState([])
  const [ratings, setRatings] = useState(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [editing, setEditing] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [fieldErrors, setFieldErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setRoomTypes(await listRoomTypes())
    } catch (err) {
      setError(errorMessage(err, 'Could not load room types.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Supplementary: a failure here leaves the column reading "No reviews"
  // rather than breaking the screen.
  useEffect(() => {
    listRatings('room_type')
      .then((rows) => setRatings(byId(rows)))
      .catch(() => setRatings(new Map()))
  }, [])

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFieldErrors({})
    setModalOpen(true)
  }

  function openEdit(roomType) {
    setEditing(roomType)
    setForm(toForm(roomType))
    setFieldErrors({})
    setModalOpen(true)
  }

  function update(field) {
    return (event) => setForm((previous) => ({ ...previous, [field]: event.target.value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setFieldErrors({})
    setSaving(true)

    // Blank rate inputs are sent as null rather than "" so the API treats them
    // as "no rate set" instead of an invalid amount.
    const payload = {
      typeName: form.typeName,
      capacity: form.capacity,
      amenities: form.amenities || null,
      imageUrl: form.imageUrl || null,
      ...Object.fromEntries(
        RATE_FIELDS.map((field) => [
          field.name,
          form[field.name] === '' ? null : form[field.name],
        ])
      ),
    }

    try {
      if (editing) {
        await updateRoomType(editing.id, payload)
        toast.success(`Room type "${payload.typeName}" updated.`)
      } else {
        await createRoomType(payload)
        toast.success(`Room type "${payload.typeName}" created.`)
      }
      setModalOpen(false)
      refresh()
    } catch (err) {
      setFieldErrors(errorDetails(err) ?? {})
      toast.error(errorMessage(err, 'Could not save the room type.'))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await deleteRoomType(deleteTarget.id)
      toast.success('Room type deleted.')
      setDeleteTarget(null)
      refresh()
    } catch (err) {
      // 409 ROOM_TYPE_IN_USE names how many rooms still reference it.
      toast.error(errorMessage(err, 'Could not delete the room type.'))
    } finally {
      setDeleting(false)
    }
  }

  const columns = [
    {
      key: 'type',
      header: 'Room type',
      primary: true,
      render: (roomType) => (
        <div className="flex items-center gap-3">
          <Image
            src={roomType.imageUrl}
            alt=""
            aspect="aspect-[16/9]"
            rounded="rounded"
            className="w-16 shrink-0"
            sizes="64px"
            maxWidth={256}
          />
          <div className="min-w-0">
            <p className="truncate font-medium text-neutral-900">{roomType.typeName}</p>
            <p className="truncate text-xs text-neutral-500">
              {roomType.amenities || 'No amenities listed'}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'capacity',
      header: 'Sleeps',
      align: 'right',
      render: (roomType) => (
        <span className="inline-flex items-center gap-1.5 tabular-nums text-neutral-600">
          <Users size={13} aria-hidden="true" />
          {roomType.capacity}
        </span>
      ),
    },
    {
      key: 'rooms',
      header: 'Rooms',
      align: 'right',
      hideBelow: 'md',
      render: (roomType) => (
        <span className="tabular-nums text-neutral-600">{number(roomType.roomCount ?? 0)}</span>
      ),
    },
    {
      key: 'fullDay',
      header: 'Full day',
      align: 'right',
      hideBelow: 'lg',
      render: (roomType) => (
        <span className="tabular-nums text-neutral-700">{money(roomType.rates?.rateFullDay)}</span>
      ),
    },
    {
      key: 'rating',
      header: 'Rating',
      hideBelow: 'lg',
      render: (roomType) => {
        const rating = ratings.get(roomType.id)
        return <RatingStars value={rating?.average ?? 0} count={rating?.count} size="sm" />
      },
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      width: 'w-32',
      render: (roomType) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            iconLeft={Pencil}
            aria-label={`Edit ${roomType.typeName}`}
            onClick={(event) => {
              event.stopPropagation()
              openEdit(roomType)
            }}
          />
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            iconLeft={Trash2}
            aria-label={`Delete ${roomType.typeName}`}
            className="text-danger hover:bg-red-50"
            onClick={(event) => {
              event.stopPropagation()
              setDeleteTarget(roomType)
            }}
          />
        </div>
      ),
    },
  ]

  return (
    <>
      <PageMeta title="Room types" noIndex />

      <PageHeader
        title="Room types"
        subtitle="Capacity, amenities and one rate per fixed duration. Changes apply to new bookings only."
        breadcrumbs={[{ label: 'Property' }, { label: 'Room types' }]}
        actions={
          <Button iconLeft={Plus} onClick={openCreate}>
            New room type
          </Button>
        }
      />

      <Card className="overflow-hidden">
        <ResponsiveTable
          columns={columns}
          rows={roomTypes}
          rowKey={(roomType) => roomType.id}
          onRowClick={openEdit}
          loading={loading}
          error={error}
          onRetry={refresh}
          caption="Room types and their rate cards"
          empty={
            <EmptyState
              icon={BookOpen}
              title="No room types yet"
              description="A room type carries the rates every booking is priced from. Add one before adding rooms."
              action={
                <Button iconLeft={Plus} onClick={openCreate}>
                  Add the first room type
                </Button>
              }
            />
          }
        />
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Edit ${editing.typeName}` : 'New room type'}
        size="lg"
        closeOnBackdrop={false}
      >
        <form onSubmit={handleSubmit} className="space-y-7">
          <FormSection title="Details" columns={2}>
            <Input
              label="Type name"
              id="typeName"
              required
              maxLength={50}
              value={form.typeName}
              onChange={update('typeName')}
              error={fieldErrors.typeName}
            />
            <Input
              label="Capacity"
              id="capacity"
              type="number"
              min={1}
              required
              iconLeft={Users}
              value={form.capacity}
              onChange={update('capacity')}
              error={fieldErrors.capacity}
            />
            <FullWidth>
              <Textarea
                label="Amenities"
                id="amenities"
                rows={2}
                hint="Comma-separated — each becomes a chip on the public room card."
                value={form.amenities}
                onChange={update('amenities')}
                error={fieldErrors.amenities}
              />
            </FullWidth>
            <FullWidth>
              <Input
                label="Photo URL"
                id="imageUrl"
                type="url"
                hint="16:9 works best. Leave blank to show a placeholder tile."
                value={form.imageUrl}
                onChange={update('imageUrl')}
                error={fieldErrors.imageUrl}
              />
            </FullWidth>
          </FormSection>

          <FormSection
            title="Rate card"
            description="One rate per duration. Leave a duration blank to withdraw it from sale for this type."
            columns={3}
          >
            {RATE_FIELDS.map((field) => (
              <Input
                key={field.name}
                label={field.label}
                id={field.name}
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                value={form[field.name]}
                onChange={update(field.name)}
                error={fieldErrors[field.name]}
              />
            ))}
          </FormSection>

          <div className="flex flex-col-reverse gap-2 border-t border-neutral-200 pt-5 sm:flex-row sm:justify-end">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {editing ? 'Save changes' : 'Create room type'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete this room type?"
        message={
          deleteTarget
            ? `"${deleteTarget.typeName}" will be removed. A type that still has rooms assigned cannot be deleted — reassign or delete those rooms first.`
            : ''
        }
        confirmLabel="Delete room type"
      />
    </>
  )
}
