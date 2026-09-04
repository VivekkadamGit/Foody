import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import RestaurantCard from '@/components/browse/RestaurantCard'

const CUISINES = ['gujarati', 'street food', 'chinese', 'south indian', 'north indian', 'desserts', 'fast food']

export default async function CityPage({
  params,
  searchParams,
}: {
  params: Promise<{ city: string }>
  searchParams: Promise<{ cuisine?: string; price?: string }>
}) {
  const { city: citySlug } = await params
  const { cuisine, price } = await searchParams
  const supabase = await createClient()

  const { data: city } = await supabase
    .from('cities')
    .select('*')
    .eq('slug', citySlug)
    .single()

  if (!city) notFound()

  if (city.status === 'coming_soon') {
    return (
      <div className="text-center py-24">
        <p className="font-display text-8xl font-bold text-warm-200 mb-6">🔒</p>
        <h1 className="font-display text-3xl font-bold text-charcoal mb-3">{city.name} is coming soon</h1>
        <p className="font-body text-muted max-w-md mx-auto">
          We haven&apos;t started tasting our way through {city.name} yet — check back once filming starts here.
        </p>
      </div>
    )
  }

  let query = supabase
    .from('restaurants')
    .select(`
      id, name, address, cover_image_url, cuisine_type, price_range, city_id,
      cities!inner(name, slug),
      dishes(name, reviews(rating))
    `)
    .eq('city_id', city.id)
    .is('deleted_at', null)

  if (price) query = query.eq('price_range', parseInt(price))
  if (cuisine) query = query.contains('cuisine_type', [cuisine])

  const { data: restaurants } = await query

  const enriched = (restaurants ?? []).map((r: any) => {
    const allRatings = r.dishes?.flatMap((d: any) => d.reviews?.map((rv: any) => rv.rating) ?? []) ?? []
    const avg = allRatings.length ? allRatings.reduce((a: number, b: number) => a + b, 0) / allRatings.length : 0
    const topDish = r.dishes
      ?.filter((d: any) => d.reviews?.length > 0)
      .sort((a: any, b: any) => {
        const avgA = a.reviews.reduce((s: number, rv: any) => s + rv.rating, 0) / a.reviews.length
        const avgB = b.reviews.reduce((s: number, rv: any) => s + rv.rating, 0) / b.reviews.length
        return avgB - avgA
      })?.[0]?.name ?? null
    return { ...r, city, avg_rating: avg, top_dish: topDish }
  }).sort((a: any, b: any) => b.avg_rating - a.avg_rating)

  return (
    <div>
      {/* Header */}
      <div className="border-b border-warm-100 pb-8 mb-10">
        <p className="font-body text-xs text-muted uppercase tracking-[0.2em] mb-2">
          <a href="/" className="hover:text-spice transition-colors">Home</a>
          <span className="mx-2">/</span>
          Restaurants
        </p>
        <h1 className="font-display text-5xl font-bold text-charcoal">
          Best Food in {city.name}
        </h1>
        <p className="font-body text-muted mt-2 text-sm">{enriched.length} restaurants reviewed by our team</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-10">
        <a
          href={`/${citySlug}`}
          className={`font-body text-xs px-4 py-2 border uppercase tracking-widest transition-colors ${
            !cuisine && !price
              ? 'bg-spice text-white border-spice'
              : 'bg-white text-charcoal border-warm-200 hover:border-spice hover:text-spice'
          }`}
        >
          All
        </a>
        {CUISINES.map((c) => (
          <a
            key={c}
            href={`/${citySlug}?cuisine=${c}${price ? `&price=${price}` : ''}`}
            className={`font-body text-xs px-4 py-2 border capitalize tracking-wide transition-colors ${
              cuisine === c
                ? 'bg-spice text-white border-spice'
                : 'bg-white text-charcoal border-warm-200 hover:border-spice hover:text-spice'
            }`}
          >
            {c}
          </a>
        ))}
        <span className="w-px bg-warm-200 mx-1" />
        {[['1', '₹ Budget'], ['2', '₹₹ Mid'], ['3', '₹₹₹ Premium']].map(([val, label]) => (
          <a
            key={val}
            href={`/${citySlug}?price=${val}${cuisine ? `&cuisine=${cuisine}` : ''}`}
            className={`font-body text-xs px-4 py-2 border tracking-wide transition-colors ${
              price === val
                ? 'bg-spice text-white border-spice'
                : 'bg-white text-charcoal border-warm-200 hover:border-spice hover:text-spice'
            }`}
          >
            {label}
          </a>
        ))}
      </div>

      {enriched.length === 0 ? (
        <div className="text-center py-24">
          <p className="font-display text-8xl font-bold text-warm-200 mb-6">?</p>
          <p className="font-body text-muted">No restaurants yet for this filter. Check back soon!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {enriched.map((r: any) => (
            <RestaurantCard key={r.id} restaurant={r} />
          ))}
        </div>
      )}
    </div>
  )
}
