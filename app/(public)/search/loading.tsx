/** AI search takes a few seconds; show where the answer will land instead of a frozen page. */
export default function Loading() {
  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10" aria-busy="true">
      <p className="font-anek text-[15px] text-sand-dark mb-6">Finding what fits…</p>
      <div className="grid grid-cols-1 gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-[76px] rounded-2xl border border-warm-200 bg-white animate-pulse" />
        ))}
      </div>
    </main>
  )
}
