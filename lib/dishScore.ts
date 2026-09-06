// Quality tier + icon, derived from the real score and review count — a quick visual
// read ("is this worth it") rather than exposing our own visit/review bookkeeping.

export type QualityTier = 'top' | 'mid' | 'new'

export function qualityTier(score: number, reviewCount: number): QualityTier {
  if (reviewCount <= 1) return 'new'
  return score >= 9.0 ? 'top' : 'mid'
}

export function qualityIcon(tier: QualityTier): string {
  return tier === 'top' ? '🏅' : tier === 'new' ? '🌱' : '⭐'
}

export function qualityLabel(tier: QualityTier): string {
  return tier === 'top' ? 'Certified' : tier === 'new' ? 'New' : 'Rated'
}

// Explained legend for the quality filter — icon + name + a one-line rule, so
// people don't have to guess what a badge means (à la Rotten Tomatoes' Tomatometer filter).
export const QUALITY_LEGEND: { tier: QualityTier; icon: string; label: string; description: string }[] = [
  { tier: 'top', icon: '🏅', label: 'Certified', description: '9.0+ score — the best of the best.' },
  { tier: 'mid', icon: '⭐', label: 'Rated', description: 'Tasted more than once, holding steady.' },
  { tier: 'new', icon: '🌱', label: 'New', description: 'Just added — first taste, score is provisional.' },
]

export function scoreOutOf10(avgRatingOutOf5: number): number {
  return Math.round(avgRatingOutOf5 * 2 * 10) / 10
}

export function avgRating(ratings: number[]): number {
  if (ratings.length === 0) return 0
  return ratings.reduce((sum, r) => sum + r, 0) / ratings.length
}

export function priceTierSymbol(priceRange: number | null | undefined): string {
  if (!priceRange) return '₹'
  return '₹'.repeat(Math.min(Math.max(priceRange, 1), 3))
}
