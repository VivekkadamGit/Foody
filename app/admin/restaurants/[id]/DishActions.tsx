'use client'

import { useState, useTransition } from 'react'
import { updateDish, softDeleteDish, restoreDish } from '@/app/actions/dishes'

type Dish = {
  id: string
  name: string
  description: string | null
  is_must_try: boolean
  deleted_at: string | null
  restaurantId: string
}

export default function DishActions({ dish }: { dish: Dish }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    name: dish.name,
    description: dish.description ?? '',
    is_must_try: dish.is_must_try,
  })
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    setError('')
    startTransition(async () => {
      try {
        await updateDish(dish.id, dish.restaurantId, form)
        setEditing(false)
      } catch (e: any) {
        setError(e.message)
      }
    })
  }

  function handleDelete() {
    if (!confirm(`Soft-delete "${dish.name}"?`)) return
    startTransition(async () => {
      try {
        await softDeleteDish(dish.id, dish.restaurantId)
      } catch (e: any) {
        setError(e.message)
      }
    })
  }

  function handleRestore() {
    startTransition(async () => {
      try {
        await restoreDish(dish.id, dish.restaurantId)
      } catch (e: any) {
        setError(e.message)
      }
    })
  }

  return (
    <div>
      <div className="flex gap-2 mt-2">
        <button
          onClick={() => setEditing(e => !e)}
          className="text-xs px-3 py-1 rounded-lg border border-gray-200 hover:border-orange-400 hover:text-orange-600 transition-colors"
        >
          {editing ? 'Cancel' : 'Edit'}
        </button>
        {dish.deleted_at ? (
          <button
            onClick={handleRestore}
            disabled={isPending}
            className="text-xs px-3 py-1 rounded-lg border border-green-200 text-green-600 hover:bg-green-50 transition-colors disabled:opacity-50"
          >
            Restore
          </button>
        ) : (
          <button
            onClick={handleDelete}
            disabled={isPending}
            className="text-xs px-3 py-1 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            Delete
          </button>
        )}
      </div>

      {editing && (
        <div className="mt-3 bg-orange-50 rounded-xl p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Name *</label>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_must_try}
              onChange={e => setForm(f => ({ ...f, is_must_try: e.target.checked }))}
              className="w-4 h-4 accent-orange-500"
            />
            <span className="text-xs text-gray-700">Must Try</span>
          </label>
          {error && <p className="text-red-500 text-xs">{error}</p>}
          <button
            onClick={handleSave}
            disabled={isPending}
            className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white font-bold py-2 rounded-lg text-sm transition-colors"
          >
            {isPending ? 'Saving...' : 'Save'}
          </button>
        </div>
      )}
    </div>
  )
}
