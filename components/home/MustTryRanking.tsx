'use client'

import { useState } from 'react'
import Link from 'next/link'
import { confidenceLabel, confidenceTier } from '@/lib/dishScore'

export type RankedDish = {
  id: string
  name: string
  restaurantName: string
  restaurantArea: string | null
  priceSymbol: string
  score: number
  reviewCount: number
  isMustTry: boolean
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
  const [filter, setFilter] = useState<'all' | 'confirmed'>('all')
  const visible = (filter === 'confirmed' ? dishes.filter((d) => d.reviewCount >= 3) : dishes).slice(0, 5)

  return (
    <div>
      <div className="flex items-end justify-between mb-5.5 flex-wrap gap-3">
        <div>
          <p className="font-anek text-[11.5px] font-semibold uppercase tracking-[0.18em] text-gold2 mb-2.5">Must try</p>
          <h2 className="font-anek text-[36px] font-bold tracking-tight text-[#fdf9f4] m-0">The best of {cityName}</h2>
        </div>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`font-anek text-[12.5px] font-semibold px-3.5 py-1.5 rounded-full transition-colors ${
              filter === 'all' ? 'bg-ember-light text-ink' : 'border border-white/[0.16] text-sand'
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setFilter('confirmed')}
            className={`font-anek text-[12.5px] font-medium px-3.5 py-1.5 rounded-full transition-colors ${
              filter === 'confirmed' ? 'bg-ember-light text-ink' : 'border border-white/[0.16] text-sand'
            }`}
          >
            Confirmed only
          </button>
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="font-anek text-sand text-sm">No confirmed dishes yet — check back soon.</p>
      ) : (
        <div className="grid gap-px bg-white/[0.08] border border-white/[0.08] rounded-xl overflow-hidden">
          {visible.map((dish, i) => (
            <div
              key={dish.id}
              className="grid grid-cols-[32px_1fr_auto] sm:grid-cols-[52px_86px_1fr_152px_72px] items-center gap-3 sm:gap-4 px-4 sm:px-[18px] py-3.5 bg-ink"
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
              <div className="justify-self-start sm:justify-self-auto">
                <span
                  className={`font-anek text-[9.5px] font-semibold px-1.5 py-1 rounded border tracking-wide whitespace-nowrap ${
                    confidenceTier(dish.reviewCount) === 'CONFIRMED'
                      ? 'bg-confirmed/[0.14] border-confirmed/40 text-confirmed'
                      : confidenceTier(dish.reviewCount) === 'HOLDING_UP'
                      ? 'bg-gold2/[0.16] border-gold2/40 text-gold2'
                      : 'bg-white/[0.07] border-white/[0.16] text-sand'
                  }`}
                >
                  {confidenceLabel(dish.reviewCount)}
                </span>
              </div>
              <div className="font-barlow text-[27px] leading-none font-bold text-[#fdf9f4] text-right">
                {dish.score.toFixed(1)}
              </div>
            </div>
          ))}
          <Link
            href={`/${citySlug}`}
            className="block px-[18px] py-3.5 bg-ink font-anek text-[13.5px] font-semibold text-ember-light hover:text-ember transition-colors"
          >
            Show all {totalCount} scored dishes
          </Link>
        </div>
      )}
    </div>
  )
}
