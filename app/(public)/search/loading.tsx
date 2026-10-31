import ChakhLoader from '@/components/search/ChakhLoader'

/** AI search takes a few seconds; show that Chakh is on it instead of a frozen page. */
export default function Loading() {
  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10" aria-busy="true">
      <ChakhLoader />
    </main>
  )
}
