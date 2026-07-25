import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
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
    .is('deleted_at', null)
    .single()

  if (!restaurant || restaurant.cities.slug !== citySlug) notFound()

  const dishesWithAvg = (restaurant.dishes ?? []).map((d: any) => {
    const ratings = d.reviews?.map((r: any) => r.rating) ?? []
    const avg = ratings.length ? ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length : 0
    return { ...d, avg_rating: avg }
  }).sort((a: any, b: any) => b.avg_rating - a.avg_rating)

  const ratedDishes = dishesWithAvg.filter((d: any) => d.avg_rating > 0)
  const overallRating = ratedDishes.length > 0
    ? ratedDishes.reduce((s: number, d: any) => s + d.avg_rating, 0) / ratedDishes.length
    : null

  const mapEmbedUrl = restaurant.latitude && restaurant.longitude
    ? `https://maps.google.com/maps?q=${restaurant.latitude},${restaurant.longitude}&z=16&output=embed`
    : restaurant.google_place_id
    ? `https://maps.google.com/maps?q=place_id:${restaurant.google_place_id}&output=embed`
    : null

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="font-body text-xs text-muted mb-6 uppercase tracking-[0.15em]">
        <a href="/" className="hover:text-spice transition-colors">Home</a>
        <span className="mx-2">/</span>
        <a href={`/${citySlug}`} className="hover:text-spice transition-colors capitalize">{restaurant.cities.name}</a>
        <span className="mx-2">/</span>
        <span className="text-charcoal">{restaurant.name}</span>
      </nav>

      {/* Cover */}
      {restaurant.cover_image_url && (
        <div className="h-72 lg:h-96 overflow-hidden mb-10">
          <img
            src={restaurant.cover_image_url}
            alt={restaurant.name}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Restaurant header */}
      <div className="flex flex-wrap items-start justify-between gap-6 border-b border-warm-100 pb-10 mb-10">
        <div>
          <h1 className="font-display text-4xl lg:text-5xl font-bold text-charcoal leading-tight">
            {restaurant.name}
          </h1>
          <p className="font-body text-muted mt-2 text-sm">{restaurant.address}</p>
          <div className="flex flex-wrap gap-2 mt-5">
            {restaurant.cuisine_type?.map((c: string) => (
              <span key={c} className="font-body text-xs text-spice border border-spice/20 px-3 py-1 capitalize tracking-wide">
                {c}
              </span>
            ))}
            <span className="font-body text-xs text-muted border border-warm-200 px-3 py-1 tracking-wide">
              {PRICE_LABELS[restaurant.price_range as 1 | 2 | 3]}
            </span>
          </div>
        </div>
        {overallRating && (
          <div className="bg-spice text-white px-8 py-5 text-center flex-shrink-0">
            <p className="font-display text-4xl font-bold leading-none">{overallRating.toFixed(1)}</p>
            <p className="font-body text-xs text-red-200 mt-2 uppercase tracking-widest">Overall</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Dishes */}
        <div className="lg:col-span-2">
          <h2 className="font-display text-2xl font-bold text-charcoal mb-6">Dishes Reviewed</h2>

          {dishesWithAvg.length === 0 ? (
            <p className="font-body text-muted">No dishes reviewed yet.</p>
          ) : (
            <div className="flex flex-col gap-5">
              {dishesWithAvg.map((dish: any) => (
                <div key={dish.id} className="bg-white border border-warm-100">
                  <div className="flex">
                    {dish.photo_url && (
                      <div className="w-36 h-36 flex-shrink-0 overflow-hidden">
                        <img
                          src={dish.photo_url}
                          alt={dish.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div className="p-5 flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="font-display font-bold text-lg text-charcoal">{dish.name}</h3>
                        {dish.is_must_try && (
                          <span className="font-body text-xs bg-spice text-white px-2 py-0.5 uppercase tracking-widest flex-shrink-0">
                            Must Try
                          </span>
                        )}
                      </div>
                      {dish.description && (
                        <p className="font-body text-sm text-muted mt-1 leading-relaxed">{dish.description}</p>
                      )}
                      {dish.avg_rating > 0 && (
                        <div className="flex items-baseline gap-1.5 mt-3">
                          <span className="font-body text-lg font-bold text-spice">★ {dish.avg_rating.toFixed(1)}</span>
                          <span className="font-body text-xs text-muted">/ 5</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Reviews */}
                  {dish.reviews?.length > 0 && (
                    <div className="border-t border-warm-100 divide-y divide-warm-100">
                      {dish.reviews.map((review: any) => (
                        <div key={review.id} className="p-5">
                          <div className="flex flex-wrap items-center gap-3 mb-2">
                            <span className="font-body text-xs font-bold text-charcoal uppercase tracking-wide">
                              {review.testers?.name ?? 'Tester'}
                            </span>
                            <span className="font-body text-xs text-amber-500 font-semibold tracking-tight">
                              {'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}
                            </span>
                            <span className="font-body text-xs text-muted">{review.visit_date}</span>
                          </div>
                          {review.taste_notes && (
                            <p className="font-body text-sm text-charcoal/80 italic leading-relaxed">
                              &ldquo;{review.taste_notes}&rdquo;
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div>
          <h2 className="font-display text-2xl font-bold text-charcoal mb-6">Location</h2>
          {mapEmbedUrl ? (
            <div className="overflow-hidden border border-warm-100">
              <iframe
                src={mapEmbedUrl}
                width="100%"
                height="280"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          ) : (
            <div className="bg-white border border-warm-100 p-6 text-center">
              <p className="font-body text-sm text-muted">📍 {restaurant.address}</p>
            </div>
          )}
          <a
            href={`https://maps.google.com/?q=${encodeURIComponent(restaurant.name + ' ' + restaurant.address)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 block font-body text-sm text-spice hover:text-spice-light font-medium transition-colors"
          >
            Open in Google Maps →
          </a>
        </div>
      </div>
    </div>
  )
}
