'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  createTrending, markTrendingVisited, restoreTrending, softDeleteTrending, updateTrending,
} from '@/app/actions/trending'
import { EMPTY_TAGS, type DishTags } from '@/lib/admin/dishTags'
import type { AdminTrending } from '@/lib/admin/types'
import SidePanel from './SidePanel'
import TagPicker from './TagPicker'
import { Button, Field, Input, Select, Textarea } from './ui'
import { useToast } from './Toast'

type Form = {
  dish_name: string; place_name: string; area: string; why: string; source_url: string
  restaurant_id: string; rank: string; buzz: number; photo_url: string | null; tags: DishTags
}

function formFrom(t: AdminTrending | null): Form {
  if (!t) return { dish_name: '', place_name: '', area: '', why: '', source_url: '', restaurant_id: '', rank: '0', buzz: 1, photo_url: null, tags: EMPTY_TAGS }
  return {
    dish_name: t.dish_name, place_name: t.place_name, area: t.area ?? '', why: t.why, source_url: t.source_url ?? '',
    restaurant_id: t.restaurant_id ?? '', rank: String(t.rank), buzz: t.buzz, photo_url: t.photo_url,
    tags: { diet: t.diet, category: t.category, cuisine: t.cuisine, tastes: t.tastes, meals: t.meals },
  }
}

