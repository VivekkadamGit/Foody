'use client'

import { useState, useTransition } from 'react'
import { Button, Field, Input, Chip } from '@/components/admin/ui'
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
    <div>
      {restaurant.deleted_at && (
        <div className="mb-4 flex items-center justify-between rounded-2xl border border-spice/40 bg-[#fdf0ea] px-4 py-3">
          <p className="font-anek text-[14px] font-medium text-spice-dark">⚠ This restaurant is soft-deleted and hidden from the public site.</p>
          <Button variant="secondary" onClick={handleRestore} disabled={isPending}>Restore</Button>
        </div>
      )}

      <div className="flex gap-2">
        <Button variant="secondary" onClick={() => setEditing(e => !e)}>
          {editing ? 'Cancel' : 'Edit Details'}
        </Button>
        {!restaurant.deleted_at && (
          <Button variant="danger" onClick={handleDelete} disabled={isPending}>Delete</Button>
        )}
      </div>

      {editing && (
        <div className="mt-4 space-y-4 rounded-2xl border border-warm-200 bg-white p-6">
          <Field label="Name *">
            <Input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            />
          </Field>
          <Field label="Address">
            <Input
              value={form.address}
              onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
            />
          </Field>
          <Field label="Cuisine Types">
            <div className="flex flex-wrap gap-2">
              {CUISINES.map(c => (
                <Chip key={c} selected={form.cuisine_type.includes(c)} onClick={() => toggleCuisine(c)}>
                  {c}
                </Chip>
              ))}
            </div>
          </Field>
          <Field label="Price Range">
            <div className="flex gap-2">
              {[['1', '₹ Budget'], ['2', '₹₹ Mid'], ['3', '₹₹₹ Premium']].map(([val, label]) => (
                <Chip key={val} selected={form.price_range === Number(val)} onClick={() => setForm(f => ({ ...f, price_range: Number(val) }))}>
                  {label}
                </Chip>
              ))}
            </div>
          </Field>
          <Field label="Cover Image URL">
            <Input
              value={form.cover_image_url}
              onChange={e => setForm(f => ({ ...f, cover_image_url: e.target.value }))}
              placeholder="https://..."
            />
          </Field>
          {error && <p className="font-anek text-sm text-spice">{error}</p>}
          <Button onClick={handleSave} disabled={isPending} className="w-full">
            {isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      )}
    </div>
  )
}
