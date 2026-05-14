'use client'

import { useState, useTransition } from 'react'
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
    <div className={`rounded-xl p-3 ${review.deleted_at ? 'bg-red-50 border border-red-100 opacity-60' : 'bg-orange-50'}`}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-orange-700">✓ {review.testerName}</span>
          <span className="text-amber-500 text-xs">{'★'.repeat(review.rating)}</span>
          <span className="text-xs text-gray-400">{review.visit_date}</span>
          {review.deleted_at && <span className="text-xs bg-red-100 text-red-500 px-2 py-0.5 rounded-full">deleted</span>}
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setEditing(e => !e)}
            className="text-xs px-2 py-0.5 rounded border border-gray-200 hover:border-orange-400 hover:text-orange-600 transition-colors bg-white"
          >
            {editing ? 'Cancel' : 'Edit'}
          </button>
          {review.deleted_at ? (
            <button
              onClick={handleRestore}
              disabled={isPending}
              className="text-xs px-2 py-0.5 rounded border border-green-200 text-green-600 hover:bg-green-50 transition-colors bg-white disabled:opacity-50"
            >
              Restore
            </button>
          ) : (
            <button
              onClick={handleDelete}
              disabled={isPending}
              className="text-xs px-2 py-0.5 rounded border border-red-200 text-red-500 hover:bg-red-50 transition-colors bg-white disabled:opacity-50"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {review.taste_notes && !editing && (
        <p className="text-sm text-gray-600">{review.taste_notes}</p>
      )}

      {editing && (
        <div className="mt-2 space-y-2">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Rating</label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, rating: star }))}
                  className={`text-xl transition-transform hover:scale-110 ${star <= form.rating ? 'text-amber-400' : 'text-gray-200'}`}
                >
                  ★
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Taste Notes</label>
            <textarea
              value={form.taste_notes}
              onChange={e => setForm(f => ({ ...f, taste_notes: e.target.value }))}
              rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none bg-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Visit Date</label>
            <input
              type="date"
              value={form.visit_date}
              onChange={e => setForm(f => ({ ...f, visit_date: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
            />
          </div>
          {error && <p className="text-red-500 text-xs">{error}</p>}
          <button
            onClick={handleSave}
            disabled={isPending}
            className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white font-bold py-1.5 rounded-lg text-sm transition-colors"
          >
            {isPending ? 'Saving...' : 'Save'}
          </button>
        </div>
      )}
    </div>
  )
}
