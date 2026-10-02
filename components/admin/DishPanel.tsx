'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { createDish, restoreDish, softDeleteDish, updateDish } from '@/app/actions/dishes'
import { EMPTY_TAGS, type DishTags } from '@/lib/admin/dishTags'
import { parseScore } from '@/lib/admin/score'
import type { AdminDish } from '@/lib/admin/types'
import SidePanel from './SidePanel'
import TagPicker from './TagPicker'
import { Button, Field, Input, Select, Textarea } from './ui'
import { useToast } from './Toast'

type Form = {
  restaurant_id: string
  name: string
  description: string
  score: string
  is_must_try: boolean
  photo_url: string | null
  tags: DishTags
}

function formFrom(dish: AdminDish | null, presetRestaurantId?: string): Form {
  if (!dish) return { restaurant_id: presetRestaurantId ?? '', name: '', description: '', score: '', is_must_try: false, photo_url: null, tags: EMPTY_TAGS }
  return {
    restaurant_id: dish.restaurant_id,
    name: dish.name,
    description: dish.description ?? '',
    score: dish.score === null ? '' : String(dish.score),
    is_must_try: dish.is_must_try,
    photo_url: dish.photo_url,
    tags: { diet: dish.diet, category: dish.category, cuisine: dish.cuisine, tastes: dish.tastes, meals: dish.meals },
  }
}

