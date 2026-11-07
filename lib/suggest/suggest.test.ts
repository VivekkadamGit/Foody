import { describe, it, expect } from 'vitest'
import type { Candidate } from '@/lib/search/ai/candidates'
import { buildSuggestPrompt, dishLine, resolveSuggestion } from './suggest'

function cand(id: string, over: Partial<Candidate> = {}): Candidate {
  return {
    kind: 'dish', id, name: `Dish ${id}`, restaurantId: `r-${id}`, restaurantName: 'Cafe', area: 'Adajan', priceSymbol: '₹₹',
    score: 8.5, isMustTry: false, category: 'frozen', cuisine: null, matchedOn: 'taxonomy',
    diet: 'veg', tastes: ['sweet'], meals: ['anytime'], notes: [], citySlug: 'surat', cityName: 'Surat',
    ...over,
  }
}

describe('dishLine', () => {
  it('shows the score out of 10', () => {
    expect(dishLine(cand('a'))).toContain('Score: 8.5/10')
  })

  it('marks an unscored dish as not rated, with no number', () => {
    const line = dishLine(cand('a', { score: null }))
    expect(line).toContain('Not rated yet')
    expect(line).not.toContain('/10')
  })

  it('includes the id, place, tags, must-try and notes', () => {
    const line = dishLine(cand('a', { isMustTry: true, notes: ['great crust'] }))
    for (const part of ['id: a', 'Cafe', 'Surat', 'sweet', 'MUST TRY', 'great crust']) expect(line).toContain(part)
  })

  it('leaves out MUST TRY when it is not', () => {
    expect(dishLine(cand('a'))).not.toContain('MUST TRY')
  })
})

describe('buildSuggestPrompt', () => {
  it('lists every dish, rated or not', () => {
    const prompt = buildSuggestPrompt('sweet', [cand('a'), cand('b', { score: null })])
    expect(prompt).toContain('id: a')
    expect(prompt).toContain('id: b')
  })

  it('asks for a reply written to the visitor', () => {
    expect(buildSuggestPrompt('sweet', [cand('a')])).toContain('Write the reason to the visitor')
  })

  it('carries the request', () => {
    expect(buildSuggestPrompt('kuch meetha', [cand('a')])).toContain('kuch meetha')
  })
})

describe('resolveSuggestion', () => {
  const cs = [cand('a'), cand('b', { citySlug: 'vadodara', cityName: 'Vadodara', restaurantId: 'r-b' })]

  it('takes every fact from the real dish, not the AI', () => {
    const r = resolveSuggestion({ id: 'b', dish: 'Made up', restaurant: 'Fake', city: 'Mars', reason: 'Tasty.' }, cs)
    expect(r).toEqual({ dish: 'Dish b', restaurant: 'Cafe', city: 'Vadodara', score: 8.5, reason: 'Tasty.', link: '/vadodara/r-b' })
  })

  it('returns null for an unrated dish, so the page can say so whatever the AI wrote', () => {
    const r = resolveSuggestion({ id: 'c', reason: 'Spicy.' }, [cand('c', { score: null })])
    expect(r.dish).toBe('Dish c')
    expect(r.score).toBeNull()
  })

  it('refuses an id that is not a real dish', () => {
    const r = resolveSuggestion({ id: 'zzz', reason: 'You will love it.' }, cs)
    expect(r.dish).toBeNull()
    expect(r.link).toBeNull()
    expect(r.reason).not.toContain('love it')
  })

  it('passes the explanation through when the AI found nothing', () => {
    const r = resolveSuggestion({ id: null, reason: 'Nothing spicy yet.' }, cs)
    expect(r).toEqual({ dish: null, restaurant: null, city: null, score: null, reason: 'Nothing spicy yet.', link: null })
  })

  it.each([['a string', 'nope'], ['null', null], ['no fields', {}]])('survives junk: %s', (_label, raw) => {
    expect(resolveSuggestion(raw, cs).dish).toBeNull()
  })
})
