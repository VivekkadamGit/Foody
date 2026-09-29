import Link from 'next/link'
import { formatScore } from '@/lib/dishScore'

export type FreshlyTasted = {
  id: string
  name: string
  score: number | null
  isMustTry: boolean
  restaurantId: string
  restaurantName: string
  area: string | null
  citySlug: string
  cityName: string
  photoUrl: string | null
  lastVisit: string | null
  /** True when a Trending entry pointed at this dish before we went. */
  cameFromTrending: boolean
}

function formatVisit(date: string | null): string | null {
  if (!date) return null
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function FreshlyTastedCard({ dish }: { dish: FreshlyTasted }) {
  const visited = formatVisit(dish.lastVisit)

  return (
    <Link
      href={`/${dish.citySlug}/${dish.restaurantId}`}
      className="group flex gap-4 bg-white border border-warm-200 rounded-2xl p-4 hover:border-spice transition-colors duration-150"
    >
      {dish.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={dish.photoUrl}
          alt={dish.name}
          className="w-20 h-20 rounded-xl object-cover flex-shrink-0"
        />
      ) : (
        <div className="w-20 h-20 rounded-xl bg-warm-100 flex items-center justify-center flex-shrink-0">
          <span className="font-display text-2xl text-warm-200">🍽</span>
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-display text-lg font-bold text-charcoal leading-snug truncate group-hover:text-spice transition-colors">
              {dish.name}
            </h3>
            <p className="font-body text-sm text-muted truncate">
              {dish.restaurantName}
              {dish.area ? ` · ${dish.area}` : ''}
            </p>
          </div>

          <span className="flex-shrink-0 font-anek text-xl font-bold text-charcoal tabular-nums">
            {formatScore(dish.score)}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-2">
          {dish.isMustTry && (
            <span className="inline-flex items-center gap-1 rounded-full border border-gold2/50 bg-gold2/20 px-2 py-0.5 font-anek text-[10px] font-bold tracking-wide text-[#8a6a2f]">
              🏅 MUST TRY
            </span>
          )}
          {visited && (
            <span className="font-body text-xs text-muted">Tasted {visited}</span>
          )}
        </div>

        {/* The payoff of the Trending column: we said we'd go, and we went. */}
        {dish.cameFromTrending && (
          <p className="font-body text-xs text-spice mt-2">
            You told us about this one. We went.
          </p>
        )}
      </div>
    </Link>
  )
}