export default function DishPanel({
  dish, restaurants, presetRestaurantId, open, onClose, onSaved, onSaveNext,
}: {
  dish: AdminDish | null
  restaurants: { id: string; name: string }[]
  presetRestaurantId?: string
  open: boolean
  onClose: () => void
  onSaved: (id: string) => void
  onSaveNext?: () => void
}) {
  const router = useRouter()
  const toast = useToast()
  const initial = useMemo(() => formFrom(dish, presetRestaurantId), [dish, presetRestaurantId])
  const [form, setForm] = useState<Form>(initial)
  const [photo, setPhoto] = useState<File | null>(null)
  const [busy, setBusy] = useState<null | 'save' | 'next' | 'delete'>(null)
  const [error, setError] = useState('')

  const initialRef = useRef(initial)
  initialRef.current = initial
  const resetKey = open ? (dish?.id ?? 'new') : null
  useEffect(() => {
    if (resetKey === null) return
    setForm(initialRef.current)
    setPhoto(null)
    setFileKey((k) => k + 1)
    setError('')
  }, [resetKey])

  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [fileKey, setFileKey] = useState(0)
  useEffect(() => {
    if (!photo) { setPreviewUrl(null); return }
    const url = URL.createObjectURL(photo)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [photo])

  const dirty = photo !== null || JSON.stringify(form) !== JSON.stringify(initial)
  const isNew = dish === null

  function close() {
    if (dirty && !window.confirm('Discard your unsaved changes?')) return
    onClose()
  }

  async function uploadPhoto(restaurantId: string): Promise<string | null> {
    if (!photo) return form.photo_url
    const supabase = createClient()
    const ext = photo.name.split('.').pop()
    const path = `dishes/${restaurantId}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('dish-photos').upload(path, photo)
    if (error) throw new Error(`Photo upload failed: ${error.message}`)
    return supabase.storage.from('dish-photos').getPublicUrl(path).data.publicUrl
  }

  async function save(mode: 'save' | 'next') {
    setBusy(mode)
    setError('')
    try {
      const score = parseScore(form.score)
      if (!form.restaurant_id) throw new Error('Pick a restaurant')
      const photo_url = await uploadPhoto(form.restaurant_id)
      const fields = {
        name: form.name,
        description: form.description.trim() || null,
        is_must_try: form.is_must_try,
        score,
        photo_url,
        ...form.tags,
      }
      const id = isNew
        ? (await createDish({ restaurant_id: form.restaurant_id, ...fields })).id
        : (await updateDish(dish.id, fields), dish.id)
      setPhoto(null)
      setFileKey((k) => k + 1)
      setForm((f) => ({
        ...f,
        name: f.name.trim(),
        description: f.description.trim(),
        score: score === null ? '' : String(score),
        photo_url,
      }))
      toast('Saved')
      router.refresh()
      onSaved(id)
      if (mode === 'next' && onSaveNext) onSaveNext()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(null)
    }
  }

  async function toggleDeleted() {
    if (!dish) return
    if (!dish.deleted_at && !window.confirm(`Delete "${dish.name}"? You can restore it from the Deleted tab.`)) return
    setBusy('delete')
    try {
      await (dish.deleted_at ? restoreDish(dish.id) : softDeleteDish(dish.id))
      toast(dish.deleted_at ? 'Restored' : 'Deleted')
      router.refresh()
      onClose()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const restaurantName = restaurants.find((r) => r.id === form.restaurant_id)?.name

  return (
    <SidePanel
      open={open}
      onClose={close}
      title={isNew ? 'Add a dish' : form.name || 'Untitled dish'}
      subtitle={restaurantName}
      footer={
        <div className="space-y-3">
          {error && <p role="alert" className="font-anek text-[13.5px] text-spice">{error}</p>}
          <div className="flex items-center gap-2">
            {!isNew && (
              <Button variant="danger" type="button" loading={busy === 'delete'} disabled={busy !== null} onClick={toggleDeleted}>
                {dish.deleted_at ? 'Restore' : 'Delete'}
              </Button>
            )}
            <div className="ml-auto flex gap-2">
              <Button variant="secondary" type="button" loading={busy === 'save'} disabled={busy !== null} onClick={() => save('save')}>Save</Button>
              {onSaveNext && (
                <Button type="button" loading={busy === 'next'} disabled={busy !== null} onClick={() => save('next')}>Save &amp; next →</Button>
              )}
            </div>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        {isNew && !presetRestaurantId && (
          <Field label="Restaurant" htmlFor="restaurant">
            <Select id="restaurant" value={form.restaurant_id} onChange={(e) => setForm({ ...form, restaurant_id: e.target.value })}>
              <option value="">Choose a restaurant…</option>
              {restaurants.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </Select>
          </Field>
        )}
        <Field label="Dish name" htmlFor="name">
          <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <div className="grid grid-cols-[1fr_auto] items-end gap-4">
          <Field label="Score" htmlFor="score" hint="0–10. Blank keeps it out of rankings.">
            <Input id="score" inputMode="decimal" placeholder="e.g. 8.5" value={form.score} onChange={(e) => setForm({ ...form, score: e.target.value })} />
          </Field>
          <label className="mb-7 flex cursor-pointer items-center gap-2 font-anek text-[14px] text-charcoal">
            <input type="checkbox" className="h-4 w-4 accent-[#d9482b]" checked={form.is_must_try} onChange={(e) => setForm({ ...form, is_must_try: e.target.checked })} />
            🏅 Must try
          </label>
        </div>
        <Field label="Description" htmlFor="desc">
          <Textarea id="desc" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Field>
        <Field label="Photo" htmlFor="photo">
          <div className="flex items-center gap-3">
            {(previewUrl || form.photo_url) && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl ?? form.photo_url!} alt="" className="h-16 w-16 rounded-lg object-cover" />
            )}
            <input key={fileKey} id="photo" type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
              className="min-w-0 flex-1 font-anek text-[13px] text-muted file:mr-3 file:rounded-full file:border-0 file:bg-warm-100 file:px-3 file:py-1.5 file:font-semibold file:text-charcoal" />
            {(photo || form.photo_url) && (
              <button type="button" className="font-anek text-[13px] text-muted hover:text-spice" onClick={() => { setPhoto(null); setFileKey((k) => k + 1); setForm({ ...form, photo_url: null }) }}>
                Remove
              </button>
            )}
          </div>
        </Field>
        <div className="border-t border-warm-100 pt-5">
          <TagPicker value={form.tags} onChange={(tags) => setForm({ ...form, tags })} />
        </div>
      </div>
    </SidePanel>
  )
}
