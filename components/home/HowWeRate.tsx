const TIERS = [
  {
    label: 'FIRST TASTE · 1×',
    labelColor: 'text-sand',
    badgeBg: 'bg-white/[0.07]',
    badgeBorder: 'border-white/[0.16]',
    border: 'border-white/[0.09]',
    score: '8.5',
    scoreWeight: 'font-medium',
    scoreColor: 'text-sand-dark',
    copy: 'Live the same day. Score shown in a lighter weight, because one plate is an opinion, not a verdict.',
  },
  {
    label: 'HOLDING UP · 2×',
    labelColor: 'text-gold2',
    badgeBg: 'bg-gold2/[0.16]',
    badgeBorder: 'border-gold2/40',
    border: 'border-gold2/[0.28]',
    score: '8.7',
    scoreWeight: 'font-semibold',
    scoreColor: 'text-[#e8dfd6]',
    copy: 'Went back on a different day. If the score moved, the change is shown on the dish page with the date.',
  },
  {
    label: 'CONFIRMED · 3×+',
    labelColor: 'text-confirmed',
    badgeBg: 'bg-confirmed/[0.14]',
    badgeBorder: 'border-confirmed/40',
    border: 'border-confirmed/30',
    score: '9.2',
    scoreWeight: 'font-bold',
    scoreColor: 'text-[#fdf9f4]',
    copy: 'Three visits or more, across different days and hours. Full weight, and eligible for the top of the list.',
  },
]

export default function HowWeRate() {
  return (
    <section className="bg-ink px-6 py-14 border-t border-white/[0.06]">
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-[330px_1fr] gap-12 items-start">
        <div>
          <p className="font-anek text-[11.5px] font-semibold uppercase tracking-[0.18em] text-gold2 mb-3.5">How we rate</p>
          <h2 className="font-anek text-[34px] font-bold tracking-tight text-[#fdf9f4] mb-4 leading-[1.08]">
            A score that tells you how sure it is
          </h2>
          <p className="font-anek text-[14.5px] leading-[1.65] text-sand mb-4">
            Dishes go up the day they are eaten. Nothing sits in a drawer waiting to be perfect. Instead, every score
            says out loud how many times it has been tested — and it gets louder as it earns it.
          </p>
          <p className="font-anek text-[13.5px] leading-[1.65] text-sand-dark m-0">
            One person, weekends, paid for out of pocket. That is the whole operation, and it is on the record.
          </p>
        </div>

        <div className="grid gap-3.5">
          {TIERS.map((t) => (
            <div
              key={t.label}
              className={`grid grid-cols-[auto_1fr_auto] sm:grid-cols-[150px_1fr_78px] gap-5 items-center border ${t.border} rounded-xl px-5 py-4.5`}
            >
              <span className={`font-anek text-[10.5px] font-semibold px-2.5 py-1.5 rounded ${t.badgeBg} border ${t.badgeBorder} ${t.labelColor} tracking-wide justify-self-start whitespace-nowrap`}>
                {t.label}
              </span>
              <p className="font-anek text-[13.5px] leading-[1.6] text-sand m-0">{t.copy}</p>
              <span className={`font-barlow text-[30px] leading-none ${t.scoreWeight} ${t.scoreColor} text-right`}>{t.score}</span>
            </div>
          ))}

          <div className="flex items-center gap-3.5 px-5 py-3.5 rounded-xl bg-ink-card">
            <span className="font-anek text-[11px] font-semibold text-ember-light tracking-wide flex-shrink-0">ALWAYS</span>
            <p className="font-anek text-[13.5px] leading-[1.6] text-sand m-0">
              We pay for every plate. No free meals, no invitations, no sponsored placements — at any confidence level.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
