import { qualityIcon, qualityTier } from '@/lib/dishScore'

export default function QualityBadge({
  score,
  reviewCount,
  size = 'md',
  dark = true,
}: {
  score: number
  reviewCount: number
  size?: 'sm' | 'md'
  dark?: boolean
}) {
  const tier = qualityTier(score, reviewCount)

  if (tier === 'top') {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full border border-gold2/50 bg-gold2/20 font-anek font-bold tracking-wide whitespace-nowrap ${
          dark ? 'text-gold2' : 'text-[#8a6a2f]'
        } ${size === 'sm' ? 'text-[9px] px-1.5 py-0.5' : 'text-[10px] px-2 py-1'}`}
      >
        🏅 CERTIFIED
      </span>
    )
  }

  return <span className={size === 'sm' ? 'text-base' : 'text-lg'}>{qualityIcon(tier)}</span>
}
