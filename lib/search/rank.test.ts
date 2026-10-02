import { describe, it, expect } from 'vitest'
import type { DishHit } from './types'
import { compareDishes, groupForMeal, pickBoard } from './rank'

function dish(over: Partial<DishHit> & { id: string }): DishHit {
  return {
    kind: 'dish',
    name: over.id,
    restaurantId: 'r1',
    restaurantName: 'R',
    area: null,
    priceSymbol: '₹',
    score: null,
    isMustTry: false,
    category: null,
    cuisine: null,
    matchedOn: 'taxonomy',
    ...over,
  }
}

const ids = (ds: DishHit[]) => ds.map((d) => d.id)

describe('compareDishes', () => {
  it('orders by score desc, unrated last, must-try breaks ties, then name', () => {
    const list = [
      dish({ id: 'unrated' }),
      dish({ id: 'b-8', score: 8 }),
      dish({ id: 'a-8', score: 8 }),
      dish({ id: 'must-8', score: 8, isMustTry: true }),
      dish({ id: 'top-9', score: 9 }),
    ]
    expect(ids([...list].sort(compareDishes))).toEqual(['top-9', 'must-8', 'a-8', 'b-8', 'unrated'])
  })
})

describe('groupForMeal', () => {
  it('puts thali in its own group, groups the rest by cuisine, null cuisine as Other', () => {
    const groups = groupForMeal([
      dish({ id: 'gujarati-thali', category: 'thali', cuisine: 'gujarati', score: 7 }),
      dish({ id: 'paneer', category: 'curry', cuisine: 'north_indian', score: 9 }),
      dish({ id: 'dosa', category: 'fried', cuisine: 'south_indian', score: 6 }),
      dish({ id: 'mystery', category: 'curry', cuisine: null, score: 5 }),
    ])
    expect(groups.map((g) => [g.key, g.label])).toEqual([
      ['north_indian', 'North Indian'],
      ['thali', 'Thali'],
      ['south_indian', 'South Indian'],
      ['other', 'Other'],
    ])
  })

  it('keeps the top 3 per group and orders groups by their best dish, unrated groups last', () => {
    const groups = groupForMeal([
      dish({ id: 'c1', cuisine: 'chinese' }),
      dish({ id: 'n1', cuisine: 'north_indian', score: 6 }),
      dish({ id: 'n2', cuisine: 'north_indian', score: 9 }),
      dish({ id: 'n3', cuisine: 'north_indian', score: 7 }),
      dish({ id: 'n4', cuisine: 'north_indian', score: 8 }),
    ])
    expect(groups.map((g) => g.key)).toEqual(['north_indian', 'chinese'])
    expect(ids(groups[0].dishes)).toEqual(['n2', 'n4', 'n3'])
  })

  it('returns no groups for no dishes', () => {
    expect(groupForMeal([])).toEqual([])
  })
})

describe('pickBoard', () => {
  it('takes the top rated dish per category, in main/snack/dessert/beverage order', () => {
    const board = pickBoard([
      dish({ id: 'latte', category: 'coffee', score: 8 }),
      dish({ id: 'brownie', category: 'baked', score: 9 }),
      dish({ id: 'cheesecake', category: 'baked', score: 9.5 }),
      dish({ id: 'biryani', category: 'rice', score: 7 }),
      dish({ id: 'chaat', category: 'chaat', score: 6 }),
    ])
    expect(board.map((b) => [b.category, b.dish.id, b.label])).toEqual([
      ['rice', 'biryani', 'Best Biryani & Rice'],
      ['chaat', 'chaat', 'Best Chaat'],
      ['baked', 'cheesecake', 'Best Cakes & Bakes'],
      ['coffee', 'latte', 'Best Coffee'],
    ])
  })

  it('never puts an unrated dish on the board', () => {
    expect(pickBoard([dish({ id: 'x', category: 'baked', score: null })])).toEqual([])
  })
})
