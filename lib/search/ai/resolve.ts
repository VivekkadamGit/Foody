import { compareDishes } from '../rank'
import type { DishHit } from '../types'
import type { Candidate } from './candidates'

export type MatchResult = { ranked: DishHit[]; showing: string[]; missing: string | null; closest: DishHit[] }

const MAX_RANKED = 10
const MAX_CLOSEST = 3
const MAX_SHOWING = 4
const MAX_LABEL = 40

function toDish({ diet, tastes, meals, notes, citySlug, cityName, ...dish }: Candidate): DishHit {
  return dish
}

/** Unknown ids are dropped and repeats collapse — the AI can never put a dish on the page. */
function pick(raw: unknown, byId: Map<string, Candidate>, skip: Set<string>, max: number): DishHit[] {
  const seen = new Set<string>()
  const out: Candidate[] = []
  for (const id of Array.isArray(raw) ? raw : []) {
    if (typeof id !== 'string' || seen.has(id) || skip.has(id)) continue
    seen.add(id)
    const c = byId.get(id)
    if (c) out.push(c)
  }
  // The AI chooses which dishes fit; Vivek's scores decide the order.
  return out.map(toDish).sort(compareDishes).slice(0, max)
}

export function resolveMatch(raw: unknown, cands: Candidate[]): MatchResult {
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as any).ids)) throw new Error('bad_ai_output')
  const r = raw as Record<string, unknown>
  const byId = new Map(cands.map((c) => [c.id, c]))

  const ranked = pick(r.ids, byId, new Set(), MAX_RANKED)
  const closest = pick(r.closest, byId, new Set(ranked.map((d) => d.id)), MAX_CLOSEST)
  const showing = (Array.isArray(r.showing) ? r.showing : [])
    .filter((s): s is string => typeof s === 'string' && s.trim() !== '')
    .map((s) => s.trim().slice(0, MAX_LABEL))
    .slice(0, MAX_SHOWING)
  const missing = typeof r.missing === 'string' && r.missing.trim() ? r.missing.trim() : null

  return { ranked, showing, missing, closest }
}

export function resolveOtherCities(raw: unknown, cands: Candidate[]): { slug: string; name: string }[] {
  const names = new Map(cands.map((c) => [c.citySlug, c.cityName]))
  const slugs = raw && typeof raw === 'object' && Array.isArray((raw as any).cities) ? (raw as any).cities : []
  const seen = new Set<string>()
  const out: { slug: string; name: string }[] = []
  for (const slug of slugs) {
    if (typeof slug !== 'string' || seen.has(slug) || !names.has(slug)) continue
    seen.add(slug)
    out.push({ slug, name: names.get(slug)! })
  }
  return out
}
