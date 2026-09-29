import Link from 'next/link'
import type { TrendingDish } from '@/types/database'

export type TrendingEntry = Pick<
  TrendingDish,
  'id' | 'dish_name' | 'place_name' | 'area' | 'why' | 'source_url' | 'photo_url' | 'restaurant_id'
> & { citySlug: string }

/** Strips a URL down to its host, so "Seen on instagram.com" reads cleanly. */
function sourceHost(url: string | null): string | null {
  if (!url) return null
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

export default function TrendingCard({ entry }: { entry: TrendingEntry }) {
  const host = sourceHost(entry.source_url)

  // Deliberately NOT a Link wrapper. A trending card is not a verdict, and making the
  // whole thing clickable would imply we have a page about it. Only the source and the
  // optional real restaurant are clickable.
  return (
    <article className="flex gap-4 rounded-2xl border border-dashed border-warm-200 bg-warm-50/60 p-4">
      {entry.photo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={entry.photo_url}
          alt={entry.dish_name}
          className="w-20 h-20 rounded-xl object-cover flex-shrink-0 opacity-90"
        />
      ) : (
        <div className="w-20 h-20 rounded-xl border border-dashed border-warm-200 flex items-center justify-center flex-shrink-0">
          <span className="text-2xl">🔥</span>
        </div>
      )}

      <div className="min-w-0 flex-1">
        <h3 className="font-display text-lg font-bold text-charcoal leading-snug">
          {entry.dish_name}
        </h3>
        <p className="font-body text-sm text-muted">
          {entry.place_name}
          {entry.area ? ` · ${entry.area}` : ''}
        </p>

        <p className="font-body text-sm text-charcoal/80 mt-2 leading-relaxed">{entry.why}</p>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2.5">
          {/* Stands where the score sits on a tasted card — so the absence is stated, not just empty. */}
          <span className="inline-flex items-center gap-1 rounded-full border border-warm-200 px-2 py-0.5 font-anek text-[10px] font-bold tracking-wide text-muted">
            🌱 NOT TASTED YET
          </span>

          {host && (
            <a
              href={entry.source_url!}
              target="_blank"
              rel="noopener noreferrer"
              className="font-body text-xs text-muted underline underline-offset-2 hover:text-spice transition-colors"
            >
              Seen on {host}
            </a>
          )}

          {entry.restaurant_id && (
            <Link
              href={`/${entry.citySlug}/${entry.restaurant_id}`}
              className="font-body text-xs text-spice hover:underline underline-offset-2"
            >
              We have this place →
            </Link>
          )}
        </div>
      </div>
    </article>
  )
}
