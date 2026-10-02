'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createCity, deleteCity, updateCity } from '@/app/actions/cities'
import { slugify, type CityStatus } from '@/lib/admin/city'
import SidePanel from './SidePanel'
import { Button, EmptyState, Field, Input } from './ui'
import { useToast } from './Toast'

export type AdminCity = {
  id: string
  name: string
  slug: string
  status: CityStatus
  /** All restaurants, soft-deleted included — this is what blocks a delete. */
  restaurants: number
  liveRestaurants: number
  dishes: number
}

type Form = { name: string; slug: string; status: CityStatus; slugTouched: boolean }

const STATUS_LABEL: Record<CityStatus, string> = { active: 'Live', coming_soon: 'Coming soon' }

export default function CityList({ cities }: { cities: AdminCity[] }) {
  const router = useRouter()
  const toast = useToast()
  const [openId, setOpenId] = useState<string | 'new' | null>(null)
  const current = openId && openId !== 'new' ? cities.find((c) => c.id === openId) ?? null : null
  const lastCity = useRef<AdminCity | null>(null)
  if (current) lastCity.current = current
  else if (openId === 'new') lastCity.current = null
  const shown = openId === 'new' ? null : current ?? (openId === null ? lastCity.current : null)

  const [form, setForm] = useState<Form>({ name: '', slug: '', status: 'active', slugTouched: false })
  const [busy, setBusy] = useState<null | 'save' | 'delete'>(null)
  const [error, setError] = useState('')

  const resetKey = openId === null ? null : openId
  const shownRef = useRef(shown)
  shownRef.current = shown
  useEffect(() => {
    if (resetKey === null) return
    const c = shownRef.current
    setForm(c ? { name: c.name, slug: c.slug, status: c.status, slugTouched: true } : { name: '', slug: '', status: 'active', slugTouched: false })
    setError('')
  }, [resetKey])

  const initial = shown ? { name: shown.name, slug: shown.slug, status: shown.status } : { name: '', slug: '', status: 'active' as CityStatus }
  const dirty = form.name !== initial.name || form.slug !== initial.slug || form.status !== initial.status

  function close() {
    if (dirty && !window.confirm('Discard your unsaved changes?')) return
    setOpenId(null)
  }

  async function save() {
    setBusy('save'); setError('')
    try {
      const input = { name: form.name, slug: form.slug, status: form.status }
      if (openId === 'new') await createCity(input)
      else if (shown) await updateCity(shown.id, input)
      toast('Saved')
      router.refresh()
      setOpenId(null)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(null)
    }
  }

  async function remove() {
    if (!shown || !window.confirm(`Delete ${shown.name}? This can't be undone.`)) return
    setBusy('delete'); setError('')
    try {
      await deleteCity(shown.id)
      toast('Deleted')
      router.refresh()
      setOpenId(null)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button type="button" onClick={() => setOpenId('new')}>+ Add city</Button>
      </div>

      {cities.length === 0 ? (
        <EmptyState icon="🏙" text="No cities yet." />
      ) : (
        <ul className="overflow-hidden rounded-2xl border border-warm-200 bg-white">
          {cities.map((c) => (
            <li key={c.id} className="border-t border-warm-100 first:border-t-0">
              <button type="button" onClick={() => setOpenId(c.id)} className="flex w-full min-w-0 items-center gap-4 px-4 py-3.5 text-left hover:bg-[#fdf6f2]">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-anek text-[15.5px] font-semibold text-charcoal">{c.name}</p>
                  <p className="truncate font-anek text-[13px] text-muted">/{c.slug}</p>
                </div>
                <span className="hidden font-anek text-[13px] text-muted sm:inline">
                  {c.liveRestaurants} {c.liveRestaurants === 1 ? 'restaurant' : 'restaurants'} · {c.dishes} {c.dishes === 1 ? 'dish' : 'dishes'}
                </span>
                <span className={`whitespace-nowrap rounded-full border px-2.5 py-0.5 font-anek text-[11.5px] font-semibold ${
                  c.status === 'active' ? 'border-[#bfe6d2] bg-[#eaf7f0] text-[#1f7a52]' : 'border-warm-200 bg-warm-100 text-muted'
                }`}>
                  {STATUS_LABEL[c.status]}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <SidePanel
        open={openId !== null}
        onClose={close}
        title={openId === 'new' ? 'Add a city' : shown?.name ?? ''}
        subtitle={shown ? `${shown.liveRestaurants} restaurants · ${shown.dishes} dishes` : undefined}
        footer={
          <div className="space-y-3">
            {error && <p role="alert" className="font-anek text-[13.5px] text-spice">{error}</p>}
            <div className="flex items-center gap-2">
              {shown && (
                <Button variant="danger" type="button" loading={busy === 'delete'} disabled={busy !== null || shown.restaurants > 0} onClick={remove}
                  title={shown.restaurants > 0 ? 'Move or delete its restaurants first' : undefined}>
                  Delete
                </Button>
              )}
              <Button className="ml-auto" type="button" loading={busy === 'save'} disabled={busy !== null} onClick={save}>Save</Button>
            </div>
            {shown && shown.restaurants > 0 && (
              <p className="font-anek text-[12.5px] text-muted">A city with restaurants can&apos;t be deleted — move or delete its restaurants first.</p>
            )}
          </div>
        }
      >
        <div className="space-y-5">
          <Field label="City name" htmlFor="c-name">
            <Input id="c-name" value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value, slug: f.slugTouched ? f.slug : slugify(e.target.value) }))} />
          </Field>
          <Field label="Slug" htmlFor="c-slug" hint={`Used in links: /${form.slug || 'city-name'}. Changing it breaks old links.`}>
            <Input id="c-slug" value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value, slugTouched: true }))} />
          </Field>
          <Field label="Status">
            <div className="inline-flex overflow-hidden rounded-lg border border-warm-200" role="radiogroup" aria-label="Status">
              {(['active', 'coming_soon'] as const).map((s) => (
                <button key={s} type="button" role="radio" aria-checked={form.status === s} onClick={() => setForm((f) => ({ ...f, status: s }))}
                  className={`px-4 py-2 font-anek text-[14px] ${form.status === s ? 'bg-ember text-white' : 'bg-white hover:bg-warm-100'}`}>
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          </Field>
          <p className="font-anek text-[13px] text-muted">
            <b>Live</b> cities are browsable and searchable. <b>Coming soon</b> cities show as a locked tile on the homepage.
          </p>
        </div>
      </SidePanel>
    </div>
  )
}
