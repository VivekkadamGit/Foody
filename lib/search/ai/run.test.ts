import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import * as fetchers from '../fetch'
import * as keyword from '../run'
import * as gemini from '@/lib/ai/gemini'
import * as candidates from './candidates'
import { aiCacheKey, runAiSearch, type AiDeps } from './run'
import type { Candidate } from './candidates'
import type { BoardEntry, SearchResponse, TrendingHit } from '../types'

vi.mock('../fetch')
vi.mock('../run')
vi.mock('@/lib/ai/gemini')
vi.mock('./candidates', async (orig) => ({
  ...(await orig<typeof import('./candidates')>()),
  fetchCandidates: vi.fn(),
  fetchOtherCityCandidates: vi.fn(),
}))

const sb = {} as SupabaseClient
const f = vi.mocked(fetchers)
const c = vi.mocked(candidates)
const runSearch = vi.mocked(keyword.runSearch)
const enabled = vi.mocked(gemini.aiSearchEnabled)

function cand(id: string, over: Partial<Candidate> = {}): Candidate {
  return {
    kind: 'dish', id, name: id, restaurantId: 'r', restaurantName: 'R', area: null, priceSymbol: '₹',
    score: 8, isMustTry: false, category: null, cuisine: null, matchedOn: 'taxonomy',
    diet: 'veg', tastes: [], meals: [], notes: [], citySlug: 'surat', cityName: 'Surat', ...over,
  }
}

const emptyFilters = { text: '', categories: [], diets: [], tastes: [], meals: [], cuisines: [] }
const keywordHit: SearchResponse = { kind: 'specific', filters: emptyFilters, ranked: [cand('kw')], onOurList: [], restaurants: [] }
const keywordEmpty: SearchResponse = { ...keywordHit, ranked: [], empty: true, board: [] }
const board: BoardEntry[] = [{ category: 'baked', label: 'Best Cakes & Bakes', dish: cand('board') }]
const trend: TrendingHit = { id: 't', dishName: 't', placeName: 'p', area: null, why: 'w', sourceUrl: null, photoUrl: null, restaurantId: null, buzz: 1 }

let deps: { match: ReturnType<typeof vi.fn>; otherCities: ReturnType<typeof vi.fn> }

beforeEach(() => {
  vi.resetAllMocks()
  enabled.mockReturnValue(true)
  c.fetchCandidates.mockResolvedValue([cand('a', { score: 7 }), cand('b', { score: 9 })])
  c.fetchOtherCityCandidates.mockResolvedValue([cand('v', { citySlug: 'vadodara', cityName: 'Vadodara' })])
  f.fetchOnOurList.mockResolvedValue([])
  f.fetchBoard.mockResolvedValue(board)
  f.fetchFuzzy.mockResolvedValue({ dishes: [], restaurants: [], trending: [] })
  runSearch.mockResolvedValue(keywordHit)
  deps = {
    match: vi.fn().mockResolvedValue({ ids: ['a', 'b'], showing: ['Sweet'], missing: null, closest: [] }),
    otherCities: vi.fn().mockResolvedValue({ cities: [] }),
  }
})

const run = (q: string, chips = {}) => runAiSearch(sb, q, 'surat', chips, deps as unknown as AiDeps)

