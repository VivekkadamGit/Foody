import type { ParsedQuery } from '@/lib/taxonomy'
import type { SearchKind } from './types'

/**
 * Picks how a query is answered. Precedence: specific > meal > text > broad.
 *
 *   "best cake"          -> specific  (ranked list)
 *   "veg dinner"         -> meal      (grouped; veg is a filter inside the groups)
 *   "dinner thali"       -> specific  (a category beats a meal)
 *   "best food in town"  -> broad     (City's Best board)
 *   "brwnie"             -> text      (fuzzy name match)
 */
export function classifyQuery(p: ParsedQuery): SearchKind {
  if (p.categories.length > 0 || p.cuisines.length > 0) return 'specific'
  if (p.meals.length > 0) return 'meal'
  if (p.tastes.length > 0 || p.diets.length > 0) return 'specific'
  if (p.text) return 'text'
  return 'broad'
}
