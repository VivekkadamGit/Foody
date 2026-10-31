import { describe, it, expect } from 'vitest'
import { filterByChips, toCandidate, type Candidate } from './candidates'

function row(over: Record<string, unknown> = {}) {
  return {
    id: 'd1', name: 'Dum Biryani', score: 9.1, is_must_try: true,
    category: 'rice', cuisine: 'mughlai', diet: 'non_veg', tastes: ['spicy', 'rich'], meals: ['dinner'],
    deleted_at: null,
    restaurants: {
      id: 'r1', name: 'Zaika', address: 'Athwa, Surat', price_range: 2, deleted_at: null,
      cities: { slug: 'surat', name: 'Surat' },
    },
    reviews: [],
    ...over,
  }
}

function cand(over: Partial<Candidate>): Candidate {
  return { ...(toCandidate(row()) as Candidate), ...over }
}

describe('toCandidate', () => {
  it('maps a dish row to a candidate with its city', () => {
    const c = toCandidate(row())!
    expect(c).toMatchObject({
      id: 'd1', name: 'Dum Biryani', restaurantName: 'Zaika', area: 'Athwa', score: 9.1, isMustTry: true,
      diet: 'non_veg', tastes: ['spicy', 'rich'], meals: ['dinner'], citySlug: 'surat', cityName: 'Surat',
    })
  })

  it('keeps an unscored dish with no reviews (shown as Not rated yet)', () => {
    expect(toCandidate(row({ score: null }))).not.toBeNull()
  })

  it('collects notes from live reviews only', () => {
    const c = toCandidate(row({
      reviews: [
        { taste_notes: 'Best biryani in town', deleted_at: null },
        { taste_notes: 'old visit', deleted_at: '2026-01-01' },
        { taste_notes: '  ', deleted_at: null },
      ],
    }))!
    expect(c.notes).toEqual(['Best biryani in town'])
  })

  it('drops a soft-deleted dish', () => {
    expect(toCandidate(row({ deleted_at: '2026-01-01' }))).toBeNull()
  })

  it('drops a dish whose restaurant is soft-deleted', () => {
    expect(toCandidate(row({ restaurants: { ...row().restaurants, deleted_at: '2026-01-01' } }))).toBeNull()
  })
})

describe('filterByChips', () => {
  const veg = cand({ id: 'veg', diet: 'veg', tastes: ['sweet'], meals: ['lunch'] })
  const nonVeg = cand({ id: 'nv', diet: 'non_veg', tastes: ['spicy'], meals: ['dinner'] })

  it('keeps only veg when diet=veg', () => {
    expect(filterByChips([veg, nonVeg], { diet: 'veg' }).map((c) => c.id)).toEqual(['veg'])
  })

  it('matches taste against the tastes array', () => {
    expect(filterByChips([veg, nonVeg], { taste: 'spicy' }).map((c) => c.id)).toEqual(['nv'])
  })

  it('matches meal against the meals array', () => {
    expect(filterByChips([veg, nonVeg], { meal: 'lunch' }).map((c) => c.id)).toEqual(['veg'])
  })

  it('ignores an unknown chip value', () => {
    expect(filterByChips([veg, nonVeg], { diet: 'pizza' })).toHaveLength(2)
  })
})
