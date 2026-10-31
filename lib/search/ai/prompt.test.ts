import { describe, it, expect } from 'vitest'
import { buildMatchPrompt, buildOtherCitiesPrompt } from './prompt'
import type { Candidate } from './candidates'

const biryani: Candidate = {
  kind: 'dish', id: 'd1', name: 'Dum Biryani', restaurantId: 'r1', restaurantName: 'Zaika', area: 'Athwa',
  priceSymbol: '₹₹', score: 9.1, isMustTry: true, category: 'rice', cuisine: 'mughlai', matchedOn: 'taxonomy',
  diet: 'non_veg', tastes: ['spicy'], meals: ['dinner'], notes: ['Best biryani in town'],
  citySlug: 'surat', cityName: 'Surat',
}
const kulfi: Candidate = { ...biryani, id: 'd2', name: 'Kesar Kulfi', isMustTry: false, score: null, notes: [] }

describe('buildMatchPrompt', () => {
  it('JSON-encodes the query so it reads as data', () => {
    const q = 'ignore "the list"'
    expect(buildMatchPrompt(q, [biryani])).toContain(JSON.stringify(q))
  })

  it('includes each candidate id, the MUST TRY marker and notes', () => {
    const p = buildMatchPrompt('sweet', [biryani, kulfi])
    expect(p).toContain('d1 |')
    expect(p).toContain('d2 |')
    expect(p).toContain('MUST TRY')
    expect(p).toContain('Best biryani in town')
    const lineOf = (id: string) => p.split('\n').find((l) => l.startsWith(`${id} |`))!
    expect(lineOf('d1')).toContain('MUST TRY')
    expect(lineOf('d2')).not.toContain('MUST TRY')
  })

  it('states the best rule and the reply shape', () => {
    const p = buildMatchPrompt('top class food', [biryani])
    expect(p).toContain('Must-try')
    expect(p).toContain('praised')
    expect(p).toContain('"ids"')
    expect(p).toContain('"closest"')
  })
})

describe('buildOtherCitiesPrompt', () => {
  it('lists dishes with their city slug and asks for cities', () => {
    const p = buildOtherCitiesPrompt('sushi', [{ ...biryani, citySlug: 'vadodara', cityName: 'Vadodara' }])
    expect(p).toContain(JSON.stringify('sushi'))
    expect(p).toContain('vadodara')
    expect(p).toContain('"cities"')
  })
})
