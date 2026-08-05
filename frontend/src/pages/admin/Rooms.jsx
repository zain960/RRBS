import { Bed, Pencil, Plus, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import { errorDetails, errorMessage } from '../../api/client'
import { createRoom, deleteRoom, listRooms, updateRoom, updateRoomStatus } from '../../api/rooms'
import { listRoomTypes } from '../../api/roomTypes'
import PageMeta from '../../components/PageMeta'
import {
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  FilterBar,
  FormSection,
  Input,
  Modal,
  PageHeader,
  ResponsiveTable,
  Select,
  SelectControl,
} from '../../components/ui'
import { useToast } from '../../context/ToastContext'
import { ROOM_STATUS, statusOptions } from '../../lib/statuses'

const EMPTY_FORM = { roomNumber: '', floor: '', roomTypeId: '' }

/**
 * The physical rooms (SRS §4.2).
 *
 * Status is editable inline because it is the one field the front desk changes
 * during a shift — a room going into Maintenance drops out of availability
 * immediately, and making that a two-click modal would slow down the moment it
 * matters. Check-in and check-out set it automatically; this is the manual
 * override (CLAUDE.md §4).
 */
export default function Rooms() {
  const toast = useToast()

  const [rooms, setRooms] = useState([])
  const [roomTypes, setRoomTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [filters, setFilters] = useState({ roomTypeId: '', status: '' })

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
      setRooms(await listRooms(filters))
    } catch (err) {
      setError(errorMessage(err, 'Could not load rooms.'))
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    listRoomTypes()
      .then(setRoomTypes)
      .catch(() => setRoomTypes([]))
  }, [])

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFieldErrors({})
    setModalOpen(true)
  }

  function openEdit(room) {
    setEditing(room)
    setForm({
      roomNumber: room.roomNumber,
      floor: room.floor ?? '',
      roomTypeId: String(room.roomTypeId),
    })
    setFieldErrors({})
    setModalOpen(true)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setFieldErrors({})
    setSaving(true)

    const payload = {
      roomNumber: form.roomNumber,
      floor: form.floor || null,
      roomTypeId: form.roomTypeId,
    }

    try {
      if (editing) {
        await updateRoom(editing.id, payload)
        toast.success(`Room ${payload.roomNumber} updated.`)
      } else {
        await createRoom(payload)
        toast.success(`Room ${payload.roomNumber} added.`)
      }
      setModalOpen(false)
      refresh()
    } catch (err) {
      setFieldErrors(errorDetails(err) ?? {})
      toast.error(errorMessage(err, 'Could not save the room.'))
    } finally {
      setSaving(false)
    }
  }

  async function handleStatus(room, status) {
    setStatusBusy(room.id)
    try {
      await updateRoomStatus(room.id, status)
      toast.success(`Room ${room.roomNumber} is now ${status.toLowerCase()}.`)
      refresh()
    } catch (err) {
      toast.error(errorMessage(err, 'Could not change the room status.'))
    } finally {
      setStatusBusy(null)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await deleteRoom(deleteTarget.id)
      toast.success('Room deleted.')
      setDeleteTarget(null)
      refresh()
    } catch (err) {
      toast.error(errorMessage(err, 'Could not delete the room.'))
    } finally {
      setDeleting(false)
    }
  }

  const columns = [
    {
      key: 'room',
      header: 'Room',
      primary: true,
      render: (room) => (
        <div className="min-w-0">
          <p className="font-medium text-neutral-900">Room {room.roomNumber}</p>
          <p className="text-xs text-neutral-500">
            {room.roomType?.typeName ?? '—'}
            {room.floor ? ` · Floor ${room.floor}` : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      hideBelow: 'lg',
      render: (room) => <span className="text-neutral-600">{room.roomType?.typeName ?? '—'}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (room) => (
        <div onClick={(event) => event.stopPropagation()}>
          <label htmlFor={`status-${room.id}`} className="sr-only">
            Status for room {room.roomNumber}
          </label>
          <SelectControl
            id={`status-${room.id}`}
            size="sm"
            className="w-40"
            value={room.status}
            disabled={statusBusy === room.id}
            onChange={(event) => handleStatus(room, event.target.value)}
            options={statusOptions(ROOM_STATUS)}
          />
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      width: 'w-32',
      render: (room) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            iconLeft={Pencil}
            aria-label={`Edit room ${room.roomNumber}`}
            onClick={(event) => {
              event.stopPropagation()
              openEdit(room)
            }}
          />
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            iconLeft={Trash2}
            aria-label={`Delete room ${room.roomNumber}`}
            className="text-danger hover:bg-red-50"
            onClick={(event) => {
              event.stopPropagation()
              setDeleteTarget(room)
            }}
          />
        </div>
      ),
    },
  ]

  return (
    <>
      <PageMeta title="Rooms" noIndex />

      <PageHeader
        title="Rooms"
        subtitle="Every physical room and the state it is in. Rooms under maintenance are excluded from availability."
        breadcrumbs={[{ label: 'Property' }, { label: 'Rooms' }]}
        actions={
          <Button iconLeft={Plus} onClick={openCreate}>
            New room
          </Button>
        }
      />

      <FilterBar>
        <div className="w-full sm:w-52">
          <label htmlFor="filter-type" className="sr-only">
            Filter by room type
          </label>
          <SelectControl
            id="filter-type"
            size="sm"
            value={filters.roomTypeId}
            onChange={(event) =>
              setFilters((current) => ({ ...current, roomTypeId: event.target.value }))
            }
            options={[
              { value: '', label: 'All room types' },
              ...roomTypes.map((roomType) => ({
                value: String(roomType.id),
                label: roomType.typeName,
              })),
            ]}
          />
        </div>

        <div className="w-full sm:w-44">
          <label htmlFor="filter-status" className="sr-only">
            Filter by status
          </label>
          <SelectControl
            id="filter-status"
            size="sm"
            value={filters.status}
            onChange={(event) =>
              setFilters((current) => ({ ...current, status: event.target.value }))
            }
            options={[{ value: '', label: 'All statuses' }, ...statusOptions(ROOM_STATUS)]}
          />
        </div>

        <p className="text-xs text-neutral-500 sm:ml-auto" aria-live="polite">
          {loading ? 'Loading…' : `${rooms.length} room${rooms.length === 1 ? '' : 's'}`}
        </p>
      </FilterBar>

      <Card className="overflow-hidden">
        <ResponsiveTable
          columns={columns}
          rows={rooms}
          rowKey={(room) => room.id}
          onRowClick={openEdit}
          loading={loading}
          error={error}
          onRetry={refresh}
          caption="Rooms and their current status"
          empty={
            <EmptyState
              icon={Bed}
              title={
                filters.roomTypeId || filters.status ? 'No rooms match these filters' : 'No rooms yet'
              }
              description={
                filters.roomTypeId || filters.status
                  ? 'Try clearing the filters to see the whole property.'
                  : 'Add the rooms guests will actually stay in. Each one belongs to a room type.'
              }
              action={
                filters.roomTypeId || filters.status ? (
                  <Button
                    variant="secondary"
                    onClick={() => setFilters({ roomTypeId: '', status: '' })}
                  >
                    Clear filters
                  </Button>
                ) : (
                  <Button iconLeft={Plus} onClick={openCreate}>
                    Add the first room
                  </Button>
                )
              }
            />
          }
        />
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Edit room ${editing.roomNumber}` : 'New room'}
        size="md"
        closeOnBackdrop={false}
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <FormSection columns={2}>
            <Input
              label="Room number"
              id="roomNumber"
              required
              maxLength={10}
              value={form.roomNumber}
              onChange={(event) =>
                setForm((current) => ({ ...current, roomNumber: event.target.value }))
              }
              error={fieldErrors.roomNumber}
            />
            <Input
              label="Floor"
              id="floor"
              maxLength={10}
              hint="Optional."
              value={form.floor}
              onChange={(event) => setForm((current) => ({ ...current, floor: event.target.value }))}
              error={fieldErrors.floor}
            />
            <Select
              label="Room type"
              id="roomTypeId"
              required
              fieldClassName="sm:col-span-2"
              value={form.roomTypeId}
              onChange={(event) =>
                setForm((current) => ({ ...current, roomTypeId: event.target.value }))
              }
              placeholder="Choose a room type"
              options={roomTypes.map((roomType) => ({
                value: String(roomType.id),
                label: `${roomType.typeName} · sleeps ${roomType.capacity}`,
              }))}
              error={fieldErrors.roomTypeId}
              hint="Determines the rate card this room is sold at."
            />
          </FormSection>

          <div className="flex flex-col-reverse gap-2 border-t border-neutral-200 pt-5 sm:flex-row sm:justify-end">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {editing ? 'Save changes' : 'Add room'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete this room?"
        message={
          deleteTarget
            ? `Room ${deleteTarget.roomNumber} will be removed. A room with bookings against it cannot be deleted — put it under maintenance instead.`
            : ''
        }
        confirmLabel="Delete room"
      />
    </>
  )
}
