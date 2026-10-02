'use client'

import { useState, useTransition } from 'react'
import { Button, Field, Input, Textarea } from '@/components/admin/ui'
import { updateReview, softDeleteReview, restoreReview } from '@/app/actions/reviews'

type Review = {
  id: string
  rating: number
  taste_notes: string | null
  visit_date: string
  deleted_at: string | null
  restaurantId: string
  testerName: string
}

export default function ReviewActions({ review }: { review: Review }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    rating: review.rating,
    taste_notes: review.taste_notes ?? '',
    visit_date: review.visit_date,
  })
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    setError('')
    startTransition(async () => {
      try {
        await updateReview(review.id, review.restaurantId, form)
        setEditing(false)
      } catch (e: any) {
        setError(e.message)
      }
    })
  }

  function handleDelete() {
    if (!confirm('Soft-delete this review?')) return
    startTransition(async () => {
      try {
        await softDeleteReview(review.id, review.restaurantId)
      } catch (e: any) {
        setError(e.message)
      }
    })
  }

  function handleRestore() {
    startTransition(async () => {
      try {
        await restoreReview(review.id, review.restaurantId)
      } catch (e: any) {
        setError(e.message)
      }
    })
  }

  return (
    <div className={`rounded-xl border p-3 ${review.deleted_at ? 'border-spice/30 bg-[#fdf0ea] opacity-60' : 'border-warm-100 bg-cream'}`}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-anek text-xs font-semibold text-charcoal">✓ {review.testerName}</span>
          <span className="text-xs text-amber-400">{'★'.repeat(review.rating)}</span>
          <span className="font-anek text-xs text-muted">{review.visit_date}</span>
          {review.deleted_at && <span className="rounded-full bg-warm-100 px-2 py-0.5 font-anek text-xs text-muted">deleted</span>}
        </div>
        <div className="flex gap-1">
          <Button variant="secondary" className="!px-2.5 !py-1 !text-xs" onClick={() => setEditing(e => !e)}>
            {editing ? 'Cancel' : 'Edit'}
          </Button>
          {review.deleted_at ? (
            <Button variant="secondary" className="!px-2.5 !py-1 !text-xs" onClick={handleRestore} disabled={isPending}>
              Restore
            </Button>
          ) : (
            <Button variant="danger" className="!px-2.5 !py-1 !text-xs" onClick={handleDelete} disabled={isPending}>
              Delete
            </Button>
          )}
        </div>
      </div>

      {review.taste_notes && !editing && (
        <p className="font-anek text-sm text-charcoal">{review.taste_notes}</p>
      )}

      {editing && (
        <div className="mt-2 space-y-3">
          <Field label="Rating">
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, rating: star }))}
                  className={`text-xl transition-transform hover:scale-110 ${star <= form.rating ? 'text-amber-400' : 'text-warm-200'}`}
                >
                  ★
                </button>
              ))}
            </div>
          </Field>
          <Field label="Taste Notes">
            <Textarea
              value={form.taste_notes}
              onChange={e => setForm(f => ({ ...f, taste_notes: e.target.value }))}
              rows={2}
            />
          </Field>
          <Field label="Visit Date">
            <Input
              type="date"
              value={form.visit_date}
              onChange={e => setForm(f => ({ ...f, visit_date: e.target.value }))}
            />
          </Field>
          {error && <p className="font-anek text-xs text-spice">{error}</p>}
          <Button onClick={handleSave} disabled={isPending} className="w-full">
            {isPending ? 'Saving...' : 'Save'}
          </Button>
        </div>
      )}
    </div>
  )
}
