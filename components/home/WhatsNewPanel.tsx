export type WhatsNewItem =
  | { type: 'new_opening'; name: string; date: string }
  | { type: 'new_dish'; name: string; score: number; date: string }

function timeAgo(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (days <= 0) return 'today'
  if (days === 1) return '1 day ago'
  if (days < 7) return `${days} days ago`
  if (days < 14) return 'last week'
  const weeks = Math.floor(days / 7)
  return `${weeks} weeks ago`
}

const BADGE_STYLE: Record<string, string> = {
  new_opening: 'bg-ember/20 border-ember/45 text-[#e8735f]',
  new_dish: 'bg-confirmed/[0.14] border-confirmed/40 text-confirmed',
  season: 'bg-gold2/[0.16] border-gold2/40 text-gold2',
}

export default function WhatsNewPanel({ items }: { items: WhatsNewItem[] }) {
  const rows: { badge: string; label: string; time: string; title: string; detail: string }[] = items.map((item) =>
    item.type === 'new_opening'
      ? { badge: 'new_opening', label: 'NEW OPENING', time: timeAgo(item.date), title: item.name, detail: 'Not tasted yet. Next on the list.' }
      : {
          badge: 'new_dish',
          label: 'NEW DISH',
          time: timeAgo(item.date),
          title: item.name,
          detail: `Tasted once. Score provisional at ${item.score.toFixed(1)}.`,
        }
  )

  if (rows.length < 3) {
    rows.push({
      badge: 'season',
      label: 'SEASON OPENS',
      time: 'seasonal',
      title: 'Undhiyu and ponk',
      detail: 'Rescored every winter. Last year’s notes stay up until then.',
    })
  }

  return (
    <div>
      <p className="font-anek text-[11.5px] font-semibold uppercase tracking-[0.18em] text-gold2 mb-2.5">
        What&apos;s new in the city
      </p>
      <h3 className="font-anek text-2xl font-bold tracking-tight text-[#fdf9f4] mb-4">For the curious</h3>
      <div className="border border-white/[0.09] rounded-xl overflow-hidden">
        {rows.slice(0, 3).map((row, i) => (
          <div
            key={i}
            className={`p-4 flex gap-3.5 items-start ${i < rows.length - 1 ? 'border-b border-white/[0.07]' : ''}`}
          >
            <div
              className="w-[46px] h-[46px] rounded-lg flex-shrink-0"
              style={{ background: 'repeating-linear-gradient(135deg,#2b211c 0 7px,#221a16 7px 14px)' }}
            />
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={`font-anek text-[9px] font-semibold px-1.5 py-1 rounded border tracking-wide ${BADGE_STYLE[row.badge]}`}>
                  {row.label}
                </span>
                <span className="font-anek text-[11px] text-sand-darker">{row.time}</span>
              </div>
              <p className="font-anek text-[15px] font-semibold text-[#fdf9f4] mb-0.5">{row.title}</p>
              <p className="font-anek text-[12.5px] leading-[1.5] text-sand-dark m-0">{row.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
