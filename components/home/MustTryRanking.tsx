'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { QUALITY_LEGEND, QualityTier, qualityTier } from '@/lib/dishScore'
import QualityBadge from './QualityBadge'

export type RankedDish = {
  id: string
  name: string
  restaurantName: string
  restaurantArea: string | null
  priceRange: number
  priceSymbol: string
  cuisineTypes: string[]
  score: number
  reviewCount: number
  isMustTry: boolean
}

const PRICE_OPTIONS = [
  { label: '₹', value: 1 },
  { label: '₹₹', value: 2 },
  { label: '₹₹₹', value: 3 },
]

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`font-anek text-[12.5px] font-medium px-3.5 py-1.5 rounded-full transition-colors whitespace-nowrap ${
        active ? 'bg-ember-light text-ink font-semibold' : 'border border-white/[0.16] text-sand hover:border-white/30'
      }`}
    >
      {children}
    </button>
  )
}

function QualityFilter({
  selected,
  onToggle,
  onClear,
}: {
  selected: Set<QualityTier>
  onToggle: (tier: QualityTier) => void
  onClear: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <Pill active={selected.size > 0} onClick={() => setOpen((v) => !v)}>
        Quality {selected.size > 0 ? `(${selected.size})` : ''} <span className="ml-0.5">▾</span>
      </Pill>

      {open && (
        <div className="absolute z-20 top-full left-0 mt-2 w-[300px] rounded-xl border border-white/10 bg-ink-card shadow-2xl p-1.5">
          {QUALITY_LEGEND.map((row) => {
            const isSelected = selected.has(row.tier)
            return (
              <button
                key={row.tier}
                type="button"
                onClick={() => onToggle(row.tier)}
                className={`w-full flex items-start gap-2.5 rounded-lg px-2.5 py-2.5 text-left transition-colors ${
                  isSelected ? 'bg-white/[0.06]' : 'hover:bg-white/[0.04]'
                }`}
              >
                <span className="text-base leading-none mt-0.5">{row.icon}</span>
                <span className="flex-1 min-w-0">
                  <span className="font-anek text-[13.5px] font-semibold text-[#fdf9f4] block">{row.label}</span>
                  <span className="font-anek text-[12px] text-sand-dark block leading-snug">{row.description}</span>
                </span>
                <span
                  className={`w-4 h-4 rounded border flex-shrink-0 mt-0.5 flex items-center justify-center ${
                    isSelected ? 'bg-ember-light border-ember-light' : 'border-white/25'
                  }`}
                >
                  {isSelected && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#17110e" strokeWidth={3.5}>
                      <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
              </button>
            )
          })}
          {selected.size > 0 && (
            <button
              type="button"
              onClick={onClear}
              className="w-full text-left px-2.5 pt-1.5 pb-1 font-anek text-[12px] font-semibold text-ember-light hover:text-ember transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default function MustTryRanking({
  dishes,
  cityName,
  citySlug,
  totalCount,
}: {
  dishes: RankedDish[]
  cityName: string
  citySlug: string
  totalCount: number
}) {
  const [cuisine, setCuisine] = useState<string | null>(null)
  const [price, setPrice] = useState<number | null>(null)
  const [qualityFilter, setQualityFilter] = useState<Set<QualityTier>>(new Set())
  const [visibleCount, setVisibleCount] = useState(8)

  const cuisines = useMemo(
    () => Array.from(new Set(dishes.flatMap((d) => d.cuisineTypes))).filter(Boolean).sort(),
    [dishes]
  )

  const toggleQuality = (tier: QualityTier) => {
    setQualityFilter((prev) => {
      const next = new Set(prev)
      if (next.has(tier)) next.delete(tier)
      else next.add(tier)
      return next
    })
  }

  const filtered = dishes.filter(
    (d) =>
      (!cuisine || d.cuisineTypes.includes(cuisine)) &&
      (!price || d.priceRange === price) &&
      (qualityFilter.size === 0 || qualityFilter.has(qualityTier(d.score, d.reviewCount)))
  )
  const visible = filtered.slice(0, visibleCount)
  const hasFilters = cuisine !== null || price !== null || qualityFilter.size > 0

  return (
    <div>
      <div className="mb-5">
        <p className="font-anek text-[11.5px] font-semibold uppercase tracking-[0.18em] text-gold2 mb-2.5">Must try</p>
        <h2 className="font-anek text-[36px] font-bold tracking-tight text-[#fdf9f4] m-0 mb-4">The best of {cityName}</h2>

        {/* Filter bar — real filters, not tasted/visit status */}
        <div className="flex flex-wrap items-center gap-2">
          <Pill
            active={!hasFilters}
            onClick={() => { setCuisine(null); setPrice(null); setQualityFilter(new Set()) }}
          >
            All
          </Pill>
          <QualityFilter selected={qualityFilter} onToggle={toggleQuality} onClear={() => setQualityFilter(new Set())} />
          {PRICE_OPTIONS.map((p) => (
            <Pill key={p.value} active={price === p.value} onClick={() => setPrice((v) => (v === p.value ? null : p.value))}>
              {p.label}
            </Pill>
          ))}
          {cuisines.map((c) => (
            <Pill key={c} active={cuisine === c} onClick={() => setCuisine((v) => (v === c ? null : c))}>
              {c}
            </Pill>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="font-anek text-sand text-sm">No dishes match those filters yet — try clearing one.</p>
      ) : (
        <div className="grid gap-px bg-white/[0.08] border border-white/[0.08] rounded-xl overflow-hidden">
          {visible.map((dish, i) => (
            <div
              key={dish.id}
              className="grid grid-cols-[32px_1fr_auto] sm:grid-cols-[52px_86px_1fr_auto_72px] items-center gap-3 sm:gap-4 px-4 sm:px-[18px] py-3.5 bg-ink"
            >
              <div className={`font-barlow text-[28px] leading-none font-bold ${i === 0 ? 'text-ember-light' : 'text-sand-darker'} hidden sm:block`}>
                {String(i + 1).padStart(2, '0')}
              </div>
              <div
                className="h-[58px] rounded-md hidden sm:block"
                style={{ background: 'repeating-linear-gradient(135deg,#2b211c 0 7px,#221a16 7px 14px)' }}
              />
              <div className="min-w-0">
                <p className="font-anek text-[16.5px] font-semibold text-[#fdf9f4] leading-[1.25] truncate m-0">{dish.name}</p>
                <p className="font-anek text-[12.5px] text-sand-dark truncate m-0">
                  {dish.restaurantName}
                  {dish.restaurantArea ? `, ${dish.restaurantArea}` : ''} · {dish.priceSymbol}
                </p>
              </div>
              <div className="justify-self-start sm:justify-self-center">
                <QualityBadge score={dish.score} reviewCount={dish.reviewCount} />
              </div>
              <div className="font-barlow text-[27px] leading-none font-bold text-[#fdf9f4] text-right">
                {dish.score.toFixed(1)}
              </div>
            </div>
          ))}
          {visibleCount < filtered.length ? (
            <button
              type="button"
              onClick={() => setVisibleCount((v) => v + 10)}
              className="block w-full text-left px-[18px] py-3.5 bg-ink font-anek text-[13.5px] font-semibold text-ember-light hover:text-ember transition-colors"
            >
              Show more ({filtered.length - visibleCount} left)
            </button>
          ) : (
            <Link
              href={`/${citySlug}`}
              className="block px-[18px] py-3.5 bg-ink font-anek text-[13.5px] font-semibold text-ember-light hover:text-ember transition-colors"
            >
              See all {totalCount} dishes in {cityName}
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
