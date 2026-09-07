import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { avgRating, scoreOutOf10, priceTierSymbol } from '@/lib/dishScore'

export type DishHit = {
  kind: 'dish'
  id: string
  name: string
  restaurantId: string
  restaurantName: string
  area: string | null
  priceSymbol: string
  /** null when the dish has no reviews yet — shown as "Not rated yet" rather than hidden. */
  score: number | null
  reviewCount: number
}

export type RestaurantHit = {
  kind: 'restaurant'
  id: string
  name: string
  area: string | null
  priceSymbol: string
  dishCount: number
}

export type SearchResults = {
  dishes: DishHit[]
  restaurants: RestaurantHit[]
}

/** `%` and `_` are ILIKE wildcards — escape them so a literal query stays literal. */
function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, (ch) => `\\${ch}`)
}

function areaOf(address: string | null | undefined): string | null {
  return address ? String(address).split(',')[0].trim() : null
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = (searchParams.get('q') ?? '').trim()
  const city = (searchParams.get('city') ?? '').trim()

  if (q.length < 2 || !city) {
    return NextResponse.json({ dishes: [], restaurants: [] } satisfies SearchResults)
  }

  const supabase = await createClient()
  const pattern = `%${escapeLike(q)}%`

  const [dishesRes, restaurantsRes] = await Promise.all([
    supabase
      .from('dishes')
      .select(
        `id, name,
         restaurants!inner(id, name, address, price_range, cities!inner(slug)),
         reviews(rating)`
      )
      .ilike('name', pattern)
      .eq('restaurants.cities.slug', city)
      .is('deleted_at', null)
      .is('reviews.deleted_at', null)
      .limit(6),
    supabase
      .from('restaurants')
      .select('id, name, address, price_range, cities!inner(slug), dishes(id)')
      .ilike('name', pattern)
      .eq('cities.slug', city)
      .is('deleted_at', null)
      .is('dishes.deleted_at', null)
      .limit(4),
  ])

  if (dishesRes.error || restaurantsRes.error) {
    console.error(
      '[search] query failed:',
      dishesRes.error?.message ?? restaurantsRes.error?.message
    )
    return NextResponse.json({ error: 'search_failed' }, { status: 500 })
  }

  const dishes: DishHit[] = (dishesRes.data ?? []).map((d: any) => {
    const ratings = (d.reviews ?? []).map((r: any) => r.rating)
    return {
      kind: 'dish',
      id: d.id,
      name: d.name,
      restaurantId: d.restaurants.id,
      restaurantName: d.restaurants.name,
      area: areaOf(d.restaurants.address),
      priceSymbol: priceTierSymbol(d.restaurants.price_range),
      score: ratings.length > 0 ? scoreOutOf10(avgRating(ratings)) : null,
      reviewCount: ratings.length,
    }
  })

  const restaurants: RestaurantHit[] = (restaurantsRes.data ?? []).map((r: any) => ({
    kind: 'restaurant',
    id: r.id,
    name: r.name,
    area: areaOf(r.address),
    priceSymbol: priceTierSymbol(r.price_range),
    dishCount: (r.dishes ?? []).length,
  }))

  // Exact and prefix matches first — "Coffee abc" should outrank "ABC coffiee" for "coffee".
  const lowered = q.toLowerCase()
  const rank = (name: string) => {
    const n = name.toLowerCase()
    if (n === lowered) return 0
    if (n.startsWith(lowered)) return 1
    return 2
  }
  dishes.sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name))
  restaurants.sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name))

  return NextResponse.json({ dishes, restaurants } satisfies SearchResults)
}
