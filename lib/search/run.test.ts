import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import * as fetchers from './fetch'
import { runSearch } from './run'
import type { BoardEntry, DishGroup, DishHit, RestaurantHit, TrendingHit } from './types'

vi.mock('./fetch')

const mocked = vi.mocked(fetchers)
const sb = {} as SupabaseClient

function dish(id: string): DishHit {
  return {
    kind: 'dish', id, name: id, restaurantId: 'r', restaurantName: 'R', area: null,
    priceSymbol: '₹', score: 8, isMustTry: false, category: null, cuisine: null, matchedOn: 'taxonomy',
  }
}
function trend(id: string): TrendingHit {
  return { id, dishName: id, placeName: 'p', area: null, why: 'w', sourceUrl: null, photoUrl: null, restaurantId: null, buzz: 1 }
}
const board: BoardEntry[] = [{ category: 'baked', label: 'Best Cakes & Bakes', dish: dish('board') }]
const group: DishGroup = { key: 'thali', label: 'Thali', dishes: [dish('t1')] }
const rest: RestaurantHit = { kind: 'restaurant', id: 'rr', name: 'Cake Walk', area: null, priceSymbol: '₹', dishCount: 2 }
const noFuzzy = { dishes: [], restaurants: [], trending: [] }

beforeEach(() => {
  vi.resetAllMocks()
  mocked.fetchBoard.mockResolvedValue(board)
  mocked.fetchOnOurList.mockResolvedValue([])
  mocked.fetchSpecific.mockResolvedValue([])
  mocked.fetchMeal.mockResolvedValue([])
  mocked.fetchFuzzy.mockResolvedValue(noFuzzy)
})

describe('runSearch', () => {
  it('broad -> board', async () => {
    const res = await runSearch(sb, 'best food in town', 'surat')
    expect(res.kind).toBe('broad')
    expect(res.board).toEqual(board)
    expect(res.empty).toBeUndefined()
  })

  it('meal with groups', async () => {
    mocked.fetchMeal.mockResolvedValue([group])
    const res = await runSearch(sb, 'dinner', 'surat')
    expect(res.kind).toBe('meal')
    expect(res.groups).toEqual([group])
    expect(res.empty).toBeUndefined()
  })

  it('meal empty -> empty + board', async () => {
    const res = await runSearch(sb, 'dinner', 'surat')
    expect(res.kind).toBe('meal')
    expect(res.empty).toBe(true)
    expect(res.board).toEqual(board)
  })

  it('text with hits', async () => {
    mocked.fetchFuzzy.mockResolvedValue({ dishes: [dish('a')], restaurants: [rest], trending: [trend('t')] })
    const res = await runSearch(sb, 'brwnie', 'surat')
    expect(res.kind).toBe('text')
    expect(res.ranked).toEqual([dish('a')])
    expect(res.onOurList).toEqual([trend('t')])
    expect(res.restaurants).toEqual([rest])
    expect(res.empty).toBeUndefined()
  })

  it('text with none -> empty + board', async () => {
    const res = await runSearch(sb, 'zzzz', 'surat')
    expect(res.kind).toBe('text')
    expect(res.empty).toBe(true)
    expect(res.board).toEqual(board)
  })

  it('specific with hits', async () => {
    mocked.fetchSpecific.mockResolvedValue([dish('a')])
    const res = await runSearch(sb, 'best cake', 'surat')
    expect(res.kind).toBe('specific')
    expect(res.ranked).toEqual([dish('a')])
    expect(mocked.fetchFuzzy).not.toHaveBeenCalled()
  })

  it('specific -> fallback hits become text and keep our-list', async () => {
    mocked.fetchOnOurList.mockResolvedValue([trend('own')])
    mocked.fetchFuzzy.mockResolvedValue({ dishes: [dish('cw')], restaurants: [rest], trending: [trend('fz')] })
    const res = await runSearch(sb, 'cake', 'surat')
    expect(res.kind).toBe('text')
    expect(res.ranked).toEqual([dish('cw')])
    expect(res.onOurList).toEqual([trend('own')])
    expect(res.empty).toBeUndefined()
  })

  it('specific -> fallback uses fuzzy trending when our-list is empty', async () => {
    mocked.fetchFuzzy.mockResolvedValue({ dishes: [dish('cw')], restaurants: [], trending: [trend('fz')] })
    const res = await runSearch(sb, 'cake', 'surat')
    expect(res.onOurList).toEqual([trend('fz')])
  })

  it('specific -> fallback none -> empty + board', async () => {
    const res = await runSearch(sb, 'cake', 'surat')
    expect(res.kind).toBe('specific')
    expect(res.empty).toBe(true)
    expect(res.board).toEqual(board)
    expect(res.ranked).toEqual([])
  })

  it('chip + fallback: fuzzy gets stripped text and the diet filter only', async () => {
    await runSearch(sb, 'best brwnie in town', 'surat', { diet: 'non_veg' })
    // "brwnie" is not taxonomy, so this is a text query; use a specific one below too.
    expect(mocked.fetchFuzzy).toHaveBeenCalledWith(
      sb, 'surat', 'brwnie', { diets: ['non_veg'], tastes: [], meals: [] }
    )
  })

  it('specific fallback passes chip filters but not categories/cuisines', async () => {
    await runSearch(sb, 'best cake in town', 'surat', { diet: 'non_veg' })
    expect(mocked.fetchFuzzy).toHaveBeenCalledWith(
      sb, 'surat', 'cake', { diets: ['non_veg'], tastes: [], meals: [] }
    )
  })

  it('chip-only empty query skips fuzzy', async () => {
    const res = await runSearch(sb, '', 'surat', { diet: 'veg' })
    expect(mocked.fetchFuzzy).not.toHaveBeenCalled()
    expect(res.empty).toBe(true)
    expect(res.board).toEqual(board)
  })

  it('caps the query length', async () => {
    await runSearch(sb, 'x'.repeat(500), 'surat')
    const text = mocked.fetchFuzzy.mock.calls[0][2]
    expect(text.length).toBe(100)
  })
})
