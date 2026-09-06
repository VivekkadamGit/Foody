import Link from 'next/link'

type CityStat = { name: string; slug: string; dishCount: number; locked?: boolean }

function LockIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  )
}

export default function CitiesGrid({ cities, homeSlug }: { cities: CityStat[]; homeSlug?: string }) {
  return (
    <section className="bg-ink px-6 py-13 sm:py-[52px] border-t border-white/[0.06]">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
          <div>
            <p className="font-anek text-[11.5px] font-semibold uppercase tracking-[0.18em] text-gold2 mb-3">Cities</p>
            <h2 className="font-anek text-[32px] font-bold tracking-tight text-[#fdf9f4] m-0">One city at a time, properly</h2>
          </div>
          <p className="font-anek text-[13px] text-sand-dark m-0">A city opens with its first dish and gets deeper from there.</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {cities.map((city) => {
            const isHome = city.slug === homeSlug
            const hasDishes = city.dishCount > 0

            if (city.locked) {
              return (
                <div
                  key={city.slug}
                  aria-disabled="true"
                  className="rounded-xl p-5 border border-dashed border-white/[0.10] opacity-60 cursor-not-allowed"
                >
                  <div className="flex justify-between items-baseline mb-2.5">
                    <span className="font-anek text-[19px] font-semibold text-sand-dark">{city.name}</span>
                    <span className="flex items-center gap-1 font-anek text-[9.5px] font-semibold px-2 py-1 rounded bg-white/[0.06] text-sand-darker tracking-wide">
                      <LockIcon /> LOCKED
                    </span>
                  </div>
                  <p className="font-anek text-[13px] m-0 text-sand-darker">Coming soon</p>
                </div>
              )
            }

            return (
              <Link
                key={city.slug}
                href={`/${city.slug}`}
                className={`rounded-xl p-5 transition-colors ${
                  isHome
                    ? 'border border-ember-light/35 bg-ink-card hover:bg-ink-card/80'
                    : hasDishes
                    ? 'border border-white/[0.09] hover:border-white/20'
                    : 'border border-dashed border-white/[0.16] hover:border-white/25'
                }`}
              >
                <div className="flex justify-between items-baseline mb-2.5">
                  <span className={`font-anek text-[19px] font-semibold ${hasDishes ? 'text-[#fdf9f4]' : 'text-sand'}`}>
                    {city.name}
                  </span>
                  {isHome && (
                    <span className="font-anek text-[9.5px] font-semibold px-2 py-1 rounded bg-ember-light text-ink tracking-wide">
                      HOME
                    </span>
                  )}
                </div>
                <p className={`font-anek text-[13px] m-0 ${hasDishes ? 'text-sand' : 'text-sand-darker'}`}>
                  {hasDishes ? `${city.dishCount} ${city.dishCount === 1 ? 'dish' : 'dishes'} rated` : 'Coming soon'}
                </p>
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}
