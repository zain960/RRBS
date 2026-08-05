import { Pencil, Plus, Tags, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import {
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
} from '../../api/categories'
import { errorDetails, errorMessage } from '../../api/client'
import PageMeta from '../../components/PageMeta'
import {
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  ResponsiveTable,
} from '../../components/ui'
import { useToast } from '../../context/ToastContext'
import { number } from '../../lib/format'

/** Menu categories (SRS §4.4). A category groups dishes; deleting one that still has dishes is refused server-side. */
export default function Categories() {
  const toast = useToast()

  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [editing, setEditing] = useState(null)
  const [formOpen, setFormOpen] = useState(false)
  const [categoryName, setCategoryName] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setCategories(await listCategories())
    } catch (err) {
      setError(errorMessage(err, 'Could not load categories.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  function openCreate() {
    setEditing(null)
    setCategoryName('')
    setFieldErrors({})
    setFormOpen(true)
  }

  function openEdit(category) {
    setEditing(category)
    setCategoryName(category.categoryName)
    setFieldErrors({})
    setFormOpen(true)
  }

  async function handleSave(event) {
    event.preventDefault()
    setSaving(true)
    setFieldErrors({})
    try {
      if (editing) {
        await updateCategory(editing.id, { categoryName })
        toast.success('Category updated.')
      } else {
        await createCategory({ categoryName })
        toast.success('Category added.')
      }
      setFormOpen(false)
      refresh()
    } catch (err) {
      setFieldErrors(errorDetails(err) ?? {})
      toast.error(errorMessage(err, 'Could not save the category.'))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await deleteCategory(deleteTarget.id)
      toast.success('Category deleted.')
      setDeleteTarget(null)
      refresh()
    } catch (err) {
      // 409 CATEGORY_IN_USE arrives with a clear message naming the dish count.
      toast.error(errorMessage(err, 'Could not delete the category.'))
    } finally {
      setDeleting(false)
    }
  }

  const columns = [
    {
      key: 'name',
      header: 'Category',
      primary: true,
      render: (category) => (
        <span className="font-medium text-neutral-900">{category.categoryName}</span>
      ),
    },
    {
      key: 'foods',
      header: 'Dishes',
      align: 'right',
      render: (category) => (
        <span className="tabular-nums text-neutral-600">{number(category.foodCount ?? 0)}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      width: 'w-32',
      render: (category) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            iconLeft={Pencil}
            aria-label={`Edit ${category.categoryName}`}
            onClick={(event) => {
              event.stopPropagation()
              openEdit(category)
            }}
          />
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            iconLeft={Trash2}
            aria-label={`Delete ${category.categoryName}`}
            className="text-danger hover:bg-red-50"
            onClick={(event) => {
              event.stopPropagation()
              setDeleteTarget(category)
            }}
          />
        </div>
      ),
    },
  ]

  return (
    <>
      <PageMeta title="Categories" noIndex />

      <PageHeader
        title="Categories"
        subtitle="How the menu is grouped for guests and for the kitchen."
        breadcrumbs={[{ label: 'Menu' }, { label: 'Categories' }]}
        actions={
          <Button iconLeft={Plus} onClick={openCreate}>
            New category
          </Button>
        }
      />

      <Card className="overflow-hidden">
        <ResponsiveTable
          columns={columns}
          rows={categories}
          rowKey={(category) => category.id}
          onRowClick={openEdit}
          loading={loading}
          error={error}
          onRetry={refresh}
          caption="Menu categories"
          empty={
            <EmptyState
              icon={Tags}
              title="No categories yet"
              description="Categories group dishes on the menu. Add one before you add dishes."
              action={
                <Button iconLeft={Plus} onClick={openCreate}>
                  Add the first category
                </Button>
              }
            />
          }
        />
      </Card>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Edit category' : 'New category'}
        size="sm"
        closeOnBackdrop={false}
      >
        <form onSubmit={handleSave} className="space-y-5">
          <Input
            label="Category name"
            id="categoryName"
            required
            autoFocus
            value={categoryName}
            onChange={(event) => setCategoryName(event.target.value)}
            error={fieldErrors.categoryName}
            hint="Shown as a tab on the public menu."
          />

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" type="button" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {editing ? 'Save changes' : 'Add category'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete this category?"
        message={
          deleteTarget
            ? `"${deleteTarget.categoryName}" will be removed. Categories that still have dishes cannot be deleted — move or remove those first.`
            : ''
        }
        confirmLabel="Delete category"
      />
    </>
  )
}
