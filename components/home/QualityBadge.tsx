import { qualityIcon, qualityTier } from '@/lib/dishScore'

export default function QualityBadge({
  score,
  isMustTry,
  size = 'md',
  dark = true,
}: {
  score: number | null
  isMustTry: boolean
  size?: 'sm' | 'md'
  dark?: boolean
}) {
  const tier = qualityTier(score, isMustTry)

  if (tier === 'must_try') {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full border border-gold2/50 bg-gold2/20 font-anek font-bold tracking-wide whitespace-nowrap ${
          dark ? 'text-gold2' : 'text-[#8a6a2f]'
        } ${size === 'sm' ? 'text-[9px] px-1.5 py-0.5' : 'text-[10px] px-2 py-1'}`}
      >
        🏅 MUST TRY
      </span>
    )
  }

  return <span className={size === 'sm' ? 'text-base' : 'text-lg'}>{qualityIcon(tier)}</span>
}
