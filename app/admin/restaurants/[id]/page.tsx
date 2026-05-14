import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import AddDishForm from './AddDishForm'

export default async function ManageRestaurantPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select(`*, cities!inner(name, slug), dishes(*, reviews(rating, taste_notes, visit_date, testers(name)))`)
    .eq('id', id)
    .single()

  if (!restaurant) notFound()

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/admin" className="text-sm text-gray-500 hover:text-orange-600">← Dashboard</Link>
          <h1 className="text-2xl font-bold mt-1">{restaurant.name}</h1>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Add dish form */}
        <div>
          <h2 className="text-lg font-bold mb-3">Add a Dish</h2>
          <AddDishForm restaurantId={restaurant.id} />
        </div>

        {/* Existing dishes */}
        <div>
          <h2 className="text-lg font-bold mb-3">Dishes ({restaurant.dishes?.length ?? 0})</h2>
          {restaurant.dishes?.length === 0 ? (
            <p className="text-gray-400 text-sm">No dishes yet. Add one!</p>
          ) : (
            <div className="space-y-3">
              {restaurant.dishes?.map((dish: any) => {
                const ratings = dish.reviews?.map((r: any) => r.rating) ?? []
                const avg = ratings.length ? (ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length).toFixed(1) : null
                return (
                  <div key={dish.id} className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-semibold">{dish.name}</span>
                        {dish.is_must_try && <span className="ml-2 text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">Must Try</span>}
                      </div>
                      {avg && <span className="text-amber-500 text-sm">★ {avg}</span>}
                    </div>
                    {dish.description && <p className="text-xs text-gray-500 mt-1">{dish.description}</p>}
                    <Link
                      href={`/admin/dishes/${dish.id}/review`}
                      className="text-xs text-orange-600 hover:text-orange-700 mt-2 inline-block font-medium"
                    >
                      + Add Review
                    </Link>
                    {dish.reviews?.length > 0 && (
                      <p className="text-xs text-gray-400 mt-1">{dish.reviews.length} review(s)</p>
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
