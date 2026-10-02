import Link from 'next/link'
import type { ParsedQuery } from '@/lib/taxonomy'
import { CHIPS, chipHref, chipState } from '@/lib/search/present'
import type { ChipParams } from '@/lib/search/types'

export default function FilterChips({
  q,
  city,
  typed,
  chips,
}: {
  q: string
  city: string
  /** Parsed from the typed words only — those chips show as on but aren't links. */
  typed: ParsedQuery
  chips: ChipParams
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {CHIPS.map((chip) => {
        const state = chipState(typed, chips, chip)
        const on = 'border-ember bg-ember text-white'
        const off = 'border-warm-200 text-charcoal hover:border-ember/60'
        const cls = `rounded-full border px-3.5 py-1.5 font-anek text-[13px] font-medium transition-colors`
        if (state === 'typed') {
          return <span key={chip.value} aria-label={`${chip.label} (from your search)`} className={`${cls} ${on} opacity-80`}>{chip.label}</span>
        }
        return (
          <Link
            key={chip.value}
            href={chipHref(q, city, chips, chip)}
            aria-current={state === 'param' ? 'true' : undefined}
            className={`${cls} ${state === 'param' ? on : off}`}>
            {chip.label}
          </Link>
        )
      })}
    </div>
  )
}
