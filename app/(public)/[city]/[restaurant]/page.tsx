import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import StarRating from '@/components/ui/StarRating'
import { PRICE_LABELS } from '@/types/database'

export default async function RestaurantPage({
  params,
}: {
  params: Promise<{ city: string; restaurant: string }>
}) {
  const { city: citySlug, restaurant: restaurantId } = await params
  const supabase = await createClient()

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select(`
      *,
      cities!inner(name, slug),
      dishes(
        *,
        reviews(*, testers(name))
      )
    `)
    .eq('id', restaurantId)
    .single()

  if (!restaurant || restaurant.cities.slug !== citySlug) notFound()

  const dishesWithAvg = (restaurant.dishes ?? []).map((d: any) => {
    const ratings = d.reviews?.map((r: any) => r.rating) ?? []
    const avg = ratings.length ? ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length : 0
    return { ...d, avg_rating: avg }
  }).sort((a: any, b: any) => b.avg_rating - a.avg_rating)

  const mapEmbedUrl = restaurant.latitude && restaurant.longitude
    ? `https://maps.google.com/maps?q=${restaurant.latitude},${restaurant.longitude}&z=16&output=embed`
    : restaurant.google_place_id
    ? `https://maps.google.com/maps?q=place_id:${restaurant.google_place_id}&output=embed`
    : null

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500 mb-4">
        <a href="/" className="hover:text-orange-600">Home</a>
        {' / '}
        <a href={`/${citySlug}`} className="hover:text-orange-600 capitalize">{restaurant.cities.name}</a>
        {' / '}
        <span className="text-gray-900">{restaurant.name}</span>
      </nav>

      {/* Cover image */}
      {restaurant.cover_image_url && (
        <div className="h-64 rounded-2xl overflow-hidden mb-6">
          <img src={restaurant.cover_image_url} alt={restaurant.name} className="w-full h-full object-cover" />
        </div>
      )}

      {/* Restaurant header */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-orange-100 mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">{restaurant.name}</h1>
            <p className="text-gray-500 mt-1">{restaurant.address}</p>
            <div className="flex flex-wrap gap-2 mt-3">
              {restaurant.cuisine_type?.map((c: string) => (
                <span key={c} className="text-sm bg-orange-50 text-orange-700 px-3 py-1 rounded-full capitalize">{c}</span>
              ))}
              <span className="text-sm bg-gray-100 text-gray-600 px-3 py-1 rounded-full">
                {PRICE_LABELS[restaurant.price_range as 1 | 2 | 3]}
              </span>
            </div>
          </div>
          <div className="bg-orange-50 rounded-xl px-5 py-3 text-center">
            <p className="text-3xl font-bold text-orange-600">
              {dishesWithAvg.length > 0
                ? (dishesWithAvg.reduce((s: number, d: any) => s + d.avg_rating, 0) / dishesWithAvg.filter((d: any) => d.avg_rating > 0).length || 0).toFixed(1)
                : '—'}
            </p>
            <p className="text-xs text-gray-500 mt-1">Overall Rating</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Dishes */}
        <div className="lg:col-span-2">
          <h2 className="text-2xl font-bold mb-4">Dishes Reviewed</h2>
          {dishesWithAvg.length === 0 ? (
            <p className="text-gray-400">No dishes reviewed yet.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {dishesWithAvg.map((dish: any) => (
                <div key={dish.id} className="bg-white rounded-2xl border border-orange-100 shadow-sm overflow-hidden">
                  <div className="flex gap-4">
                    {dish.photo_url && (
                      <div className="w-32 h-32 flex-shrink-0">
                        <img src={dish.photo_url} alt={dish.name} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="p-4 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-lg">{dish.name}</h3>
                        {dish.is_must_try && (
                          <span className="text-xs bg-orange-500 text-white px-2 py-0.5 rounded-full">Must Try</span>
                        )}
                      </div>
                      {dish.description && <p className="text-sm text-gray-500 mt-1">{dish.description}</p>}
                      {dish.avg_rating > 0 && (
                        <div className="flex items-center gap-2 mt-2">
                          <StarRating rating={dish.avg_rating} size="md" />
                          <span className="text-gray-600 font-semibold">{dish.avg_rating.toFixed(1)}</span>
                        </div>
                      )}
                      {/* Tester reviews */}
                      {dish.reviews?.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {dish.reviews.map((review: any) => (
                            <div key={review.id} className="bg-orange-50 rounded-xl p-3">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-semibold text-orange-700">✓ {review.testers?.name ?? 'Tester'}</span>
                                <StarRating rating={review.rating} />
                                <span className="text-xs text-gray-400">{review.visit_date}</span>
                              </div>
                              {review.taste_notes && <p className="text-sm text-gray-600">{review.taste_notes}</p>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Map sidebar */}
        <div>
          <h2 className="text-2xl font-bold mb-4">Location</h2>
          {mapEmbedUrl ? (
            <div className="rounded-2xl overflow-hidden border border-orange-100 shadow-sm">
              <iframe
                src={mapEmbedUrl}
                width="100%"
                height="300"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-orange-100 p-6 text-gray-400 text-center">
              <p>📍 {restaurant.address}</p>
            </div>
          )}
          <a
            href={`https://maps.google.com/?q=${encodeURIComponent(restaurant.name + ' ' + restaurant.address)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 block text-center text-sm text-orange-600 hover:text-orange-700 font-medium"
          >
            Open in Google Maps →
          </a>
        </div>
      </div>
    </div>
  )
}
