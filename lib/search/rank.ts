import { CATEGORY_TREE, labelFor, type CategoryLeaf, type CategoryParent } from '@/lib/taxonomy'
import type { BoardEntry, DishGroup, DishHit } from './types'

/** The one ordering used everywhere: score desc (unrated last), must-try, then name. */
export function compareDishes(a: DishHit, b: DishHit): number {
  if (a.score === null && b.score !== null) return 1
  if (b.score === null && a.score !== null) return -1
  if (a.score !== null && b.score !== null && a.score !== b.score) return b.score - a.score
  if (a.isMustTry !== b.isMustTry) return a.isMustTry ? -1 : 1
  return a.name.localeCompare(b.name)
}

export const GROUP_SIZE = 3

/** Thali is how people think about dinner, so it gets its own group; the rest go by cuisine. */
function groupKeyOf(d: DishHit): string {
  if (d.category === 'thali') return 'thali'
  return d.cuisine ?? 'other'
}

function groupLabel(key: string): string {
  return key === 'other' ? 'Other' : labelFor(key)
}

/** "dinner" -> Thali / North Indian / South Indian …, top 3 each, strongest group first. */
export function groupForMeal(dishes: DishHit[]): DishGroup[] {
  const byKey = new Map<string, DishHit[]>()
  for (const d of dishes) {
    const key = groupKeyOf(d)
    byKey.set(key, [...(byKey.get(key) ?? []), d])
  }

  return Array.from(byKey, ([key, ds]) => ({
    key,
    label: groupLabel(key),
    dishes: [...ds].sort(compareDishes).slice(0, GROUP_SIZE),
  })).sort((a, b) => compareDishes(a.dishes[0], b.dishes[0]))
}

const BOARD_PARENT_ORDER: CategoryParent[] = ['main', 'snack', 'dessert', 'beverage']

/** Readable names for the board — "Best Baked" reads badly. */
export const BOARD_LABELS: Record<CategoryLeaf, string> = {
  baked: 'Cakes & Bakes',
  frozen: 'Ice Cream',
  dessert_drink: 'Dessert Drink',
  coffee: 'Coffee',
  tea: 'Chai',
  shake: 'Shake',
  juice: 'Juice',
  thali: 'Thali',
  curry: 'Curry',
  rice: 'Biryani & Rice',
  bread: 'Breads',
  noodles: 'Noodles',
  roll: 'Rolls',
  chaat: 'Chaat',
  fried: 'Fried Snacks',
  sandwich: 'Sandwich',
}

/** "best food in town" -> the single top-rated dish per category. Unrated never qualifies. */
export function pickBoard(dishes: DishHit[]): BoardEntry[] {
  const board: BoardEntry[] = []
  for (const parent of BOARD_PARENT_ORDER) {
    for (const leaf of CATEGORY_TREE[parent] as readonly CategoryLeaf[]) {
      const best = dishes
        .filter((d) => d.category === leaf && d.score !== null)
        .sort(compareDishes)[0]
      if (best) board.push({ category: leaf, label: `Best ${BOARD_LABELS[leaf]}`, dish: best })
    }
  }
  return board
}
