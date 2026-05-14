'use client'

import { useState, useTransition } from 'react'
import { updateRestaurant, softDeleteRestaurant, restoreRestaurant } from '@/app/actions/restaurants'

const CUISINES = ['gujarati', 'street food', 'chinese', 'south indian', 'north indian', 'desserts', 'fast food']

type Restaurant = {
  id: string
  name: string
  address: string | null
  cuisine_type: string[]
  price_range: number
  cover_image_url: string | null
  deleted_at: string | null
}

export default function RestaurantActions({ restaurant }: { restaurant: Restaurant }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    name: restaurant.name,
    address: restaurant.address ?? '',
    cuisine_type: restaurant.cuisine_type ?? [],
    price_range: restaurant.price_range,
    cover_image_url: restaurant.cover_image_url ?? '',
  })
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function toggleCuisine(c: string) {
    setForm(f => ({
      ...f,
      cuisine_type: f.cuisine_type.includes(c)
        ? f.cuisine_type.filter(x => x !== c)
        : [...f.cuisine_type, c],
    }))
  }

  function handleSave() {
    setError('')
    startTransition(async () => {
      try {
        await updateRestaurant(restaurant.id, {
          name: form.name,
          address: form.address,
          cuisine_type: form.cuisine_type,
          price_range: form.price_range,
          cover_image_url: form.cover_image_url,
        })
        setEditing(false)
      } catch (e: any) {
        setError(e.message)
      }
    })
  }

  function handleDelete() {
    if (!confirm('Soft-delete this restaurant? It will be hidden from the public site.')) return
    startTransition(async () => {
      try {
        await softDeleteRestaurant(restaurant.id)
      } catch (e: any) {
        setError(e.message)
      }
    })
  }

  function handleRestore() {
    startTransition(async () => {
      try {
        await restoreRestaurant(restaurant.id)
      } catch (e: any) {
        setError(e.message)
      }
    })
  }

  return (
    <div className="mt-4">
      {restaurant.deleted_at && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center justify-between">
          <p className="text-sm text-red-600 font-medium">⚠ This restaurant is soft-deleted and hidden from the public site.</p>
          <button
            onClick={handleRestore}
            disabled={isPending}
            className="text-sm text-green-700 font-semibold hover:underline disabled:opacity-50"
          >
            Restore
          </button>
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => setEditing(e => !e)}
          className="text-sm px-4 py-2 rounded-xl border border-gray-200 hover:border-orange-400 hover:text-orange-600 transition-colors"
        >
          {editing ? 'Cancel' : 'Edit Details'}
        </button>
        {!restaurant.deleted_at && (
          <button
            onClick={handleDelete}
            disabled={isPending}
            className="text-sm px-4 py-2 rounded-xl border border-red-200 text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            Delete
          </button>
        )}
      </div>

      {editing && (
        <div className="mt-4 bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <input
              value={form.address}
              onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Cuisine Types</label>
            <div className="flex flex-wrap gap-2">
              {CUISINES.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleCuisine(c)}
                  className={`text-sm px-3 py-1 rounded-full border transition-colors capitalize ${form.cuisine_type.includes(c) ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-600 border-gray-200'}`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Price Range</label>
            <div className="flex gap-2">
              {[['1', '₹ Budget'], ['2', '₹₹ Mid'], ['3', '₹₹₹ Premium']].map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, price_range: Number(val) }))}
                  className={`text-sm px-4 py-2 rounded-xl border transition-colors ${form.price_range === Number(val) ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-600 border-gray-200'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cover Image URL</label>
            <input
              value={form.cover_image_url}
              onChange={e => setForm(f => ({ ...f, cover_image_url: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-orange-400"
              placeholder="https://..."
            />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            onClick={handleSave}
            disabled={isPending}
            className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white font-bold py-2.5 rounded-xl transition-colors"
          >
            {isPending ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      )}
    </div>
  )
}
