// Quality tier + icon. The score is set by hand on the dish and the must-try flag is
// an editorial call — neither is derived from how many times a dish has been visited.
// One visit, one judgement, edited if it changes.

export type QualityTier = 'must_try' | 'rated' | 'unrated'

export function qualityTier(score: number | null, isMustTry: boolean): QualityTier {
  if (isMustTry) return 'must_try'
  return score === null ? 'unrated' : 'rated'
}

export function qualityIcon(tier: QualityTier): string {
  return tier === 'must_try' ? '🏅' : tier === 'unrated' ? '🌱' : '⭐'
}

export function qualityLabel(tier: QualityTier): string {
  return tier === 'must_try' ? 'Must try' : tier === 'unrated' ? 'Not rated yet' : 'Rated'
}

// Explained legend for the quality filter — icon + name + a one-line rule, so
// people don't have to guess what a badge means (à la Rotten Tomatoes' Tomatometer filter).
export const QUALITY_LEGEND: { tier: QualityTier; icon: string; label: string; description: string }[] = [
  { tier: 'must_try', icon: '🏅', label: 'Must try', description: 'Worth going out of your way for.' },
  { tier: 'rated', icon: '⭐', label: 'Rated', description: 'Tasted and scored.' },
  { tier: 'unrated', icon: '🌱', label: 'Not rated yet', description: 'On the list, not tasted yet.' },
]

/** Formats a dish score for display, or a dash when it has not been scored. */
export function formatScore(score: number | null): string {
  return score === null ? '—' : score.toFixed(1)
}

export function priceTierSymbol(priceRange: number | null | undefined): string {
  if (!priceRange) return '₹'
  return '₹'.repeat(Math.min(Math.max(priceRange, 1), 3))
}
