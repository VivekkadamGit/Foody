import type { SupabaseClient } from '@supabase/supabase-js'
import type { ParsedQuery } from '@/lib/taxonomy'
import { priceTierSymbol } from '@/lib/dishScore'
import { compareDishes, groupForMeal, pickBoard } from './rank'
import type { BoardEntry, DishGroup, DishHit, RestaurantHit, TrendingHit } from './types'

const DISH_SELECT = `id, name, score, is_must_try, category, cuisine,
  restaurants!inner(id, name, address, price_range, cities!inner(slug))`

const TRENDING_SELECT = `id, dish_name, place_name, area, why, source_url, photo_url,
  restaurant_id, buzz, cities!inner(slug)`

const ON_OUR_LIST_LIMIT = 6

/** `%` and `_` are ILIKE wildcards — escape them so a literal query stays literal. */
function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, (ch) => `\\${ch}`)
}

function areaOf(address: string | null | undefined): string | null {
  return address ? String(address).split(',')[0].trim() : null
}

function toDishHit(d: any, matchedOn: DishHit['matchedOn']): DishHit {
  return {
    kind: 'dish',
    matchedOn,
    id: d.id,
    name: d.name,
    restaurantId: d.restaurants.id,
    restaurantName: d.restaurants.name,
    area: areaOf(d.restaurants.address),
    priceSymbol: priceTierSymbol(d.restaurants.price_range),
    score: d.score === null || d.score === undefined ? null : Number(d.score),
    isMustTry: !!d.is_must_try,
    category: d.category ?? null,
    cuisine: d.cuisine ?? null,
  }
}

function toTrendingHit(t: any): TrendingHit {
  return {
    id: t.id,
    dishName: t.dish_name,
    placeName: t.place_name,
    area: t.area,
    why: t.why,
    sourceUrl: t.source_url,
    photoUrl: t.photo_url,
    restaurantId: t.restaurant_id,
    buzz: t.buzz ?? 1,
  }
}

/**
 * Every taxonomy dimension present must hold (AND), so "spicy veg curry" narrows.
 * Leftover words must appear in the name: "nutella brownie" -> baked + "nutella".
 * Shared by dishes and trending so both answer the same query the same way.
 */
function withFilters(query: any, f: ParsedQuery, nameColumn: string): any {
  if (f.categories.length) query = query.in('category', f.categories)
  if (f.diets.length) query = query.in('diet', f.diets)
  if (f.cuisines.length) query = query.in('cuisine', f.cuisines)
  if (f.tastes.length) query = query.overlaps('tastes', f.tastes)
  if (f.meals.length) query = query.overlaps('meals', f.meals)
  if (f.text) query = query.ilike(nameColumn, `%${escapeLike(f.text)}%`)
  return query
}

function dishesInCity(sb: SupabaseClient, city: string) {
  return sb
    .from('dishes')
    .select(DISH_SELECT)
    .eq('restaurants.cities.slug', city)
    .is('deleted_at', null)
    .is('restaurants.deleted_at', null)
}

function fail(what: string, message: string): never {
  console.error(`[search] ${what} failed:`, message)
  throw new Error(`${what} failed`)
}

/** specific: tag-matched dishes, best first. */
export async function fetchSpecific(sb: SupabaseClient, city: string, f: ParsedQuery): Promise<DishHit[]> {
  const { data, error } = await withFilters(dishesInCity(sb, city), f, 'name')
    .order('score', { ascending: false, nullsFirst: false })
    .limit(30)
  if (error) fail('specific query', error.message)
  return (data ?? []).map((d: any) => toDishHit(d, 'taxonomy')).sort(compareDishes)
}

/** meal: dishes tagged with the meal, grouped Thali / by cuisine. */
export async function fetchMeal(sb: SupabaseClient, city: string, f: ParsedQuery): Promise<DishGroup[]> {
  const { data, error } = await withFilters(dishesInCity(sb, city), f, 'name')
    .order('score', { ascending: false, nullsFirst: false })
    .limit(300)
  if (error) fail('meal query', error.message)
  return groupForMeal((data ?? []).map((d: any) => toDishHit(d, 'taxonomy')))
}

