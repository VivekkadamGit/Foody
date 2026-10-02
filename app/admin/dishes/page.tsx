import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { pickCity } from '@/lib/admin/city'
import type { AdminDish, CityOption } from '@/lib/admin/types'
import CityTabs from '@/components/admin/CityTabs'
import DishList from '@/components/admin/DishList'
import { EmptyState } from '@/components/admin/ui'

export const metadata = { title: 'Dishes — Chakh admin' }

export default async function AdminDishesPage({ searchParams }: { searchParams: { city?: string; tab?: string } }) {
  const supabase = await createClient()
  const { data: cities, error: citiesError } = await supabase.from('cities').select('id, name, slug').order('name')
  if (citiesError) {
    console.error('[admin] cities query failed:', citiesError.message)
    return <EmptyState icon="⚠️" text="Couldn't load cities — refresh to retry." />
  }
  const city = pickCity((cities ?? []).map((c) => c.slug), searchParams.city)
  if (!city) return <EmptyState text="Add a city first." />

  const [dishesRes, restaurantsRes] = await Promise.all([
    supabase
      .from('dishes')
      .select('id, name, description, photo_url, is_must_try, score, diet, category, cuisine, tastes, meals, deleted_at, restaurant_id, restaurants!inner(name, deleted_at, cities!inner(slug))')
      .eq('restaurants.cities.slug', city)
      .is('restaurants.deleted_at', null)
      .order('name'),
    supabase.from('restaurants').select('id, name, cities!inner(slug)').eq('cities.slug', city).is('deleted_at', null).order('name'),
  ])
  if (dishesRes.error || restaurantsRes.error) {
    console.error('[admin] dishes query failed:', dishesRes.error?.message ?? restaurantsRes.error?.message)
    return <EmptyState icon="⚠️" text="Couldn't load dishes — refresh to retry." />
  }

  const dishes: AdminDish[] = (dishesRes.data ?? []).map((d: any) => ({
    id: d.id,
    name: d.name,
    description: d.description,
    photo_url: d.photo_url,
    is_must_try: !!d.is_must_try,
    score: d.score === null ? null : Number(d.score),
    deleted_at: d.deleted_at,
    restaurant_id: d.restaurant_id,
    restaurant_name: d.restaurants.name,
    diet: d.diet,
    category: d.category,
    cuisine: d.cuisine,
    tastes: d.tastes ?? [],
    meals: d.meals ?? [],
  }))

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-anek text-3xl font-bold text-charcoal">Dishes</h1>
          <p className="font-anek text-[15px] text-muted">Score and tag every dish so search can find it.</p>
        </div>
        <CityTabs cities={cities as CityOption[]} current={city} basePath="/admin/dishes" params={{ tab: searchParams.tab }} />
      </header>
      <Suspense>
        <DishList
          key={city}
          dishes={dishes}
          restaurants={(restaurantsRes.data ?? []).map((r: any) => ({ id: r.id, name: r.name }))}
          initialTab={searchParams.tab}
        />
      </Suspense>
    </div>
  )
}
