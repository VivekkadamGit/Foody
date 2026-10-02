'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { dishStatus } from '@/lib/admin/dishStatus'
import type { AdminDish } from '@/lib/admin/types'
import DishPanel from './DishPanel'
import { Button, EmptyState, Input, StatusBadge } from './ui'
import { useToast } from './Toast'

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'needs_score', label: 'Needs score' },
  { key: 'needs_tags', label: 'Needs tags' },
  { key: 'deleted', label: 'Deleted' },
] as const
type TabKey = (typeof TABS)[number]['key']

function inTab(d: AdminDish, tab: TabKey): boolean {
  if (tab === 'deleted') return d.deleted_at !== null
  if (d.deleted_at) return false
  if (tab === 'needs_score') return d.score === null
  if (tab === 'needs_tags') return dishStatus(d) === 'needs_tags'
  return true
}

export default function DishList({
  dishes, restaurants, presetRestaurantId, initialTab = 'all', showTabs = true,
}: {
  dishes: AdminDish[]
  restaurants: { id: string; name: string }[]
  presetRestaurantId?: string
  initialTab?: string
  showTabs?: boolean
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const tab: TabKey = (TABS.some((t) => t.key === initialTab) ? initialTab : 'all') as TabKey
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState<string | 'new' | null>(null)

  const counts = useMemo(
    () => Object.fromEntries(TABS.map((t) => [t.key, dishes.filter((d) => inTab(d, t.key)).length])) as Record<TabKey, number>,
    [dishes]
  )
  const visible = dishes
    .filter((d) => inTab(d, tab))
    .filter((d) => d.name.toLowerCase().includes(query.trim().toLowerCase()))

  const current = openId && openId !== 'new' ? dishes.find((d) => d.id === openId) ?? null : null

  const lastDish = useRef<AdminDish | null>(null)
  if (current) lastDish.current = current

  function setTab(key: TabKey) {
    const qs = new URLSearchParams(params.toString())
    qs.set('tab', key)
    router.replace(`${pathname}?${qs.toString()}`, { scroll: false })
  }

  // `visible` is the list as it was when the panel opened (the refresh after saving
  // lands later), so "next" is simply the following row.
  function openNext() {
    const idx = visible.findIndex((d) => d.id === openId)
    const next = visible[idx + 1]
    if (next) setOpenId(next.id)
    else {
      setOpenId(null)
      toast('That was the last one')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {showTabs && TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            aria-current={tab === t.key ? 'page' : undefined}
            className={`rounded-full border px-3.5 py-1.5 font-anek text-[13.5px] font-medium ${
              tab === t.key ? 'border-charcoal bg-charcoal text-white' : 'border-warm-200 bg-white text-charcoal hover:border-charcoal/40'
            }`}
          >
            {t.label}
            <span className={`ml-1.5 rounded-full px-1.5 text-[11px] ${t.key !== 'all' && t.key !== 'deleted' && counts[t.key] > 0 ? 'bg-ember text-white' : 'text-muted'}`}>
              {counts[t.key]}
            </span>
          </button>
        ))}
        <div className="ml-auto flex w-full gap-2 sm:w-auto">
          <Input placeholder="Filter by name…" value={query} onChange={(e) => setQuery(e.target.value)} className="sm:w-56" aria-label="Filter dishes by name" />
          <Button type="button" onClick={() => setOpenId('new')} className="whitespace-nowrap">+ Add dish</Button>
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState icon={tab === 'all' ? '🍽️' : '✓'} text={tab === 'all' ? 'No dishes yet.' : 'Nothing here — all caught up.'} />
      ) : (
        <ul className="overflow-hidden rounded-2xl border border-warm-200 bg-white">
          {visible.map((d) => (
            <li key={d.id} className="border-t border-warm-100 first:border-t-0">
              <button
                type="button"
                onClick={() => setOpenId(d.id)}
                className={`flex w-full min-w-0 items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-[#fdf6f2] ${openId === d.id ? 'bg-[#fdf0ea]' : ''}`}
              >
                {d.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={d.photo_url} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover" />
                ) : (
                  <div className="h-11 w-11 shrink-0 rounded-lg" style={{ background: 'repeating-linear-gradient(135deg,#ece7dd 0 7px,#e2dcd1 7px 14px)' }} />
                )}
                <div className="min-w-0 flex-1">
                  <p className={`truncate font-anek text-[15.5px] font-semibold ${d.deleted_at ? 'text-muted line-through' : 'text-charcoal'}`}>{d.name}</p>
                  <p className="truncate font-anek text-[13px] text-muted">{d.restaurant_name}</p>
                </div>
                <StatusBadge status={dishStatus(d)} />
                <span className="w-10 text-right font-barlow text-xl font-bold text-charcoal">{d.score === null ? '—' : d.score.toFixed(1)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <DishPanel
        open={openId !== null}
        dish={openId === 'new' ? null : (current ?? (openId === null ? lastDish.current : null))}
        restaurants={restaurants}
        presetRestaurantId={presetRestaurantId}
        onClose={() => setOpenId(null)}
        // A new dish isn't in `dishes` until the refresh lands, so close rather than
        // re-open it as a blank form.
        onSaved={() => { if (openId === 'new') setOpenId(null) }}
        onSaveNext={openId === 'new' ? undefined : openNext}
      />
    </div>
  )
}
