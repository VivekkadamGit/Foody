import { describe, it, expect } from 'vitest'
import { validateTags, tagLabel, EMPTY_TAGS, CATEGORY_GROUPS } from './dishTags'

describe('validateTags', () => {
  it('passes valid values through and only returns keys that were given', () => {
    expect(validateTags({ diet: 'veg', tastes: ['sweet', 'rich'] })).toEqual({ diet: 'veg', tastes: ['sweet', 'rich'] })
  })
  it('accepts null for single-value dimensions', () => {
    expect(validateTags({ diet: null, category: null, cuisine: null })).toEqual({ diet: null, category: null, cuisine: null })
  })
  it('dedupes multi-value dimensions', () => {
    expect(validateTags({ meals: ['dinner', 'dinner', 'lunch'] })).toEqual({ meals: ['dinner', 'lunch'] })
  })
  it.each([
    [{ diet: 'carnivore' }, 'Unknown diet: carnivore'],
    [{ category: 'soup' }, 'Unknown category: soup'],
    [{ cuisine: 'thai' }, 'Unknown cuisine: thai'],
    [{ tastes: ['umami'] }, 'Unknown taste: umami'],
    [{ meals: ['midnight'] }, 'Unknown meal: midnight'],
    [{ tastes: 'sweet' }, 'tastes must be a list'],
  ])('rejects %j', (input, message) => {
    expect(() => validateTags(input)).toThrow(message)
  })
  it('EMPTY_TAGS is fully empty', () => {
    expect(EMPTY_TAGS).toEqual({ diet: null, category: null, cuisine: null, tastes: [], meals: [] })
  })
})

describe('tagLabel', () => {
  it('uses board labels for categories and labelFor otherwise', () => {
    expect(tagLabel('category', 'baked')).toBe('Cakes & Bakes')
    expect(tagLabel('diet', 'non_veg')).toBe('Non Veg')
    expect(tagLabel('cuisine', 'south_indian')).toBe('South Indian')
  })
})

describe('CATEGORY_GROUPS', () => {
  it('groups every leaf once, in Mains/Snacks/Desserts/Drinks order', () => {
    expect(CATEGORY_GROUPS.map((g) => g.label)).toEqual(['Mains', 'Snacks', 'Desserts', 'Drinks'])
    expect(CATEGORY_GROUPS.flatMap((g) => g.leaves)).toHaveLength(16)
  })
})
