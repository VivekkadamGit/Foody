import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { pickCity } from '@/lib/admin/city'
import type { AdminTrending, CityOption } from '@/lib/admin/types'
import CityTabs from '@/components/admin/CityTabs'
import TrendingList from '@/components/admin/TrendingList'
import { EmptyState } from '@/components/admin/ui'

export const metadata = { title: 'On our list — Chakh admin' }

export default async function AdminTrendingPage({ searchParams }: { searchParams: { city?: string; tab?: string } }) {
  const supabase = await createClient()
  const { data: cities, error: citiesError } = await supabase.from('cities').select('id, name, slug').order('name')
  if (citiesError) {
    console.error('[admin] cities query failed:', citiesError.message)
    return <EmptyState icon="⚠️" text="Couldn't load cities — refresh to retry." />
  }
  const city = pickCity((cities ?? []).map((c) => c.slug), searchParams.city)
  if (!city) return <EmptyState text="Add a city first." />
  const cityRow = (cities ?? []).find((c) => c.slug === city)!

  const [trendingRes, restaurantsRes, dishesRes] = await Promise.all([
    supabase.from('trending_dishes')
      .select('id, dish_name, place_name, city_id, restaurant_id, area, why, source_url, photo_url, visited_dish_id, rank, buzz, deleted_at, diet, category, cuisine, tastes, meals')
      .eq('city_id', cityRow.id)
      .order('buzz', { ascending: false }).order('rank').order('created_at', { ascending: false }),
    supabase.from('restaurants').select('id, name').eq('city_id', cityRow.id).is('deleted_at', null).order('name'),
    supabase.from('dishes').select('id, name, restaurants!inner(name, city_id, deleted_at)').eq('restaurants.city_id', cityRow.id).is('restaurants.deleted_at', null).is('deleted_at', null).order('name'),
  ])
  if (trendingRes.error || restaurantsRes.error || dishesRes.error) {
    console.error('[admin] trending query failed:', trendingRes.error?.message ?? restaurantsRes.error?.message ?? dishesRes.error?.message)
    return <EmptyState icon="⚠️" text="Couldn't load the list — refresh to retry." />
  }

  const entries: AdminTrending[] = (trendingRes.data ?? []).map((t: any) => ({
    id: t.id,
    dish_name: t.dish_name,
    place_name: t.place_name,
    city_id: t.city_id,
    restaurant_id: t.restaurant_id,
    area: t.area,
    why: t.why,
    source_url: t.source_url,
    photo_url: t.photo_url,
    visited_dish_id: t.visited_dish_id,
    rank: t.rank,
    buzz: t.buzz,
    deleted_at: t.deleted_at,
    diet: t.diet,
    category: t.category,
    cuisine: t.cuisine,
    tastes: t.tastes ?? [],
    meals: t.meals ?? [],
  }))

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-anek text-3xl font-bold text-charcoal">On our list</h1>
          <p className="font-anek text-[15px] text-muted">Places we plan to visit — shown on search and What&apos;s New, never scored.</p>
        </div>
        <CityTabs cities={cities as CityOption[]} current={city} basePath="/admin/trending" params={{ tab: searchParams.tab }} />
      </header>
      <Suspense>
        <TrendingList
          key={city}
          entries={entries}
          cityId={cityRow.id}
          restaurants={(restaurantsRes.data ?? []).map((r: any) => ({ id: r.id, name: r.name }))}
          dishes={(dishesRes.data ?? []).map((d: any) => ({ id: d.id, name: d.name, restaurant_name: d.restaurants.name }))}
          initialTab={searchParams.tab}
        />
      </Suspense>
    </div>
  )
}
