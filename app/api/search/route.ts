import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { priceTierSymbol } from '@/lib/dishScore'
import { parseQuery, isPlainTextQuery } from '@/lib/taxonomy'

export type DishHit = {
  kind: 'dish'
  id: string
  name: string
  restaurantId: string
  restaurantName: string
  area: string | null
  priceSymbol: string
  /** null until it has been scored — shown as "Not rated yet" rather than hidden. */
  score: number | null
  isMustTry: boolean
  /** Whether this came back on its name or on its tags — drives the dropdown hint. */
  matchedOn: 'name' | 'taxonomy'
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

  // "best cake" carries taxonomy meaning ("cake" -> the `baked` category), not just
  // letters to match. Pull that out first so a brownie can answer a query for cake.
  const parsed = parseQuery(q)
  const plainText = isPlainTextQuery(parsed)

  let dishQuery = supabase
    .from('dishes')
    .select(
      `id, name, score, is_must_try, diet, category, cuisine, tastes, meals,
       restaurants!inner(id, name, address, price_range, cities!inner(slug))`
    )
    .eq('restaurants.cities.slug', city)
    .is('deleted_at', null)
    .limit(12)

  if (plainText) {
    // Nothing recognisable — fall back to matching the name.
    dishQuery = dishQuery.ilike('name', pattern)
  } else {
    // Every taxonomy dimension present must hold (AND), so "spicy veg curry" narrows.
    if (parsed.categories.length) dishQuery = dishQuery.in('category', parsed.categories)
    if (parsed.diets.length) dishQuery = dishQuery.in('diet', parsed.diets)
    if (parsed.cuisines.length) dishQuery = dishQuery.in('cuisine', parsed.cuisines)
    if (parsed.tastes.length) dishQuery = dishQuery.overlaps('tastes', parsed.tastes)
    if (parsed.meals.length) dishQuery = dishQuery.overlaps('meals', parsed.meals)
    // Leftover words still have to appear in the name: "nutella brownie" -> baked + "nutella".
    if (parsed.text) dishQuery = dishQuery.ilike('name', `%${escapeLike(parsed.text)}%`)
  }

  const [dishesRes, restaurantsRes] = await Promise.all([
    dishQuery,
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

  const dishes: DishHit[] = (dishesRes.data ?? []).map((d: any) => ({
    kind: 'dish',
    matchedOn: plainText ? ('name' as const) : ('taxonomy' as const),
    id: d.id,
    name: d.name,
    restaurantId: d.restaurants.id,
    restaurantName: d.restaurants.name,
    area: areaOf(d.restaurants.address),
    priceSymbol: priceTierSymbol(d.restaurants.price_range),
    score: d.score === null || d.score === undefined ? null : Number(d.score),
    isMustTry: !!d.is_must_try,
  }))

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
