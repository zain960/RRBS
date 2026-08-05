import { Pencil, Plus, Trash2, Utensils } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import { listCategories } from '../../api/categories'
import { errorDetails, errorMessage } from '../../api/client'
import {
  createFood,
  deleteFood,
  listFoods,
  updateFood,
  updateFoodAvailability,
} from '../../api/foods'
import { byId, listRatings } from '../../api/reviews'
import { RatingStars } from '../../components/domain/Rating'
import PageMeta from '../../components/PageMeta'
import {
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  FilterBar,
  FormSection,
  FullWidth,
  Image,
  Input,
  Modal,
  PageHeader,
  ResponsiveTable,
  Select,
  SelectControl,
  Switch,
  Textarea,
} from '../../components/ui'
import { useToast } from '../../context/ToastContext'
import { money } from '../../lib/format'
import { FOOD_AVAILABILITY, statusOptions } from '../../lib/statuses'

const EMPTY_FORM = {
  name: '',
  categoryId: '',
  description: '',
  price: '',
  imageUrl: '',
  availabilityStatus: 'AVAILABLE',
}

/**
 * The dish list (SRS §4.4).
 *
 * Availability is a switch on the row, because taking a dish off the menu is a
 * mid-service decision — the kitchen runs out and it has to disappear from
 * ordering now. An unavailable dish stays in historical orders and cannot be
 * added to a new one (CLAUDE.md §4).
 */
