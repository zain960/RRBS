import { useEffect, useState } from 'react'

import { errorDetails, errorMessage } from '../../api/client'
import { createReview } from '../../api/reviews'
import { useToast } from '../../context/ToastContext'
import { Button, Modal, Textarea } from '../ui'
import { RatingInput } from './Rating'

/**
 * "Leave review" dialog (SRS §4.9).
 *
 * `target` is `{ bookingId }` or `{ orderId }` plus a `label` for the heading —
 * the API accepts exactly one of the two and rejects a second review for the
 * same target, so the caller only has to hide the button once one exists.
 */
export default function ReviewDialog({ open, target, onClose, onSaved }) {
  const toast = useToast()
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [saving, setSaving] = useState(false)

  // A fresh form each time it opens, so the previous review is not carried over.
  useEffect(() => {
    if (open) {
      setRating(0)
      setComment('')
      setFieldErrors({})
    }
  }, [open, target])

  async function handleSubmit(event) {
    event.preventDefault()

    if (!rating) {
      setFieldErrors({ rating: 'Choose a rating from 1 to 5.' })
      return
    }

    setSaving(true)
    setFieldErrors({})

    try {
      const review = await createReview({
        bookingId: target?.bookingId,
        orderId: target?.orderId,
        rating,
        comment,
      })
      toast.success('Thanks — your review has been recorded.')
      onSaved?.(review)
      onClose()
    } catch (error) {
      setFieldErrors(errorDetails(error) ?? {})
      // 409 REVIEW_EXISTS / REVIEW_TARGET_NOT_COMPLETE arrive with a clear message.
      toast.error(errorMessage(error, 'Could not save your review.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Review ${target?.label ?? ''}`.trim()}
      description="Reviews help other guests and tell us what to fix."
      size="sm"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <span className="mb-2 block text-sm font-medium text-neutral-800">How was it?</span>
          <RatingInput value={rating} onChange={setRating} error={fieldErrors.rating} />
        </div>

        <Textarea
          label="Comment"
          id="review-comment"
          rows={4}
          maxLength={2000}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          placeholder="What stood out?"
          hint="Optional."
          error={fieldErrors.comment}
        />

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" type="button" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            Submit review
          </Button>
        </div>
      </form>
    </Modal>
  )
}
