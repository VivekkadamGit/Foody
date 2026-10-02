import {
  CATEGORY_LEAVES, CATEGORY_TREE, CUISINES, DIETS, MEALS, TASTES, labelFor,
  type CategoryLeaf, type CategoryParent, type Cuisine, type Diet, type Meal, type Taste,
} from '@/lib/taxonomy'
import { BOARD_LABELS } from '@/lib/search/rank'

/** The search-facing tags on a dish (and on a viral entry). Vocabulary: lib/taxonomy.ts. */
export type DishTags = {
  diet: Diet | null
  category: CategoryLeaf | null
  cuisine: Cuisine | null
  tastes: Taste[]
  meals: Meal[]
}

export const EMPTY_TAGS: DishTags = { diet: null, category: null, cuisine: null, tastes: [], meals: [] }

function single<T extends string>(dim: string, vocab: readonly T[], v: unknown): T | null {
  if (v === null || v === undefined || v === '') return null
  if (typeof v !== 'string' || !(vocab as readonly string[]).includes(v)) throw new Error(`Unknown ${dim}: ${String(v)}`)
  return v as T
}

function multi<T extends string>(dim: string, key: string, vocab: readonly T[], v: unknown): T[] {
  if (!Array.isArray(v)) throw new Error(`${key} must be a list`)
  for (const x of v) {
    if (typeof x !== 'string' || !(vocab as readonly string[]).includes(x)) throw new Error(`Unknown ${dim}: ${String(x)}`)
  }
  return Array.from(new Set(v as T[]))
}

/**
 * Server-side guard for every tag write. Only the keys present are validated and
 * returned, so a partial update never blanks tags it didn't mention.
 */
export function validateTags(input: Record<string, unknown>): Partial<DishTags> {
  const out: Partial<DishTags> = {}
  if ('diet' in input) out.diet = single('diet', DIETS, input.diet)
  if ('category' in input) out.category = single('category', CATEGORY_LEAVES, input.category)
  if ('cuisine' in input) out.cuisine = single('cuisine', CUISINES, input.cuisine)
  if ('tastes' in input) out.tastes = multi('taste', 'tastes', TASTES, input.tastes)
  if ('meals' in input) out.meals = multi('meal', 'meals', MEALS, input.meals)
  return out
}

export function tagLabel(dim: 'diet' | 'category' | 'cuisine' | 'taste' | 'meal', value: string): string {
  if (dim === 'category' && value in BOARD_LABELS) return BOARD_LABELS[value as CategoryLeaf]
  return labelFor(value)
}

const GROUP_ORDER: { parent: CategoryParent; label: string }[] = [
  { parent: 'main', label: 'Mains' },
  { parent: 'snack', label: 'Snacks' },
  { parent: 'dessert', label: 'Desserts' },
  { parent: 'beverage', label: 'Drinks' },
]

export const CATEGORY_GROUPS = GROUP_ORDER.map((g) => ({
  ...g,
  leaves: [...(CATEGORY_TREE[g.parent] as readonly CategoryLeaf[])],
}))
