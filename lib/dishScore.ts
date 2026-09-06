// Quality tier + icon, derived from the real score and review count — a quick visual
// read ("is this worth it") rather than exposing our own visit/review bookkeeping.

export type QualityTier = 'top' | 'mid' | 'new'

export function qualityTier(score: number, reviewCount: number): QualityTier {
  if (reviewCount <= 1) return 'new'
  return score >= 9.0 ? 'top' : 'mid'
}

export function qualityIcon(tier: QualityTier): string {
  return tier === 'top' ? '🔥' : tier === 'new' ? '🌱' : '⭐'
}

export function qualityLabel(tier: QualityTier): string {
  return tier === 'top' ? 'Top rated' : tier === 'new' ? 'New' : 'Rated'
}

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
