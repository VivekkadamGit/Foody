import Link from 'next/link'
import QualityBadge from '@/components/home/QualityBadge'
import type { DishHit } from '@/lib/search/types'

export default function DishResultCard({
  dish,
  citySlug,
  position,
  eyebrow,
}: {
  dish: DishHit
  citySlug: string
  /** #1, #2 … on ranked lists only. */
  position?: number
  /** e.g. "Best Cakes & Bakes" on the City's Best board. */
  eyebrow?: string
}) {
  return (
    <Link
      href={`/${citySlug}/${dish.restaurantId}`}
      className="flex min-w-0 items-center gap-4 rounded-2xl border border-warm-200 bg-white p-4 hover:border-ember/50 transition-colors"
    >
      {position !== undefined && (
        <span className="font-barlow text-3xl font-bold text-ember w-10 text-center flex-shrink-0">#{position}</span>
      )}
      <div className="min-w-0 flex-1">
        {eyebrow && (
          <p className="font-anek text-[10px] font-bold uppercase tracking-[0.15em] text-ember m-0">{eyebrow}</p>
        )}
        <p className="font-anek text-[16px] font-semibold text-[#1c1611] truncate m-0">{dish.name}</p>
        <p className="font-anek text-[13px] text-sand-dark truncate m-0">
          {dish.restaurantName}
          {dish.area ? `, ${dish.area}` : ''} · {dish.priceSymbol}
        </p>
      </div>
      <div className="flex items-center gap-2.5 flex-shrink-0">
        {dish.score === null ? (
          <span className="font-anek text-[11px] text-sand-dark whitespace-nowrap">Not rated yet</span>
        ) : (
          <>
            <QualityBadge score={dish.score} isMustTry={dish.isMustTry} size="sm" dark={false} />
            <span className="font-barlow text-2xl font-bold text-[#1c1611]">{dish.score.toFixed(1)}</span>
          </>
        )}
      </div>
    </Link>
  )
}
