// Confidence tiers and 10-point scores derived from real review counts/ratings —
// never fabricated, since these are the app's core trust signals.

export type ConfidenceTier = 'FIRST_TASTE' | 'HOLDING_UP' | 'CONFIRMED'

export function confidenceTier(reviewCount: number): ConfidenceTier {
  if (reviewCount >= 3) return 'CONFIRMED'
  if (reviewCount === 2) return 'HOLDING_UP'
  return 'FIRST_TASTE'
}

export function confidenceLabel(reviewCount: number): string {
  const tier = confidenceTier(reviewCount)
  const word = tier === 'CONFIRMED' ? 'CONFIRMED' : tier === 'HOLDING_UP' ? 'HOLDING UP' : 'FIRST TASTE'
  return `${word} · ${reviewCount}×`
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
