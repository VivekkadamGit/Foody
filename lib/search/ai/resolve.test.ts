import { describe, it, expect } from 'vitest'
import { resolveMatch, resolveOtherCities } from './resolve'
import type { Candidate } from './candidates'

function cand(id: string, over: Partial<Candidate> = {}): Candidate {
  return {
    kind: 'dish', id, name: id, restaurantId: 'r', restaurantName: 'R', area: null, priceSymbol: '₹',
    score: 8, isMustTry: false, category: null, cuisine: null, matchedOn: 'taxonomy',
    diet: null, tastes: [], meals: [], notes: ['nice'], citySlug: 'surat', cityName: 'Surat',
    ...over,
  }
}

const ab = [cand('a'), cand('b')]
const ids = (ds: { id: string }[]) => ds.map((d) => d.id)

describe('resolveMatch', () => {
  it('drops unknown ids', () => {
    expect(ids(resolveMatch({ ids: ['a', 'zzz'] }, ab).ranked)).toEqual(['a'])
  })

  it('dedupes ids', () => {
    expect(ids(resolveMatch({ ids: ['a', 'a'] }, ab).ranked)).toEqual(['a'])
  })

  it('caps at 10', () => {
    const many = Array.from({ length: 15 }, (_, i) => cand(`d${i}`))
    expect(resolveMatch({ ids: many.map((c) => c.id) }, many).ranked).toHaveLength(10)
  })

  it('orders by score, not AI order', () => {
    const cs = [cand('low', { score: 6.5, isMustTry: true }), cand('high', { score: 9.2 })]
    expect(ids(resolveMatch({ ids: ['low', 'high'] }, cs).ranked)).toEqual(['high', 'low'])
  })

  it('strips Candidate extras down to the DishHit shape', () => {
    const [d] = resolveMatch({ ids: ['a'] }, ab).ranked
    expect(d).not.toHaveProperty('notes')
    expect(d).not.toHaveProperty('citySlug')
  })

  it('caps closest at 3 and excludes ranked ids', () => {
    const cs = ['a', 'b', 'c', 'd', 'e'].map((id) => cand(id))
    const r = resolveMatch({ ids: ['a'], closest: ['a', 'b', 'c', 'd', 'e'] }, cs)
    expect(ids(r.closest)).toEqual(['b', 'c', 'd'])
  })

  it('keeps up to 4 showing labels of at most 40 chars, dropping non-strings', () => {
    const r = resolveMatch({ ids: [], showing: ['Sweet', 7, 'x'.repeat(60), 'Light', 'Veg', 'Extra'] }, ab)
    expect(r.showing).toEqual(['Sweet', 'x'.repeat(40), 'Light', 'Veg'])
  })

  it('passes missing through when it is a non-empty string', () => {
    expect(resolveMatch({ ids: [], missing: ' sushi ' }, ab).missing).toBe('sushi')
    expect(resolveMatch({ ids: [], missing: 3 }, ab).missing).toBeNull()
  })

  it.each([['a string', 'nope'], ['null', null], ['missing ids', { showing: [] }], ['ids not an array', { ids: 'a' }]])(
    'throws bad_ai_output on %s',
    (_label, raw) => {
      expect(() => resolveMatch(raw, ab)).toThrow('bad_ai_output')
    }
  )
})

describe('resolveOtherCities', () => {
  const cs = [cand('x', { citySlug: 'vadodara', cityName: 'Vadodara' }), cand('y', { citySlug: 'vadodara', cityName: 'Vadodara' })]

  it('keeps only known slugs, deduped, with names', () => {
    expect(resolveOtherCities({ cities: ['vadodara', 'mumbai', 'vadodara'] }, cs)).toEqual([
      { slug: 'vadodara', name: 'Vadodara' },
    ])
  })

  it('returns [] for junk', () => {
    expect(resolveOtherCities('junk', cs)).toEqual([])
  })
})
