const SAMPLE_VIDEOS = [
  { title: 'Fafda jalebi, 6am', score: '9.2', meta: 'Visit 6 of 6 · 8:14' },
  { title: 'Going back to Das Khaman', score: '8.9', meta: 'Visit 4 · score moved up 0.3 · 6:31' },
  { title: 'First taste: cheese khichu', score: '7.6', meta: 'Provisional · 5:02', muted: true },
]

export default function WatchSection() {
  return (
    <section className="bg-ink-light px-6 py-14 border-t border-white/[0.06]">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-end justify-between mb-6 flex-wrap gap-4">
          <div>
            <p className="font-anek text-[11.5px] font-semibold uppercase tracking-[0.18em] text-gold2 mb-3">Watch the visit</p>
            <h2 className="font-anek text-[34px] font-bold tracking-tight text-[#fdf9f4] mb-2 leading-[1.06]">
              Filmed the day it&apos;s tasted
            </h2>
            <p className="font-anek text-[14.5px] text-sand m-0 max-w-lg">
              The queue, the counter, the plate arriving — coming soon on the channel.
            </p>
          </div>
          <a
            href="#"
            className="font-anek text-[13px] font-semibold px-[18px] py-2.5 rounded-full border border-white/[0.18] text-[#fdf9f4] hover:border-white/35 transition-colors whitespace-nowrap"
          >
            Subscribe on YouTube
          </a>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4.5">
          {SAMPLE_VIDEOS.map((v) => (
            <div key={v.title} className="border border-white/[0.08] rounded-xl overflow-hidden bg-ink">
              <div
                className="h-[154px] flex items-center justify-center"
                style={{ background: 'repeating-linear-gradient(135deg,#2b211c 0 8px,#221a16 8px 16px)' }}
              >
                <span className="w-[46px] h-[46px] rounded-full bg-ember/90" />
              </div>
              <div className="p-4">
                <div className="flex justify-between items-baseline mb-1.5">
                  <span className="font-anek text-[15px] font-semibold text-[#fdf9f4]">{v.title}</span>
                  <span className={`font-barlow text-[20px] leading-none ${v.muted ? 'font-medium text-sand' : 'font-bold text-ember-light'}`}>
                    {v.score}
                  </span>
                </div>
                <p className="font-anek text-[12.5px] text-sand-dark m-0">{v.meta}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
