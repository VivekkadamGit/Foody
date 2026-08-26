const CANDIDATES = [
  { name: 'Kesar Kulfi House', pct: 41, lead: true },
  { name: 'Sindhi Dabeli, Vastrapur', pct: 33, lead: false },
  { name: 'Ranip ghughra stall', pct: 26, lead: false },
]

export default function VotingBox() {
  return (
    <div className="border border-dashed border-white/[0.18] rounded-xl p-4.5">
      <p className="font-anek text-[15px] font-semibold text-[#fdf9f4] mb-1.5">What should I cover next?</p>
      <p className="font-anek text-[12.5px] leading-[1.6] text-sand-dark mb-3.5">
        Three places are on the shortlist — coming soon.
      </p>
      <div className="grid gap-2">
        {CANDIDATES.map((c) => (
          <div key={c.name} className="flex justify-between items-center px-3 py-2.5 border border-white/10 rounded-lg">
            <span className="font-anek text-[13px] font-medium text-[#e8dfd6]">{c.name}</span>
            <span className={`font-barlow text-[12px] font-semibold ${c.lead ? 'text-ember-light' : 'text-sand-dark'}`}>
              {c.pct}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
