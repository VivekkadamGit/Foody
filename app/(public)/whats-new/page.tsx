import { createClient } from '@/lib/supabase/server'
import { cityPriorityIndex } from '@/lib/cities'
import WhatsNewClient, { CityNews } from '@/components/whatsnew/WhatsNewClient'
import type { FreshlyTasted } from '@/components/whatsnew/FreshlyTastedCard'
import type { TrendingEntry } from '@/components/whatsnew/TrendingCard'

export const metadata = {
  title: "What's New — Chakh",
  description:
    "The dishes we tasted most recently, and the food your city won't shut up about that we haven't gotten to yet.",
}

// Per city, not across all cities. A global cap would empty the column the moment
// someone picks a city that isn't in the top N.
const FRESHLY_TASTED_PER_CITY = 12

/** The most recent visit logged against a dish, or its creation date if it has none. */
function lastVisitOf(dish: any): string | null {
  const visits = (dish.reviews ?? [])
    .filter((r: any) => !r.deleted_at)
    .map((r: any) => r.visit_date)
    .filter(Boolean)
    .sort()
  return visits.length > 0 ? visits[visits.length - 1] : (dish.created_at ?? null)
}

export default async function WhatsNewPage() {
  const supabase = await createClient()

  const [
    { data: cities, error: citiesError },
    { data: restaurants, error: restaurantsError },
    { data: trending, error: trendingError },
    { data: graduated, error: graduatedError },
  ] = await Promise.all([
    supabase.from('cities').select('id, name, slug, status').order('name'),
    supabase
      .from('restaurants')
      .select(
        `id, name, address, city_id, deleted_at,
         cities!inner(name, slug, status),
         dishes(id, name, score, is_must_try, photo_url, created_at, deleted_at,
                reviews(visit_date, deleted_at))`
      )
      .is('deleted_at', null),
    supabase
      .from('trending_dishes')
      .select('id, dish_name, place_name, area, why, source_url, photo_url, restaurant_id, city_id')
      .is('deleted_at', null)
      .is('visited_dish_id', null)
      .order('rank', { ascending: true })
      .order('created_at', { ascending: false }),
    supabase
      .from('trending_dishes')
      .select('visited_dish_id')
      .is('deleted_at', null)
      .not('visited_dish_id', 'is', null),
  ])

  // Never swallow a failed query — a silent failure once put invented scores on production.
  if (citiesError) console.error('[whats-new] cities query failed:', citiesError.message)
  if (restaurantsError) console.error('[whats-new] restaurants query failed:', restaurantsError.message)
  // Missing table (migration 006 not yet applied) lands here and degrades to an empty
  // Trending column rather than taking the whole page down.
  if (trendingError) console.error('[whats-new] trending query failed:', trendingError.message)
  if (graduatedError) console.error('[whats-new] graduated trending query failed:', graduatedError.message)

  const cameFromTrending = new Set(
    (graduated ?? []).map((g: any) => g.visited_dish_id).filter(Boolean)
  )

  const activeCities = (cities ?? []).filter((c: any) => c.status !== 'coming_soon')

  const news: CityNews[] = activeCities.map((city: any) => {
    const cityRestaurants = (restaurants ?? []).filter((r: any) => r.city_id === city.id)

    const freshlyTasted: FreshlyTasted[] = []

    for (const r of cityRestaurants) {
      const area = r.address ? String(r.address).split(',')[0].trim() : null

      for (const d of r.dishes ?? []) {
        if (d.deleted_at) continue
        // A dish belongs here only once it has been scored by hand.
        if (d.score === null || d.score === undefined) continue

        freshlyTasted.push({
          id: d.id,
          name: d.name,
          score: Number(d.score),
          isMustTry: !!d.is_must_try,
          restaurantId: r.id,
          restaurantName: r.name,
          area,
          citySlug: city.slug,
          cityName: city.name,
          photoUrl: d.photo_url ?? null,
          lastVisit: lastVisitOf(d),
          cameFromTrending: cameFromTrending.has(d.id),
        })
      }
    }

    // Newest visit first; a dish with no date at all sinks to the bottom.
    freshlyTasted.sort((a, b) => (b.lastVisit ?? '').localeCompare(a.lastVisit ?? ''))

    const cityTrending: TrendingEntry[] = (trending ?? [])
      .filter((t: any) => t.city_id === city.id)
      .map((t: any) => ({
        id: t.id,
        dish_name: t.dish_name,
        place_name: t.place_name,
        area: t.area ?? null,
        why: t.why,
        source_url: t.source_url ?? null,
        photo_url: t.photo_url ?? null,
        restaurant_id: t.restaurant_id ?? null,
        citySlug: city.slug,
      }))

    return {
      citySlug: city.slug,
      cityName: city.name,
      freshlyTasted: freshlyTasted.slice(0, FRESHLY_TASTED_PER_CITY),
      trending: cityTrending,
    }
  })

  news.sort((a, b) => cityPriorityIndex(a.citySlug) - cityPriorityIndex(b.citySlug))

  return (
    <div>
      <div className="border-b border-warm-100 pb-8 mb-10">
        <p className="font-body text-xs text-muted uppercase tracking-[0.2em] mb-2">
          <a href="/" className="hover:text-spice transition-colors">Home</a>
          <span className="mx-2">/</span>
          What&apos;s New
        </p>
        <h1 className="font-display text-5xl font-bold text-charcoal">What&apos;s New</h1>
        <p className="font-body text-muted mt-2 text-sm max-w-xl">
          What we just ate, and what we haven&apos;t gotten to yet. We keep the two apart on
          purpose.
        </p>
      </div>

      <WhatsNewClient news={news} />
    </div>
  )
}
