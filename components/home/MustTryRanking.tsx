'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { qualityIcon, qualityLabel, qualityTier } from '@/lib/dishScore'

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
  const [topOnly, setTopOnly] = useState(false)
  const [visibleCount, setVisibleCount] = useState(8)

  const cuisines = useMemo(
    () => Array.from(new Set(dishes.flatMap((d) => d.cuisineTypes))).filter(Boolean).sort(),
    [dishes]
  )

  const filtered = dishes.filter(
    (d) =>
      (!cuisine || d.cuisineTypes.includes(cuisine)) &&
      (!price || d.priceRange === price) &&
      (!topOnly || d.score >= 9.0)
  )
  const visible = filtered.slice(0, visibleCount)
  const hasFilters = cuisine !== null || price !== null || topOnly

  return (
    <div>
      <div className="mb-5">
        <p className="font-anek text-[11.5px] font-semibold uppercase tracking-[0.18em] text-gold2 mb-2.5">Must try</p>
        <h2 className="font-anek text-[36px] font-bold tracking-tight text-[#fdf9f4] m-0 mb-4">The best of {cityName}</h2>

        {/* Filter bar — real filters, not tasted/visit status */}
        <div className="flex flex-wrap items-center gap-2">
          <Pill active={!hasFilters} onClick={() => { setCuisine(null); setPrice(null); setTopOnly(false) }}>
            All
          </Pill>
          <Pill active={topOnly} onClick={() => setTopOnly((v) => !v)}>
            🔥 Top rated
          </Pill>
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
          {visible.map((dish, i) => {
            const tier = qualityTier(dish.score, dish.reviewCount)
            return (
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
                <div className="justify-self-start sm:justify-self-center text-xl" title={qualityLabel(tier)}>
                  {qualityIcon(tier)}
                </div>
                <div className="font-barlow text-[27px] leading-none font-bold text-[#fdf9f4] text-right">
                  {dish.score.toFixed(1)}
                </div>
              </div>
            )
          })}
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
