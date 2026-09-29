import { describe, it, expect } from 'vitest'
import { parseQuery } from '@/lib/taxonomy'
import type { DishHit, SearchResponse } from './types'
import { CHIPS, applyChips, chipHref, chipState, headingFor, previewDishes, summaryLine } from './present'

const chip = (value: string) => CHIPS.find((c) => c.value === value)!

function dish(id: string): DishHit {
  return {
    kind: 'dish', id, name: id, restaurantId: 'r', restaurantName: 'R', area: null,
    priceSymbol: '₹', score: 8, isMustTry: false, category: null, cuisine: null, matchedOn: 'taxonomy',
  }
}

function response(over: Partial<SearchResponse>): SearchResponse {
  return { kind: 'specific', filters: parseQuery(''), onOurList: [], restaurants: [], ...over }
}

describe('applyChips', () => {
  it('adds valid chip values without duplicating typed ones', () => {
    const p = applyChips(parseQuery('veg cake'), { diet: 'veg', meal: 'dinner' })
    expect(p.diets).toEqual(['veg'])
    expect(p.meals).toEqual(['dinner'])
    expect(p.categories).toEqual(['baked'])
  })

  it('ignores values outside the vocabulary', () => {
    const p = applyChips(parseQuery('cake'), { diet: 'carnivore', taste: 'umami' })
    expect(p.diets).toEqual([])
    expect(p.tastes).toEqual([])
  })
})

describe('chipState', () => {
  it('distinguishes typed, param and off', () => {
    const typed = parseQuery('veg cake')
    expect(chipState(typed, {}, chip('veg'))).toBe('typed')
    expect(chipState(typed, { taste: 'sweet' }, chip('sweet'))).toBe('param')
    expect(chipState(typed, {}, chip('spicy'))).toBe('off')
  })
})

describe('chipHref', () => {
  it('turns a chip on, keeping the query and city', () => {
    expect(chipHref('best cake', 'surat', {}, chip('veg'))).toBe('/search?q=best+cake&city=surat&diet=veg')
  })
  it('turns an active chip off', () => {
    expect(chipHref('best cake', 'surat', { diet: 'veg' }, chip('veg'))).toBe('/search?q=best+cake&city=surat')
  })
  it('replaces another value in the same dimension', () => {
    expect(chipHref('cake', 'surat', { taste: 'sweet' }, chip('spicy'))).toBe('/search?q=cake&city=surat&taste=spicy')
  })
})

describe('headingFor', () => {
  it('names each kind', () => {
    expect(headingFor(response({ kind: 'specific' }), 'best cake', 'Surat')).toBe('Best cake in Surat')
    expect(headingFor(response({ kind: 'specific' }), '', 'Surat')).toBe('Top picks in Surat')
    expect(headingFor(response({ kind: 'meal', filters: parseQuery('veg dinner') }), 'veg dinner', 'Surat')).toBe('Veg Dinner in Surat')
    expect(headingFor(response({ kind: 'broad' }), 'best food in town', 'Surat')).toBe("Surat's Best")
    expect(headingFor(response({ kind: 'text' }), 'brwnie', 'Surat')).toBe('Results for "brwnie"')
  })
})

describe('previewDishes / summaryLine', () => {
  it('flattens whichever layout came back', () => {
    expect(previewDishes(response({ ranked: [dish('a'), dish('b')] })).map((d) => d.id)).toEqual(['a', 'b'])
    expect(
      previewDishes(response({ kind: 'meal', groups: [{ key: 'x', label: 'X', dishes: [dish('a')] }, { key: 'y', label: 'Y', dishes: [dish('b')] }] })).map((d) => d.id)
    ).toEqual(['a', 'b'])
    expect(
      previewDishes(response({ kind: 'broad', board: [{ category: 'baked', label: 'Best Cakes & Bakes', dish: dish('a') }] })).map((d) => d.id)
    ).toEqual(['a'])
  })

  it('caps the preview at 5', () => {
    const many = ['a', 'b', 'c', 'd', 'e', 'f'].map(dish)
    expect(previewDishes(response({ ranked: many }))).toHaveLength(5)
  })

  it('does not preview the suggestion board of an empty result', () => {
    expect(previewDishes(response({ empty: true, ranked: [], board: [{ category: 'baked', label: 'x', dish: dish('a') }] }))).toEqual([])
  })

  it('summarises counts', () => {
    const trend = { id: 't', dishName: 'd', placeName: 'p', area: null, why: 'w', sourceUrl: null, photoUrl: null, restaurantId: null, buzz: 2 }
    expect(summaryLine(response({ ranked: [dish('a'), dish('b')], onOurList: [trend] }))).toBe('2 dishes · 1 on our list')
    expect(summaryLine(response({ ranked: [dish('a')] }))).toBe('1 dish')
  })
})
