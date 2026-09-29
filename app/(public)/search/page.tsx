import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { parseQuery } from '@/lib/taxonomy'
import { CITY_PRIORITY } from '@/lib/cities'
import { runSearch } from '@/lib/search/run'
import { headingFor } from '@/lib/search/present'
import type { ChipParams, SearchResponse } from '@/lib/search/types'
import DishResultCard from '@/components/search/DishResultCard'
import FilterChips from '@/components/search/FilterChips'
import OnOurList from '@/components/search/OnOurList'

type Params = { q?: string; city?: string; diet?: string; taste?: string; meal?: string }

export async function generateMetadata({ searchParams }: { searchParams: Params }) {
  const q = (searchParams.q ?? '').trim()
  return { title: q ? `${q} — Chakh` : 'Search — Chakh' }
}

export default async function SearchPage({ searchParams }: { searchParams: Params }) {
  const q = (searchParams.q ?? '').trim()
  const citySlug = searchParams.city ?? CITY_PRIORITY[0]
  const chips: ChipParams = { diet: searchParams.diet, taste: searchParams.taste, meal: searchParams.meal }

  const supabase = await createClient()
  const { data: city } = await supabase.from('cities').select('name, slug').eq('slug', citySlug).maybeSingle()
  if (!city) notFound()

  let res: SearchResponse | null = null
  try {
    res = await runSearch(supabase, q, city.slug, chips)
  } catch {
    // runSearch logged it; show the failure instead of a blank page.
  }

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      {res === null ? (
        <p className="font-anek text-sand-dark">Search is unavailable right now.</p>
      ) : (
        <>
          <h1 className="font-anek text-3xl sm:text-4xl font-bold text-charcoal mb-4">
            {headingFor(res, q, city.name)}
          </h1>
          <FilterChips q={q} city={city.slug} typed={parseQuery(q)} chips={chips} />
          <div className="mt-8">
            {res.empty ? (
              <EmptyState res={res} citySlug={city.slug} cityName={city.name} />
            ) : (
              <Results res={res} citySlug={city.slug} cityName={city.name} />
            )}
          </div>
        </>
      )}
    </main>
  )
}

function Board({ res, citySlug, cityName }: { res: SearchResponse; citySlug: string; cityName: string }) {
  if (!res.board || res.board.length === 0) {
    return (
      <p className="font-anek text-[15px] text-sand-dark">
        We haven&apos;t scored any dishes in {cityName} yet.
      </p>
    )
  }
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {res.board.map((b) => (
        <DishResultCard key={b.category} dish={b.dish} citySlug={citySlug} eyebrow={b.label} />
      ))}
    </div>
  )
}

function RestaurantList({ res, citySlug }: { res: SearchResponse; citySlug: string }) {
  if (res.restaurants.length === 0) return null
  return (
    <>
      <p className="font-anek text-[11px] font-bold uppercase tracking-[0.15em] text-[#a09a90] mt-8 mb-3">Restaurants</p>
      <ul className="grid grid-cols-1 gap-2">
        {res.restaurants.map((r) => (
          <li key={r.id}>
            <Link href={`/${citySlug}/${r.id}`} className="font-anek text-[15px] font-semibold text-charcoal hover:text-ember">
              {r.name}
            </Link>
            <span className="font-anek text-[13px] text-sand-dark">
              {r.area ? ` · ${r.area}` : ''} · {r.dishCount} {r.dishCount === 1 ? 'dish' : 'dishes'}
            </span>
          </li>
        ))}
      </ul>
    </>
  )
}

function Results({ res, citySlug, cityName }: { res: SearchResponse; citySlug: string; cityName: string }) {
  const rated = (res.ranked ?? []).filter((d) => d.score !== null)
  const unrated = (res.ranked ?? []).filter((d) => d.score === null)
  const listOnTop = rated.length === 0

  return (
    <>
      {res.kind === 'broad' && <Board res={res} citySlug={citySlug} cityName={cityName} />}

      {res.kind === 'meal' &&
        res.groups?.map((g) => (
          <section key={g.key} className="mb-8">
            <h2 className="font-anek text-xl font-bold text-charcoal mb-3">{g.label}</h2>
            <div className="grid grid-cols-1 gap-3">
              {g.dishes.map((d) => <DishResultCard key={d.id} dish={d} citySlug={citySlug} />)}
            </div>
          </section>
        ))}

      {(res.kind === 'specific' || res.kind === 'text') && (
        <>
          {/* No rated answer: the places we plan to visit are the answer, so they lead. */}
          {listOnTop && <OnOurList items={res.onOurList} citySlug={citySlug} />}
          <div className="grid grid-cols-1 gap-3">
            {rated.map((d, i) => (
              <DishResultCard key={d.id} dish={d} citySlug={citySlug} position={res.kind === 'specific' ? i + 1 : undefined} />
            ))}
          </div>
          {unrated.length > 0 && (
            <>
              <p className="font-anek text-[11px] font-bold uppercase tracking-[0.15em] text-[#a09a90] mt-8 mb-3">Not rated yet</p>
              <div className="grid grid-cols-1 gap-3">
                {unrated.map((d) => <DishResultCard key={d.id} dish={d} citySlug={citySlug} />)}
              </div>
            </>
          )}
          <RestaurantList res={res} citySlug={citySlug} />
          {!listOnTop && <OnOurList items={res.onOurList} citySlug={citySlug} />}
        </>
      )}

      {res.kind !== 'specific' && res.kind !== 'text' && <OnOurList items={res.onOurList} citySlug={citySlug} />}
    </>
  )
}

function EmptyState({ res, citySlug, cityName }: { res: SearchResponse; citySlug: string; cityName: string }) {
  return (
    <>
      <RestaurantList res={res} citySlug={citySlug} />
      <OnOurList items={res.onOurList} citySlug={citySlug} />
      <p className="font-anek text-[15px] text-sand-dark mt-8 mb-4">
        Nothing we&apos;ve rated matches yet. Here&apos;s the best of {cityName} instead.
      </p>
      <Board res={res} citySlug={citySlug} cityName={cityName} />
    </>
  )
}