export default function Menu() {
  const toast = useToast()

  const [foods, setFoods] = useState([])
  const [categories, setCategories] = useState([])
  const [ratings, setRatings] = useState(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [filters, setFilters] = useState({ categoryId: '', availabilityStatus: '' })

  const [editing, setEditing] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [fieldErrors, setFieldErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [availabilityBusy, setAvailabilityBusy] = useState(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setFoods(await listFoods(filters))
    } catch (err) {
      setError(errorMessage(err, 'Could not load the menu.'))
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    listCategories()
      .then(setCategories)
      .catch(() => setCategories([]))

    listRatings('food')
      .then((rows) => setRatings(byId(rows)))
      .catch(() => setRatings(new Map()))
  }, [])

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFieldErrors({})
    setModalOpen(true)
  }

  function openEdit(food) {
    setEditing(food)
    setForm({
      name: food.name,
      categoryId: String(food.categoryId),
      description: food.description ?? '',
      price: String(food.price),
      imageUrl: food.imageUrl ?? '',
      availabilityStatus: food.availabilityStatus,
    })
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

    const payload = {
      name: form.name,
      categoryId: form.categoryId,
      description: form.description || null,
      price: form.price,
      imageUrl: form.imageUrl || null,
      availabilityStatus: form.availabilityStatus,
    }

    try {
      if (editing) {
        await updateFood(editing.id, payload)
        toast.success(`"${payload.name}" updated.`)
      } else {
        await createFood(payload)
        toast.success(`"${payload.name}" added to the menu.`)
      }
      setModalOpen(false)
      refresh()
    } catch (err) {
      setFieldErrors(errorDetails(err) ?? {})
      toast.error(errorMessage(err, 'Could not save the dish.'))
    } finally {
      setSaving(false)
    }
  }

  async function handleAvailability(food, available) {
    setAvailabilityBusy(food.id)
    const next = available ? 'AVAILABLE' : 'UNAVAILABLE'
    try {
      await updateFoodAvailability(food.id, next)
      toast.success(`"${food.name}" is now ${available ? 'available' : 'unavailable'}.`)
      refresh()
    } catch (err) {
      toast.error(errorMessage(err, 'Could not change availability.'))
    } finally {
      setAvailabilityBusy(null)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await deleteFood(deleteTarget.id)
      toast.success('Dish deleted.')
      setDeleteTarget(null)
      refresh()
    } catch (err) {
      toast.error(errorMessage(err, 'Could not delete the dish.'))
    } finally {
      setDeleting(false)
    }
  }

  const columns = [
    {
      key: 'dish',
      header: 'Dish',
      primary: true,
      render: (food) => (
        <div className="flex items-center gap-3">
          <Image
            src={food.imageUrl}
            alt=""
            aspect="aspect-[4/3]"
            rounded="rounded"
            className="w-14 shrink-0"
            sizes="56px"
            maxWidth={256}
            fallbackIcon={Utensils}
          />
          <div className="min-w-0">
            <p className="truncate font-medium text-neutral-900">{food.name}</p>
            <p className="truncate text-xs text-neutral-500">
              {food.description || 'No description'}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      hideBelow: 'md',
      render: (food) => (
        <span className="text-neutral-600">{food.category?.categoryName ?? '—'}</span>
      ),
    },
    {
      key: 'price',
      header: 'Price',
      align: 'right',
      render: (food) => (
        <span className="font-medium tabular-nums text-neutral-900">{money(food.price)}</span>
      ),
    },
    {
      key: 'rating',
      header: 'Rating',
      hideBelow: 'lg',
      render: (food) => {
        const rating = ratings.get(food.id)
        return <RatingStars value={rating?.average ?? 0} count={rating?.count} size="sm" />
      },
    },
    {
      key: 'available',
      header: 'Available',
      render: (food) => (
        <div onClick={(event) => event.stopPropagation()}>
          <Switch
            checked={food.availabilityStatus === 'AVAILABLE'}
            disabled={availabilityBusy === food.id}
            onChange={(event) => handleAvailability(food, event.target.checked)}
            aria-label={`${food.name} available`}
          />
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      width: 'w-32',
      render: (food) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            iconLeft={Pencil}
            aria-label={`Edit ${food.name}`}
            onClick={(event) => {
              event.stopPropagation()
              openEdit(food)
            }}
          />
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            iconLeft={Trash2}
            aria-label={`Delete ${food.name}`}
            className="text-danger hover:bg-red-50"
            onClick={(event) => {
              event.stopPropagation()
              setDeleteTarget(food)
            }}
          />
        </div>
      ),
    },
  ]

  const filtered = filters.categoryId || filters.availabilityStatus

  return (
    <>
      <PageMeta title="Dishes" noIndex />

      <PageHeader
        title="Dishes"
        subtitle="Everything the kitchen can cook. Switch a dish off and it disappears from ordering immediately."
        breadcrumbs={[{ label: 'Menu' }, { label: 'Dishes' }]}
        actions={
          <Button iconLeft={Plus} onClick={openCreate}>
            New dish
          </Button>
        }
      />

      <FilterBar>
        <div className="w-full sm:w-52">
          <label htmlFor="filter-category" className="sr-only">
            Filter by category
          </label>
          <SelectControl
            id="filter-category"
            size="sm"
            value={filters.categoryId}
            onChange={(event) =>
              setFilters((current) => ({ ...current, categoryId: event.target.value }))
            }
            options={[
              { value: '', label: 'All categories' },
              ...categories.map((category) => ({
                value: String(category.id),
                label: category.categoryName,
              })),
            ]}
          />
        </div>

        <div className="w-full sm:w-44">
          <label htmlFor="filter-availability" className="sr-only">
            Filter by availability
          </label>
          <SelectControl
            id="filter-availability"
            size="sm"
            value={filters.availabilityStatus}
            onChange={(event) =>
              setFilters((current) => ({ ...current, availabilityStatus: event.target.value }))
            }
            options={[{ value: '', label: 'All dishes' }, ...statusOptions(FOOD_AVAILABILITY)]}
          />
        </div>

        <p className="text-xs text-neutral-500 sm:ml-auto" aria-live="polite">
          {loading ? 'Loading…' : `${foods.length} dish${foods.length === 1 ? '' : 'es'}`}
        </p>
      </FilterBar>

      <Card className="overflow-hidden">
        <ResponsiveTable
          columns={columns}
          rows={foods}
          rowKey={(food) => food.id}
          onRowClick={openEdit}
          loading={loading}
          error={error}
          onRetry={refresh}
          caption="Menu dishes"
          empty={
            <EmptyState
              icon={Utensils}
              title={filtered ? 'No dishes match these filters' : 'No dishes yet'}
              description={
                filtered
                  ? 'Try clearing the filters to see the whole menu.'
                  : 'Add the dishes the kitchen serves. Each one belongs to a category.'
              }
              action={
                filtered ? (
                  <Button
                    variant="secondary"
                    onClick={() => setFilters({ categoryId: '', availabilityStatus: '' })}
                  >
                    Clear filters
                  </Button>
                ) : (
                  <Button iconLeft={Plus} onClick={openCreate}>
                    Add the first dish
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
        title={editing ? `Edit ${editing.name}` : 'New dish'}
        size="lg"
        closeOnBackdrop={false}
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <FormSection columns={2}>
            <Input
              label="Dish name"
              id="name"
              required
              maxLength={100}
              value={form.name}
              onChange={update('name')}
              error={fieldErrors.name}
            />
            <Select
              label="Category"
              id="categoryId"
              required
              value={form.categoryId}
              onChange={update('categoryId')}
              placeholder="Choose a category"
              options={categories.map((category) => ({
                value: String(category.id),
                label: category.categoryName,
              }))}
              error={fieldErrors.categoryId}
            />
            <Input
              label="Price"
              id="price"
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              required
              value={form.price}
              onChange={update('price')}
              error={fieldErrors.price}
            />
            <Select
              label="Availability"
              id="availabilityStatus"
              required
              value={form.availabilityStatus}
              onChange={update('availabilityStatus')}
              options={statusOptions(FOOD_AVAILABILITY)}
              error={fieldErrors.availabilityStatus}
            />
            <FullWidth>
              <Textarea
                label="Description"
                id="description"
                rows={2}
                maxLength={300}
                hint="One line about what's in it — shown on the guest menu."
                value={form.description}
                onChange={update('description')}
                error={fieldErrors.description}
              />
            </FullWidth>
            <FullWidth>
              <Input
                label="Photo URL"
                id="imageUrl"
                type="url"
                hint="4:3 works best. Leave blank to show a placeholder tile."
                value={form.imageUrl}
                onChange={update('imageUrl')}
                error={fieldErrors.imageUrl}
              />
            </FullWidth>
          </FormSection>

          <div className="flex flex-col-reverse gap-2 border-t border-neutral-200 pt-5 sm:flex-row sm:justify-end">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {editing ? 'Save changes' : 'Add dish'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete this dish?"
        message={
          deleteTarget
            ? `"${deleteTarget.name}" will be removed from the menu. If it appears in past orders, mark it unavailable instead so those records keep their item.`
            : ''
        }
        confirmLabel="Delete dish"
      />
    </>
  )
}
