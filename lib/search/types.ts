import type { CategoryLeaf, ParsedQuery } from '@/lib/taxonomy'

/** How a query is answered. See docs/superpowers/specs/2026-09-30-smart-search-design.md §2.1 */
export type SearchKind = 'specific' | 'meal' | 'broad' | 'text'

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
  category: string | null
  cuisine: string | null
  /** Whether this came back on its name or on its tags. */
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

/** A viral place Chakh plans to visit. Never has a score. */
export type TrendingHit = {
  id: string
  dishName: string
  placeName: string
  area: string | null
  why: string
  sourceUrl: string | null
  photoUrl: string | null
  restaurantId: string | null
  buzz: number
}

export type DishGroup = { key: string; label: string; dishes: DishHit[] }

export type BoardEntry = { category: CategoryLeaf; label: string; dish: DishHit }

export type SearchResponse = {
  kind: SearchKind
  /** What was understood — drives chips and headings. */
  filters: ParsedQuery
  ranked?: DishHit[]
  groups?: DishGroup[]
  board?: BoardEntry[]
  onOurList: TrendingHit[]
  restaurants: RestaurantHit[]
  /** Nothing rated matched; `board` is included as a suggestion. */
  empty?: boolean
}

/** Filter chips carried as URL params on /search, on top of the typed query. */
export type ChipParams = { diet?: string; taste?: string; meal?: string }
