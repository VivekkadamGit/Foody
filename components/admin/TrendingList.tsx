'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { isUntagged } from '@/lib/taxonomy'
import type { AdminTrending } from '@/lib/admin/types'
import TrendingPanel from './TrendingPanel'
import { Button, EmptyState, StatusBadge } from './ui'

const TABS = [
  { key: 'live', label: 'Live' },
  { key: 'visited', label: 'Visited' },
  { key: 'deleted', label: 'Deleted' },
] as const
type TabKey = (typeof TABS)[number]['key']

function inTab(t: AdminTrending, tab: TabKey): boolean {
  if (tab === 'deleted') return t.deleted_at !== null
  if (t.deleted_at) return false
  if (tab === 'visited') return t.visited_dish_id !== null
  return t.visited_dish_id === null
}

export default function TrendingList({
  entries, cityId, restaurants, dishes, initialTab = 'live',
}: {
  entries: AdminTrending[]
  cityId: string
  restaurants: { id: string; name: string }[]
  dishes: { id: string; name: string; restaurant_name: string }[]
  initialTab?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const tab: TabKey = (TABS.some((t) => t.key === initialTab) ? initialTab : 'live') as TabKey
  const [openId, setOpenId] = useState<string | 'new' | null>(null)

  const counts = useMemo(
    () => Object.fromEntries(TABS.map((t) => [t.key, entries.filter((e) => inTab(e, t.key)).length])) as Record<TabKey, number>,
    [entries]
  )
  const visible = entries.filter((e) => inTab(e, tab))

  const current = openId && openId !== 'new' ? entries.find((e) => e.id === openId) ?? null : null

  const lastEntry = useRef<AdminTrending | null>(null)
  if (current) lastEntry.current = current
  else if (openId === 'new') lastEntry.current = null

  function setTab(key: TabKey) {
    const qs = new URLSearchParams(params.toString())
    qs.set('tab', key)
    router.replace(`${pathname}?${qs.toString()}`, { scroll: false })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
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
            <span className="ml-1.5 rounded-full px-1.5 text-[11px] text-muted">{counts[t.key]}</span>
          </button>
        ))}
        <div className="ml-auto">
          <Button type="button" onClick={() => setOpenId('new')} className="whitespace-nowrap">+ Add place</Button>
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={tab === 'live' ? '🔥' : '✓'}
          text={tab === 'live' ? 'Nothing on the list. Add a place the city is talking about.' : 'Nothing here.'}
        />
      ) : (
        <ul className="overflow-hidden rounded-2xl border border-warm-200 bg-white">
          {visible.map((t) => (
            <li key={t.id} className="border-t border-warm-100 first:border-t-0">
              <button
                type="button"
                onClick={() => setOpenId(t.id)}
                className={`flex w-full min-w-0 items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-[#fdf6f2] ${openId === t.id ? 'bg-[#fdf0ea]' : ''}`}
              >
                <span className="w-14 shrink-0 text-[15px]">{'🔥'.repeat(t.buzz)}</span>
                <div className="min-w-0 flex-1">
                  <p className={`truncate font-anek text-[15.5px] font-semibold ${t.deleted_at ? 'text-muted line-through' : 'text-charcoal'}`}>{t.dish_name}</p>
                  <p className="truncate font-anek text-[13px] text-muted">{t.place_name}{t.area ? ' · ' + t.area : ''}</p>
                </div>
                {isUntagged(t) && <StatusBadge status="needs_tags" />}
                <span className="font-anek text-[13px] text-muted">#{t.rank}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <TrendingPanel
        open={openId !== null}
        entry={openId === 'new' ? null : (current ?? (openId === null ? lastEntry.current : null))}
        cityId={cityId}
        restaurants={restaurants}
        dishes={dishes}
        onClose={() => setOpenId(null)}
      />
    </div>
  )
}
