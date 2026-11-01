import type { SupabaseClient } from '@supabase/supabase-js'
import { DIETS, MEALS, TASTES } from '@/lib/taxonomy'
import { toDishHit } from '../fetch'
import type { ChipParams, DishHit } from '../types'

/** A dish as the AI sees it: the card fields plus everything it reasons with. */
export type Candidate = DishHit & {
  diet: string | null
  tastes: string[]
  meals: string[]
  /** Vivek's taste notes from live reviews — where "praised" comes from. */
  notes: string[]
  citySlug: string
  cityName: string
}

const CANDIDATE_SELECT = `id, name, score, is_must_try, category, cuisine, diet, tastes, meals, deleted_at,
  restaurants!inner(id, name, address, price_range, deleted_at, cities!inner(slug, name, status)),
  reviews(taste_notes, deleted_at)`

/**
 * Every live dish in a live restaurant. Unscored dishes are kept (they show as
 * "Not rated yet", as keyword search does) — see ledger ruling on the candidate rule.
 */
export function toCandidate(row: any): Candidate | null {
  if (row.deleted_at || row.restaurants?.deleted_at) return null
  const notes = (row.reviews ?? [])
    .filter((r: any) => !r.deleted_at)
    .map((r: any) => String(r.taste_notes ?? '').trim())
    .filter(Boolean)
  return {
    ...toDishHit(row, 'taxonomy'),
    diet: row.diet ?? null,
    tastes: row.tastes ?? [],
    meals: row.meals ?? [],
    notes,
    citySlug: row.restaurants.cities.slug,
    cityName: row.restaurants.cities.name,
  }
}

const known = (vocab: readonly string[], v?: string) => (v && vocab.includes(v) ? v : undefined)

/** Chips are hard filters, applied before the AI sees anything. Unknown values are ignored. */
export function filterByChips(cands: Candidate[], chips: ChipParams): Candidate[] {
  const diet = known(DIETS, chips.diet)
  const taste = known(TASTES, chips.taste)
  const meal = known(MEALS, chips.meal)
  return cands.filter(
    (c) =>
      (!diet || c.diet === diet) &&
      (!taste || c.tastes.includes(taste)) &&
      (!meal || c.meals.includes(meal))
  )
}

function toCandidates(data: any[] | null): Candidate[] {
  return (data ?? []).map(toCandidate).filter((c): c is Candidate => c !== null)
}

export async function fetchCandidates(sb: SupabaseClient, city: string): Promise<Candidate[]> {
  const { data, error } = await sb
    .from('dishes')
    .select(CANDIDATE_SELECT)
    .eq('restaurants.cities.slug', city)
    .is('deleted_at', null)
    .is('restaurants.deleted_at', null)
    .limit(500)
  if (error) throw new Error(`candidates failed: ${error.message}`)
  return toCandidates(data)
}

/** Dishes in every other live city — only fetched for the "We've tried it in…" line. */
export async function fetchOtherCityCandidates(sb: SupabaseClient, excludeCity: string): Promise<Candidate[]> {
  const { data, error } = await sb
    .from('dishes')
    .select(CANDIDATE_SELECT)
    .neq('restaurants.cities.slug', excludeCity)
    .eq('restaurants.cities.status', 'active')
    .is('deleted_at', null)
    .is('restaurants.deleted_at', null)
    .limit(1000)
  if (error) throw new Error(`other-city candidates failed: ${error.message}`)
  return toCandidates(data)
}
