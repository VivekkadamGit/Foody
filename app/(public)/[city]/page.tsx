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
      <h1 className="text-3xl font-bold mb-2">Best Food in {city.name}</h1>
      <p className="text-gray-500 mb-6">{enriched.length} restaurants reviewed by our team</p>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-8">
        <a
          href={`/${citySlug}`}
          className={`text-sm px-4 py-1.5 rounded-full border transition-colors ${!cuisine && !price ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-600 border-gray-200 hover:border-orange-300'}`}
        >
          All
        </a>
        {CUISINES.map((c) => (
          <a
            key={c}
            href={`/${citySlug}?cuisine=${c}${price ? `&price=${price}` : ''}`}
            className={`text-sm px-4 py-1.5 rounded-full border transition-colors capitalize ${cuisine === c ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-600 border-gray-200 hover:border-orange-300'}`}
          >
            {c}
          </a>
        ))}
        <span className="w-px bg-gray-200 mx-1" />
        {[['1', '₹ Budget'], ['2', '₹₹ Mid'], ['3', '₹₹₹ Premium']].map(([val, label]) => (
          <a
            key={val}
            href={`/${citySlug}?price=${val}${cuisine ? `&cuisine=${cuisine}` : ''}`}
            className={`text-sm px-4 py-1.5 rounded-full border transition-colors ${price === val ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-600 border-gray-200 hover:border-orange-300'}`}
          >
            {label}
          </a>
        ))}
      </div>

      {enriched.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-5xl mb-4">🍽️</p>
          <p className="text-lg">No restaurants yet for this filter. Check back soon!</p>
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