/** broad: top rated dish per category. */
export async function fetchBoard(sb: SupabaseClient, city: string): Promise<BoardEntry[]> {
  const { data, error } = await dishesInCity(sb, city)
    .not('score', 'is', null)
    .not('category', 'is', null)
    .order('score', { ascending: false, nullsFirst: false })
    .limit(1000)
  if (error) fail('board query', error.message)
  return pickBoard((data ?? []).map((d: any) => toDishHit(d, 'taxonomy')))
}

/** Chip-derived dimensions only. Categories/cuisines are deliberately excluded from the fallback. */
export type FuzzyFilter = Partial<Pick<ParsedQuery, 'diets' | 'tastes' | 'meals'>>

/** text: typo-tolerant name match across dishes, restaurants and viral entries. */
export async function fetchFuzzy(
  sb: SupabaseClient,
  city: string,
  text: string,
  filter: FuzzyFilter = {}
): Promise<{ dishes: DishHit[]; restaurants: RestaurantHit[]; trending: TrendingHit[] }> {
  const { data: hits, error } = await sb.rpc('search_fuzzy', { q: text, city_slug: city })
  if (error) fail('fuzzy search', error.message)

  const simOf = new Map<string, number>()
  const idsOf = (kind: string) =>
    (hits ?? []).filter((h: any) => h.hit_kind === kind).map((h: any) => {
      simOf.set(h.hit_id, Number(h.sim))
      return h.hit_id as string
    })
  const dishIds = idsOf('dish')
  const restaurantIds = idsOf('restaurant')
  const trendingIds = idsOf('trending')

  const f: ParsedQuery = { text: '', categories: [], cuisines: [], diets: [], tastes: [], meals: [], ...filter }
  const none = Promise.resolve({ data: [] as any[], error: null })
  const [dishRes, restRes, trendRes] = await Promise.all([
    dishIds.length
      ? withFilters(sb.from('dishes').select(DISH_SELECT).in('id', dishIds).is('deleted_at', null), f, 'name')
      : none,
    restaurantIds.length
      ? sb.from('restaurants').select('id, name, address, price_range, dishes(id)')
          .in('id', restaurantIds).is('dishes.deleted_at', null)
      : none,
    trendingIds.length
      ? withFilters(
          sb.from('trending_dishes').select(TRENDING_SELECT).in('id', trendingIds)
            .is('deleted_at', null).is('visited_dish_id', null),
          f,
          'dish_name'
        )
      : none,
  ])
  if (dishRes.error) fail('fuzzy dishes', dishRes.error.message)
  if (restRes.error) fail('fuzzy restaurants', restRes.error.message)
  if (trendRes.error) console.error('[search] fuzzy trending failed:', trendRes.error.message)

  const bySim = (a: { id: string }, b: { id: string }) => (simOf.get(b.id) ?? 0) - (simOf.get(a.id) ?? 0)

  const dishes = (dishRes.data ?? [])
    .map((d: any) => toDishHit(d, 'name'))
    .sort((a: DishHit, b: DishHit) => bySim(a, b) || compareDishes(a, b))

  const restaurants: RestaurantHit[] = (restRes.data ?? [])
    .map((r: any) => ({
      kind: 'restaurant' as const,
      id: r.id,
      name: r.name,
      area: areaOf(r.address),
      priceSymbol: priceTierSymbol(r.price_range),
      dishCount: (r.dishes ?? []).length,
    }))
    .sort(bySim)

  const trending = trendRes.error ? [] : (trendRes.data ?? []).map(toTrendingHit).sort(bySim)

  return { dishes, restaurants, trending }
}

/**
 * "On our list · visiting soon": viral places we plan to visit, same filters as the
 * dishes (null = no filter, for the broad board). A failure here must not take search
 * down — it degrades to an empty section.
 */
export async function fetchOnOurList(
  sb: SupabaseClient,
  city: string,
  f: ParsedQuery | null
): Promise<TrendingHit[]> {
  let query = sb
    .from('trending_dishes')
    .select(TRENDING_SELECT)
    .eq('cities.slug', city)
    .is('deleted_at', null)
    .is('visited_dish_id', null)
  if (f) query = withFilters(query, f, 'dish_name')

  const { data, error } = await query
    .order('buzz', { ascending: false })
    .order('rank', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(ON_OUR_LIST_LIMIT)

  if (error) {
    console.error('[search] on-our-list query failed:', error.message)
    return []
  }
  return (data ?? []).map(toTrendingHit)
}
