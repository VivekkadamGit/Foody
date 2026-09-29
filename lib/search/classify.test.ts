import { describe, it, expect } from 'vitest'
import { parseQuery } from '@/lib/taxonomy'
import { classifyQuery } from './classify'

const kindOf = (q: string) => classifyQuery(parseQuery(q))

describe('classifyQuery', () => {
  it.each([
    // specific: a category, cuisine, taste or diet
    ['best cake', 'specific'],
    ['cake', 'specific'],
    ['nutella brownie', 'specific'],
    ['spicy veg curry', 'specific'],
    ['south indian', 'specific'],
    ['veg', 'specific'],
    ['spicy', 'specific'],
    ['ice cream', 'specific'],
    ['best biryani in town', 'specific'],
    // a category beats a meal
    ['dinner thali', 'specific'],
    // meal: meal tag, no category/cuisine (diet/taste are just filters)
    ['dinner', 'meal'],
    ['best dinner', 'meal'],
    ['veg dinner', 'meal'],
    ['spicy breakfast', 'meal'],
    ['supper', 'meal'],
    // broad: nothing left after filler words
    ['best food in town', 'broad'],
    ['best', 'broad'],
    ['what to eat', 'broad'],
    ['top places in city', 'broad'],
    ['famous food', 'broad'],
    ['', 'broad'],
    // text: no tags, words remain
    ['nutella', 'text'],
    ['brwnie', 'text'],
    ['theobroma', 'text'],
    ['best theobroma', 'text'],
  ])('%s -> %s', (q, expected) => {
    expect(kindOf(q)).toBe(expected)
  })

  it('keeps the non-filler word as text', () => {
    expect(parseQuery('best theobroma in town').text).toBe('theobroma')
  })
})
