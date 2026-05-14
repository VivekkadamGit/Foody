import Link from 'next/link'
import Navbar from '@/components/ui/Navbar'
import { createClient } from '@/lib/supabase/server'

export default async function HomePage() {
  const supabase = await createClient()

  const { data: restaurants } = await supabase
    .from('restaurants')
    .select(`
      id, name, address, cover_image_url, cuisine_type, price_range,
      cities!inner(name, slug),
      dishes(name, is_must_try, reviews(rating))
    `)
    .is('deleted_at', null)
    .limit(12)

  const enriched = (restaurants ?? [])
    .map((r: any) => {
      const allRatings = r.dishes?.flatMap((d: any) => d.reviews?.map((rv: any) => rv.rating) ?? []) ?? []
      const avg = allRatings.length ? allRatings.reduce((a: number, b: number) => a + b, 0) / allRatings.length : 0
      const topDish = r.dishes
        ?.filter((d: any) => d.reviews?.length > 0)
        .sort((a: any, b: any) => {
          const avgA = a.reviews.reduce((s: number, rv: any) => s + rv.rating, 0) / a.reviews.length
          const avgB = b.reviews.reduce((s: number, rv: any) => s + rv.rating, 0) / b.reviews.length
          return avgB - avgA
        })?.[0]?.name ?? null
      return { ...r, city: r.cities, avg_rating: avg, top_dish: topDish }
    })
    .sort((a: any, b: any) => b.avg_rating - a.avg_rating)
    .slice(0, 6)

  return (
    <>
      <Navbar />
      <main>
        {/* Hero */}
        <section className="bg-gradient-to-br from-orange-500 to-red-500 text-white py-20 px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-5xl font-bold mb-4 text-balance">Find the Best Food in Gujarat</h1>
            <p className="text-xl text-orange-100 mb-8">
              100% genuine reviews by our local food tester team. Every dish personally tasted and rated.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/surat" className="bg-white text-orange-600 font-bold py-3 px-8 rounded-full hover:bg-orange-50 transition-colors text-lg">
                🌆 Browse Surat
              </Link>
              <Link href="/vadodara" className="bg-white text-orange-600 font-bold py-3 px-8 rounded-full hover:bg-orange-50 transition-colors text-lg">
                🏛️ Browse Vadodara
              </Link>
              <Link href="/suggest" className="bg-orange-700 text-white font-bold py-3 px-8 rounded-full hover:bg-orange-800 transition-colors text-lg">
                🤖 AI Suggest
              </Link>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="py-14 px-4 bg-white">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl font-bold mb-10">How Foody Works</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
              {[
                { icon: '🧑‍🍳', title: 'Our Team Visits', desc: 'Food testers personally visit every restaurant and taste every dish.' },
                { icon: '⭐', title: 'We Rate & Review', desc: 'Honest ratings, taste notes, and real photos — zero sponsored content.' },
                { icon: '🤖', title: 'AI Finds Your Match', desc: "Tell us what you're craving and our AI picks the perfect dish for you." },
              ].map((item) => (
                <div key={item.title} className="flex flex-col items-center gap-3">
                  <span className="text-5xl">{item.icon}</span>
                  <h3 className="font-bold text-lg">{item.title}</h3>
                  <p className="text-gray-600 text-sm">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Top Picks */}
        {enriched.length > 0 && (
          <section className="py-14 px-4">
            <div className="max-w-6xl mx-auto">
              <h2 className="text-3xl font-bold mb-8 text-center">Top Rated Places</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {enriched.map((r: any) => (
                  <Link key={r.id} href={`/${r.city.slug}/${r.id}`}>
                    <div className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow border border-orange-100">
                      <div className="relative h-44 bg-orange-100 flex items-center justify-center text-5xl">
                        {r.cover_image_url
                          ? <img src={r.cover_image_url} alt={r.name} className="w-full h-full object-cover" />
                          : '🍛'}
                      </div>
                      <div className="p-4">
                        <h3 className="font-bold text-lg truncate">{r.name}</h3>
                        <p className="text-sm text-gray-500">{r.city.name}</p>
                        {r.avg_rating > 0 && (
                          <div className="flex items-center gap-1 mt-1">
                            <span className="text-amber-400 text-sm">{'★'.repeat(Math.round(r.avg_rating))}{'☆'.repeat(5 - Math.round(r.avg_rating))}</span>
                            <span className="text-sm text-gray-500">{r.avg_rating.toFixed(1)}</span>
                          </div>
                        )}
                        {r.top_dish && <p className="text-xs text-orange-600 mt-1 truncate">🌟 {r.top_dish}</p>}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* AI Suggest CTA */}
        <section className="py-14 px-4 bg-orange-600 text-white text-center">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-3xl font-bold mb-4">Not Sure What to Eat?</h2>
            <p className="text-orange-100 mb-8">
              Tell our AI what you&apos;re in the mood for — spicy, sweet, cheap, filling — and it&apos;ll find the perfect dish.
            </p>
            <Link href="/suggest" className="bg-white text-orange-600 font-bold py-3 px-8 rounded-full hover:bg-orange-50 transition-colors text-lg inline-block">
              🤖 Try AI Food Suggest
            </Link>
          </div>
        </section>
      </main>

      <footer className="bg-white border-t border-orange-100 py-8 text-center text-sm text-gray-500">
        <p>© 2025 Foody — Genuine food reviews for Surat & Vadodara</p>
      </footer>
    </>
  )
}
