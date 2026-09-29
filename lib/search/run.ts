import type { SupabaseClient } from '@supabase/supabase-js'
import { parseQuery, stripFiller } from '@/lib/taxonomy'
import { classifyQuery } from './classify'
import { applyChips } from './present'
import { fetchBoard, fetchFuzzy, fetchMeal, fetchOnOurList, fetchSpecific } from './fetch'
import type { ChipParams, SearchResponse } from './types'

/**
 * The single entry point for search. Both the API route (hero dropdown) and the
 * /search page call this, so they can never disagree.
 *
 * Fallbacks (spec §2.3) — there is never a dead end:
 *   specific with no dishes -> retry as text -> still nothing -> empty + City's Best.
 * FUTURE (RAG): queries that end up `empty` are where AI search plugs in, returning
 * this same SearchResponse shape.
 */
export async function runSearch(
  sb: SupabaseClient,
  q: string,
  city: string,
  chips: ChipParams = {}
): Promise<SearchResponse> {
  q = q.slice(0, 100)
  const filters = applyChips(parseQuery(q), chips)
  const kind = classifyQuery(filters)
  // Chip-derived dimensions only: typed categories/cuisines would defeat "cake" -> "Cake Walk".
  const chipFilter = { diets: filters.diets, tastes: filters.tastes, meals: filters.meals }

  if (kind === 'broad') {
    const [board, onOurList] = await Promise.all([fetchBoard(sb, city), fetchOnOurList(sb, city, null)])
    return { kind, filters, board, onOurList, restaurants: [] }
  }

  if (kind === 'meal') {
    const [groups, onOurList] = await Promise.all([fetchMeal(sb, city, filters), fetchOnOurList(sb, city, filters)])
    if (groups.length > 0) return { kind, filters, groups, onOurList, restaurants: [] }
    return { kind, filters, groups, onOurList, restaurants: [], empty: true, board: await fetchBoard(sb, city) }
  }

  if (kind === 'text') {
    const fuzzy = await fetchFuzzy(sb, city, filters.text || q, chipFilter)
    const base = { kind, filters, ranked: fuzzy.dishes, onOurList: fuzzy.trending, restaurants: fuzzy.restaurants }
    if (fuzzy.dishes.length > 0) return base
    return { ...base, empty: true, board: await fetchBoard(sb, city) }
  }

  // specific
  const [ranked, onOurList] = await Promise.all([
    fetchSpecific(sb, city, filters),
    fetchOnOurList(sb, city, filters),
  ])
  if (ranked.length > 0) return { kind, filters, ranked, onOurList, restaurants: [] }

  // Tags matched nothing rated — maybe the words are in a name ("cake" in "Cake Walk").
  // Filler words ("best", "in town") would only dilute the name match; chip filters still apply.
  const stripped = stripFiller(q)
  if (!stripped) {
    return { kind, filters, ranked: [], onOurList, restaurants: [], empty: true, board: await fetchBoard(sb, city) }
  }
  const fuzzy = await fetchFuzzy(sb, city, stripped, chipFilter)
  const list = onOurList.length > 0 ? onOurList : fuzzy.trending
  if (fuzzy.dishes.length > 0) {
    return { kind: 'text', filters, ranked: fuzzy.dishes, onOurList: list, restaurants: fuzzy.restaurants }
  }
  return {
    kind, filters, ranked: [], onOurList: list, restaurants: fuzzy.restaurants,
    empty: true, board: await fetchBoard(sb, city),
  }
}
