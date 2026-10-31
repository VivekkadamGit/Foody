import type { SupabaseClient } from '@supabase/supabase-js'
import { aiSearchEnabled } from '@/lib/ai/gemini'
import { parseQuery, stripFiller } from '@/lib/taxonomy'
import { fetchBoard, fetchFuzzy, fetchOnOurList } from '../fetch'
import { applyChips } from '../present'
import { runSearch } from '../run'
import type { ChipParams, RestaurantHit, SearchResponse } from '../types'
import { fetchCandidates, fetchOtherCityCandidates, filterByChips, type Candidate } from './candidates'
import { resolveMatch, resolveOtherCities, type MatchResult } from './resolve'

/** The two Gemini calls, injected so the page can cache them and tests can fake them. */
export type AiDeps = {
  match: (query: string, cands: Candidate[], key: string) => Promise<unknown>
  otherCities: (missing: string, cands: Candidate[], key: string) => Promise<unknown>
}

export function aiCacheKey(q: string, city: string, chips: ChipParams): string {
  const norm = q.toLowerCase().replace(/\s+/g, ' ').trim()
  return [norm, city, chips.diet ?? '', chips.taste ?? '', chips.meal ?? ''].join('|')
}

/**
 * /search's entry point. The AI decides which dishes fit, whatever the wording; anything
 * going wrong with it falls back to keyword search (runSearch), so search always answers.
 * The hero dropdown keeps calling runSearch directly — no AI per keystroke.
 */
export async function runAiSearch(
  sb: SupabaseClient,
  q: string,
  city: string,
  chips: ChipParams,
  deps: AiDeps
): Promise<SearchResponse> {
  q = q.slice(0, 100).trim()
  if (!q || !aiSearchEnabled()) return runSearch(sb, q, city, chips)

  let cands: Candidate[]
  try {
    cands = filterByChips(await fetchCandidates(sb, city), chips)
  } catch (err) {
    console.error('[search] ai candidates failed:', err)
    return runSearch(sb, q, city, chips)
  }
  if (cands.length === 0) return runSearch(sb, q, city, chips)

  const filters = applyChips(parseQuery(q), chips)
  // The dish ids are part of the key, so a dish added in the admin shows up on the next search.
  const key = `${aiCacheKey(q, city, chips)}|${fingerprint(cands)}`

  const restaurantsP: Promise<RestaurantHit[]> = fetchFuzzy(sb, city, stripFiller(q) || q)
    .then((r) => r.restaurants)
    .catch((err) => {
      console.error('[search] ai restaurant lookup failed:', err)
      return []
    })
  const onOurListP = fetchOnOurList(sb, city, filters)

  let match: MatchResult
  try {
    match = resolveMatch(await deps.match(q, cands, key), cands)
  } catch (err) {
    console.error('[search] ai failed:', err)
    return runSearch(sb, q, city, chips)
  }

  const [restaurants, onOurList] = await Promise.all([restaurantsP, onOurListP])

  if (match.ranked.length > 0) {
    return { kind: 'ai', filters, ranked: match.ranked, showing: match.showing, onOurList, restaurants }
  }

  // The AI found nothing; maybe the words are a name it didn't connect ("Cake Walk").
  const keyword = await runSearch(sb, q, city, chips)
  if (!keyword.empty) return keyword

  const missing = match.missing ?? q
  const otherCities = await findOtherCities(sb, city, chips, missing, deps)
  const res: SearchResponse = {
    kind: 'ai', filters, ranked: [], showing: match.showing, onOurList, restaurants,
    empty: true, missing, closest: match.closest, otherCities,
  }
  if (match.closest.length === 0 && otherCities.length === 0 && onOurList.length === 0) {
    res.board = await fetchBoard(sb, city)
  }
  return res
}

/** Short, stable digest of which dishes the AI was shown. */
function fingerprint(cands: Candidate[]): string {
  let h = 0
  for (const id of cands.map((c) => c.id).sort()) {
    for (let i = 0; i < id.length; i++) h = (Math.imul(h, 31) + id.charCodeAt(i)) | 0
  }
  return `${cands.length}.${(h >>> 0).toString(36)}`
}

/** "We've tried it in Vadodara" — best effort; any failure just leaves the line out. */
async function findOtherCities(
  sb: SupabaseClient,
  city: string,
  chips: ChipParams,
  missing: string,
  deps: AiDeps
): Promise<{ slug: string; name: string }[]> {
  try {
    const others = filterByChips(await fetchOtherCityCandidates(sb, city), chips)
    if (others.length === 0) return []
    return resolveOtherCities(await deps.otherCities(missing, others, aiCacheKey(missing, city, chips)), others)
  } catch (err) {
    console.error('[search] ai other cities failed:', err)
    return []
  }
}
