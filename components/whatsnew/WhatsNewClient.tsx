'use client'

import { useState } from 'react'
import FreshlyTastedCard, { FreshlyTasted } from './FreshlyTastedCard'
import TrendingCard, { TrendingEntry } from './TrendingCard'

export type CityNews = {
  citySlug: string
  cityName: string
  freshlyTasted: FreshlyTasted[]
  trending: TrendingEntry[]
}

export default function WhatsNewClient({ news }: { news: CityNews[] }) {
  const [activeSlug, setActiveSlug] = useState(news[0]?.citySlug ?? '')
  const active = news.find((n) => n.citySlug === activeSlug) ?? news[0]

  if (!active) {
    return (
      <p className="font-body text-muted py-16 text-center">
        No cities are live yet.
      </p>
    )
  }

  return (
    <div>
      {/* One chip row drives both columns, so the page always reads as one city's news. */}
      {news.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-10">
          {news.map((n) => (
            <button
              key={n.citySlug}
              onClick={() => setActiveSlug(n.citySlug)}
              className={`font-body text-xs px-4 py-2 border uppercase tracking-widest transition-colors ${
                n.citySlug === active.citySlug
                  ? 'bg-spice text-white border-spice'
                  : 'bg-white text-charcoal border-warm-200 hover:border-spice hover:text-spice'
              }`}
            >
              {n.cityName}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-8">
        <section>
          <h2 className="font-display text-2xl font-bold text-charcoal">Freshly tasted</h2>
          <p className="font-body text-sm text-muted mt-1 mb-5">
            The most recent dishes we actually sat down and ate in {active.cityName}.
          </p>

          {active.freshlyTasted.length === 0 ? (
            <p className="font-body text-sm text-muted border border-warm-200 rounded-2xl p-6">
              Nothing scored in {active.cityName} yet. We&apos;d rather show you nothing than
              something we haven&apos;t tasted.
            </p>
          ) : (
            <div className="space-y-3">
              {active.freshlyTasted.map((d) => (
                <FreshlyTastedCard key={d.id} dish={d} />
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="font-display text-2xl font-bold text-charcoal">Trending right now</h2>
          {/* The honesty line. This column is the one place on Chakh showing food we
              haven't eaten, so it says so plainly rather than relying on styling alone. */}
          <p className="font-body text-sm text-muted mt-1 mb-5">
            We haven&apos;t tasted these. No score, no badge — just what {active.cityName}{' '}
            won&apos;t shut up about.
          </p>

          {active.trending.length === 0 ? (
            <p className="font-body text-sm text-muted border border-dashed border-warm-200 rounded-2xl p-6">
              Nothing&apos;s blowing up in {active.cityName} right now.
            </p>
          ) : (
            <div className="space-y-3">
              {active.trending.map((t) => (
                <TrendingCard key={t.id} entry={t} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
