import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type { AdminDish } from '@/lib/admin/types'
import DishList from '@/components/admin/DishList'
import { EmptyState } from '@/components/admin/ui'
import RestaurantActions from './RestaurantActions'
import ReviewActions from './ReviewActions'

export default async function ManageRestaurantPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: { tab?: string } }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: restaurant, error } = await supabase
    .from('restaurants')
    .select(`*, cities!inner(name, slug), dishes(*, reviews(*, testers(name)))`)
    .eq('id', id)
    .single()

  // .single() reports "no rows" as PGRST116; that is a 404, not a load failure.
  if (error && error.code !== 'PGRST116') {
    console.error('[admin] restaurant query failed:', error.message)
    return <EmptyState icon="⚠️" text="Couldn't load this restaurant — refresh to retry." />
  }
  if (!restaurant) notFound()

  const adminDishes: AdminDish[] = (restaurant.dishes ?? []).map((d: any) => ({
    id: d.id,
    name: d.name,
    description: d.description,
    photo_url: d.photo_url,
    is_must_try: !!d.is_must_try,
    score: d.score === null || d.score === undefined ? null : Number(d.score),
    deleted_at: d.deleted_at,
    restaurant_id: d.restaurant_id,
    restaurant_name: restaurant.name,
    diet: d.diet,
    category: d.category,
    cuisine: d.cuisine,
    tastes: d.tastes ?? [],
    meals: d.meals ?? [],
  }))
  const dishesWithReviews = (restaurant.dishes ?? []).filter((d: any) => d.reviews?.length > 0)

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href={`/admin/restaurants?city=${restaurant.cities.slug}`} className="font-anek text-[13.5px] text-muted hover:text-charcoal">← Restaurants</Link>
          <h1 className={`mt-1 font-anek text-3xl font-bold ${restaurant.deleted_at ? 'text-muted line-through' : 'text-charcoal'}`}>
            {restaurant.name}
          </h1>
          <p className="font-anek text-[15px] text-muted">{restaurant.cities.name} — {restaurant.address}</p>
        </div>
        <Link
          href={`/${restaurant.cities.slug}/${restaurant.id}`}
          target="_blank"
          className="font-anek text-[14px] font-semibold text-ember hover:underline"
        >
          View public page ↗
        </Link>
      </div>

      {/* Restaurant edit / delete / restore */}
      <RestaurantActions restaurant={{
        id: restaurant.id,
        name: restaurant.name,
        address: restaurant.address,
        cuisine_type: restaurant.cuisine_type,
        price_range: restaurant.price_range,
        cover_image_url: restaurant.cover_image_url,
        deleted_at: restaurant.deleted_at,
      }} />

      <section className="space-y-3">
        <h2 className="font-anek text-xl font-bold text-charcoal">Dishes</h2>
        <Suspense>
          <DishList
            dishes={adminDishes}
            restaurants={[{ id: restaurant.id, name: restaurant.name }]}
            presetRestaurantId={restaurant.id}
            initialTab={searchParams.tab}
          />
        </Suspense>
      </section>

      <section className="space-y-3">
        <h2 className="font-anek text-xl font-bold text-charcoal">Visits</h2>
        {dishesWithReviews.length === 0 && (
          <p className="font-anek text-[15px] text-muted">No visits logged yet.</p>
        )}
        {(restaurant.dishes ?? []).map((dish: any) => {
          const hasReviews = dish.reviews?.length > 0
          if (!hasReviews) return null
          return (
            <div
              key={dish.id}
              className={`rounded-2xl border border-warm-200 bg-white p-6 ${dish.deleted_at ? 'opacity-60' : ''}`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className={`font-anek text-[15.5px] font-semibold ${dish.deleted_at ? 'text-muted line-through' : 'text-charcoal'}`}>
                  {dish.name}
                </span>
                {!dish.deleted_at && (
                  <Link
                    href={`/admin/dishes/${dish.id}/review`}
                    className="font-anek text-[13.5px] font-semibold text-ember hover:underline"
                  >
                    + Log a visit
                  </Link>
                )}
              </div>
              <div className="mt-3 space-y-2">
                {dish.reviews.map((review: any) => (
                  <ReviewActions key={review.id} review={{
                    id: review.id,
                    rating: review.rating,
                    taste_notes: review.taste_notes,
                    visit_date: review.visit_date,
                    deleted_at: review.deleted_at,
                    restaurantId: restaurant.id,
                    testerName: review.testers?.name ?? 'Tester',
                  }} />
                ))}
              </div>
            </div>
          )
        })}
        {(restaurant.dishes ?? []).filter((d: any) => !d.deleted_at && !(d.reviews?.length > 0)).length > 0 && (
          <p className="font-anek text-[13.5px] text-muted">
            Log a first visit for:{' '}
            {(restaurant.dishes ?? []).filter((d: any) => !d.deleted_at && !(d.reviews?.length > 0)).map((d: any, i: number) => (
              <span key={d.id}>
                {i > 0 && ', '}
                <Link href={`/admin/dishes/${d.id}/review`} className="text-ember hover:underline">{d.name}</Link>
              </span>
            ))}
          </p>
        )}
      </section>
    </div>
  )
}
