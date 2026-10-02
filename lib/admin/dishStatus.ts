import { isUntagged } from '@/lib/taxonomy'

export type DishStatus = 'deleted' | 'needs_tags' | 'needs_score' | 'scored'

/** Precedence: deleted → needs_tags → needs_score → scored. */
export function dishStatus(d: {
  score: number | null
  diet: string | null
  category: string | null
  deleted_at: string | null
}): DishStatus {
  if (d.deleted_at) return 'deleted'
  if (isUntagged(d)) return 'needs_tags'
  if (d.score === null) return 'needs_score'
  return 'scored'
}