describe('runAiSearch', () => {
  it('empty q goes to runSearch without calling match', async () => {
    expect(await run('  ')).toBe(keywordHit)
    expect(deps.match).not.toHaveBeenCalled()
  })

  it('AI_SEARCH off goes to runSearch', async () => {
    enabled.mockReturnValue(false)
    expect(await run('sweet')).toBe(keywordHit)
    expect(deps.match).not.toHaveBeenCalled()
  })

  it('no candidates after chips: match not called, runSearch used', async () => {
    expect(await run('sweet', { diet: 'non_veg' })).toBe(keywordHit)
    expect(deps.match).not.toHaveBeenCalled()
  })

  it('match rejects -> runSearch result', async () => {
    deps.match.mockRejectedValue(new Error('timeout'))
    expect(await run('sweet')).toBe(keywordHit)
  })

  it('bad output -> runSearch result', async () => {
    deps.match.mockResolvedValue('not json')
    expect(await run('sweet')).toBe(keywordHit)
  })

  it('matches -> kind ai, score-ordered, with showing and restaurants', async () => {
    const rest = { kind: 'restaurant' as const, id: 'rr', name: 'Sweet Spot', area: null, priceSymbol: '₹', dishCount: 2 }
    f.fetchFuzzy.mockResolvedValue({ dishes: [], restaurants: [rest], trending: [] })
    f.fetchOnOurList.mockResolvedValue([trend])
    const res = await run('sweet')
    expect(res.kind).toBe('ai')
    expect(res.ranked?.map((d) => d.id)).toEqual(['b', 'a'])
    expect(res.showing).toEqual(['Sweet'])
    expect(res.restaurants).toEqual([rest])
    expect(res.onOurList).toEqual([trend])
    expect(res.empty).toBeUndefined()
    expect(runSearch).not.toHaveBeenCalled()
  })

  it('a failing restaurant lookup does not break the AI answer', async () => {
    f.fetchFuzzy.mockRejectedValue(new Error('rpc down'))
    const res = await run('sweet')
    expect(res.kind).toBe('ai')
    expect(res.restaurants).toEqual([])
  })

  it('no matches but keyword finds something -> keyword result', async () => {
    deps.match.mockResolvedValue({ ids: [], missing: 'x', closest: [] })
    expect(await run('x')).toBe(keywordHit)
  })

  it('no matches anywhere -> empty state with missing, closest, otherCities and no board', async () => {
    runSearch.mockResolvedValue(keywordEmpty)
    deps.match.mockResolvedValue({ ids: [], missing: 'sushi', closest: ['a'] })
    deps.otherCities.mockResolvedValue({ cities: ['vadodara'] })
    const res = await run('sushi please')
    expect(res).toMatchObject({ kind: 'ai', empty: true, missing: 'sushi', otherCities: [{ slug: 'vadodara', name: 'Vadodara' }] })
    expect(res.closest?.map((d) => d.id)).toEqual(['a'])
    expect(res.board).toBeUndefined()
    expect(deps.otherCities.mock.calls[0][0]).toBe('sushi')
  })

  it('missing falls back to the query', async () => {
    runSearch.mockResolvedValue(keywordEmpty)
    deps.match.mockResolvedValue({ ids: [], missing: null, closest: ['a'] })
    expect((await run('sushi')).missing).toBe('sushi')
  })

  it('nothing close, no other cities, no on-our-list -> board included', async () => {
    runSearch.mockResolvedValue(keywordEmpty)
    deps.match.mockResolvedValue({ ids: [], missing: 'sushi', closest: [] })
    const res = await run('sushi')
    expect(res.empty).toBe(true)
    expect(res.board).toEqual(board)
  })

  it('otherCities failure -> empty state still returned', async () => {
    runSearch.mockResolvedValue(keywordEmpty)
    deps.match.mockResolvedValue({ ids: [], missing: 'sushi', closest: ['a'] })
    deps.otherCities.mockRejectedValue(new Error('timeout'))
    const res = await run('sushi')
    expect(res.empty).toBe(true)
    expect(res.otherCities).toEqual([])
  })

  it('chips filter the other-city candidates too', async () => {
    runSearch.mockResolvedValue(keywordEmpty)
    deps.match.mockResolvedValue({ ids: [], missing: 'sushi', closest: [] })
    c.fetchOtherCityCandidates.mockResolvedValue([
      cand('v1', { citySlug: 'vadodara', cityName: 'Vadodara', diet: 'non_veg' }),
    ])
    await run('sushi', { diet: 'veg' })
    expect(deps.otherCities).not.toHaveBeenCalled()
  })
})

describe('aiCacheKey', () => {
  it('normalizes case and spaces', () => {
    expect(aiCacheKey('  Top   CLASS food ', 'surat', {})).toBe(aiCacheKey('top class food', 'surat', {}))
  })

  it('differs by chip and city', () => {
    const base = aiCacheKey('sweet', 'surat', {})
    expect(aiCacheKey('sweet', 'surat', { diet: 'veg' })).not.toBe(base)
    expect(aiCacheKey('sweet', 'vadodara', {})).not.toBe(base)
  })
})
