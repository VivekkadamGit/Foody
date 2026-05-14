import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import AddDishForm from './AddDishForm'
import RestaurantActions from './RestaurantActions'
import DishActions from './DishActions'
import ReviewActions from './ReviewActions'

export default async function ManageRestaurantPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select(`*, cities!inner(name, slug), dishes(*, reviews(*, testers(name)))`)
    .eq('id', id)
    .single()

  if (!restaurant) notFound()

  const activeDishes = restaurant.dishes?.filter((d: any) => !d.deleted_at) ?? []
  const deletedDishes = restaurant.dishes?.filter((d: any) => d.deleted_at) ?? []

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/admin" className="text-sm text-gray-500 hover:text-orange-600">← Dashboard</Link>
          <h1 className={`text-2xl font-bold mt-1 ${restaurant.deleted_at ? 'line-through text-gray-400' : ''}`}>
            {restaurant.name}
          </h1>
          <p className="text-gray-500 text-sm">{restaurant.cities.name} — {restaurant.address}</p>
        </div>
        <Link
          href={`/${restaurant.cities.slug}/${restaurant.id}`}
          target="_blank"
          className="text-sm text-orange-600 hover:text-orange-700"
        >
          View public page →
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        {/* Add dish form */}
        <div>
          <h2 className="text-lg font-bold mb-3">Add a Dish</h2>
          <AddDishForm restaurantId={restaurant.id} />
        </div>

        {/* Existing dishes */}
        <div>
          <h2 className="text-lg font-bold mb-3">
            Dishes ({activeDishes.length} active{deletedDishes.length > 0 ? `, ${deletedDishes.length} deleted` : ''})
          </h2>

          {restaurant.dishes?.length === 0 ? (
            <p className="text-gray-400 text-sm">No dishes yet. Add one!</p>
          ) : (
            <div className="space-y-3">
              {restaurant.dishes?.map((dish: any) => {
                const activeReviews = dish.reviews?.filter((r: any) => !r.deleted_at) ?? []
                const ratings = activeReviews.map((r: any) => r.rating)
                const avg = ratings.length
                  ? (ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length).toFixed(1)
                  : null

                return (
                  <div
                    key={dish.id}
                    className={`bg-white rounded-xl border p-4 ${dish.deleted_at ? 'border-red-100 opacity-60' : 'border-gray-200'}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`font-semibold ${dish.deleted_at ? 'line-through text-gray-400' : ''}`}>
                          {dish.name}
                        </span>
                        {dish.is_must_try && !dish.deleted_at && (
                          <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">Must Try</span>
                        )}
                        {dish.deleted_at && (
                          <span className="text-xs bg-red-100 text-red-500 px-2 py-0.5 rounded-full">deleted</span>
                        )}
                      </div>
                      {avg && <span className="text-amber-500 text-sm">★ {avg}</span>}
                    </div>

                    {dish.description && (
                      <p className="text-xs text-gray-500 mt-1">{dish.description}</p>
                    )}

                    <DishActions dish={{
                      id: dish.id,
                      name: dish.name,
                      description: dish.description,
                      is_must_try: dish.is_must_try,
                      deleted_at: dish.deleted_at,
                      restaurantId: restaurant.id,
                    }} />

                    {/* Reviews */}
                    {dish.reviews?.length > 0 && (
                      <div className="mt-3 space-y-2">
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Reviews</p>
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
                    )}

                    {!dish.deleted_at && (
                      <Link
                        href={`/admin/dishes/${dish.id}/review`}
                        className="text-xs text-orange-600 hover:text-orange-700 mt-3 inline-block font-medium"
                      >
                        + Add Review
                      </Link>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