export default function TrendingPanel({
  entry, cityId, restaurants, dishes, open, onClose,
}: {
  entry: AdminTrending | null
  cityId: string
  restaurants: { id: string; name: string }[]
  dishes: { id: string; name: string; restaurant_name: string }[]
  open: boolean
  onClose: () => void
}) {
  const router = useRouter()
  const toast = useToast()
  const initial = useMemo(() => formFrom(entry), [entry])
  const [form, setForm] = useState<Form>(initial)
  const [photo, setPhoto] = useState<File | null>(null)
  const [visitDish, setVisitDish] = useState('')
  const [busy, setBusy] = useState<null | 'save' | 'delete' | 'visit'>(null)
  const [error, setError] = useState('')
  const [fileKey, setFileKey] = useState(0)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  // Reset per open (not per object identity) so a fresh "Add place" form is blank
  // and a background refresh doesn't wipe in-progress edits.
  const initialRef = useRef(initial); initialRef.current = initial
  const resetKey = open ? (entry?.id ?? 'new') : null
  useEffect(() => {
    if (resetKey === null) return
    setForm(initialRef.current); setPhoto(null); setFileKey((k) => k + 1); setVisitDish(''); setError('')
  }, [resetKey])

  useEffect(() => {
    if (!photo) { setPreviewUrl(null); return }
    const url = URL.createObjectURL(photo)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [photo])

  const dirty = photo !== null || JSON.stringify(form) !== JSON.stringify(initial)
  const isNew = entry === null

  function close() {
    if (dirty && !window.confirm('Discard your unsaved changes?')) return
    onClose()
  }

  async function run(kind: 'save' | 'delete' | 'visit', fn: () => Promise<void>, done: string) {
    setBusy(kind); setError('')
    try { await fn(); toast(done); router.refresh(); onClose() }
    catch (err) { setError((err as Error).message) }
    finally { setBusy(null) }
  }

  async function save() {
    await run('save', async () => {
      let photo_url = form.photo_url
      if (photo) {
        const supabase = createClient()
        const path = `trending/${cityId}/${Date.now()}.${photo.name.split('.').pop()}`
        const { error } = await supabase.storage.from('dish-photos').upload(path, photo)
        if (error) throw new Error(`Photo upload failed: ${error.message}`)
        photo_url = supabase.storage.from('dish-photos').getPublicUrl(path).data.publicUrl
      }
      const rank = Number(form.rank)
      if (!Number.isInteger(rank)) throw new Error('Rank must be a whole number')
      const data = {
        dish_name: form.dish_name.trim(), place_name: form.place_name.trim(), city_id: cityId,
        restaurant_id: form.restaurant_id || null, area: form.area.trim() || null, why: form.why.trim(),
        source_url: form.source_url.trim() || null, photo_url, rank, buzz: form.buzz, ...form.tags,
      }
      if (isNew) await createTrending(data)
      else await updateTrending(entry.id, data)
      setPhoto(null); setFileKey((k) => k + 1)
    }, 'Saved')
  }

  return (
    <SidePanel
      open={open}
      onClose={close}
      title={isNew ? 'Add a place' : `${form.dish_name} @ ${form.place_name}`}
      subtitle="On our list · never scored"
      footer={
        <div className="space-y-3">
          {error && <p role="alert" className="font-anek text-[13.5px] text-spice">{error}</p>}
          {!isNew && !entry.visited_dish_id && !entry.deleted_at && (
            <div className="flex gap-2">
              <Select aria-label="Dish we reviewed" value={visitDish} onChange={(e) => setVisitDish(e.target.value)}>
                <option value="">We visited — pick the dish we reviewed…</option>
                {dishes.map((d) => <option key={d.id} value={d.id}>{d.name} · {d.restaurant_name}</option>)}
              </Select>
              <Button variant="secondary" type="button" disabled={!visitDish || busy !== null} loading={busy === 'visit'}
                onClick={() => run('visit', () => markTrendingVisited(entry.id, visitDish), 'Marked visited')}>
                Mark visited
              </Button>
            </div>
          )}
          <div className="flex items-center gap-2">
            {!isNew && (
              <Button variant="danger" type="button" loading={busy === 'delete'}
                onClick={() => {
                  if (!entry.deleted_at && !window.confirm('Remove this place from the list?')) return
                  run('delete', () => (entry.deleted_at ? restoreTrending(entry.id) : softDeleteTrending(entry.id)), entry.deleted_at ? 'Restored' : 'Deleted')
                }}>
                {entry.deleted_at ? 'Restore' : 'Delete'}
              </Button>
            )}
            <Button className="ml-auto" type="button" loading={busy === 'save'} disabled={busy !== null} onClick={save}>Save</Button>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Dish" htmlFor="t-dish"><Input id="t-dish" value={form.dish_name} onChange={(e) => setForm({ ...form, dish_name: e.target.value })} /></Field>
          <Field label="Place" htmlFor="t-place"><Input id="t-place" value={form.place_name} onChange={(e) => setForm({ ...form, place_name: e.target.value })} /></Field>
        </div>
        <Field label="Area" htmlFor="t-area"><Input id="t-area" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} /></Field>
        <Field label="Why it's buzzing" htmlFor="t-why" hint="Shown on the card. Required.">
          <Textarea id="t-why" rows={2} value={form.why} onChange={(e) => setForm({ ...form, why: e.target.value })} />
        </Field>
        <Field label="Buzz">
          <div className="inline-flex overflow-hidden rounded-lg border border-warm-200" role="radiogroup" aria-label="Buzz">
            {[1, 2, 3].map((n) => (
              <button key={n} type="button" role="radio" aria-checked={form.buzz === n} onClick={() => setForm({ ...form, buzz: n })}
                className={`px-4 py-2 font-anek text-[15px] ${form.buzz === n ? 'bg-ember text-white' : 'bg-white hover:bg-warm-100'}`}>
                {'🔥'.repeat(n)}
              </button>
            ))}
          </div>
        </Field>
        <div className="grid grid-cols-[1fr_96px] gap-3">
          <Field label="Seen on (link)" htmlFor="t-src"><Input id="t-src" placeholder="https://…" value={form.source_url} onChange={(e) => setForm({ ...form, source_url: e.target.value })} /></Field>
          <Field label="Rank" htmlFor="t-rank" hint="Lower first"><Input id="t-rank" inputMode="numeric" value={form.rank} onChange={(e) => setForm({ ...form, rank: e.target.value })} /></Field>
        </div>
        <Field label="We have this restaurant" htmlFor="t-rest" hint="Optional — links the card to our page.">
          <Select id="t-rest" value={form.restaurant_id} onChange={(e) => setForm({ ...form, restaurant_id: e.target.value })}>
            <option value="">Not yet</option>
            {restaurants.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </Select>
        </Field>
        <Field label="Photo" htmlFor="t-photo">
          <div className="flex items-center gap-3">
            {(previewUrl || form.photo_url) && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl ?? form.photo_url!} alt="" className="h-16 w-16 rounded-lg object-cover" />
            )}
          <input key={fileKey} id="t-photo" type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
            className="min-w-0 flex-1 font-anek text-[13px] text-muted file:mr-3 file:rounded-full file:border-0 file:bg-warm-100 file:px-3 file:py-1.5 file:font-semibold file:text-charcoal" />
          </div>
        </Field>
        <div className="border-t border-warm-100 pt-5">
          <TagPicker value={form.tags} onChange={(tags) => setForm({ ...form, tags })} />
        </div>
      </div>
    </SidePanel>
  )
}
