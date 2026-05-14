import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function AdminDashboard() {
  const supabase = await createClient()

  const [{ count: restaurantCount }, { count: dishCount }, { count: reviewCount }] = await Promise.all([
    supabase.from('restaurants').select('*', { count: 'exact', head: true }),
    supabase.from('dishes').select('*', { count: 'exact', head: true }),
    supabase.from('reviews').select('*', { count: 'exact', head: true }),
  ])

  const { data: recentReviews } = await supabase
    .from('reviews')
    .select(`
      id, rating, taste_notes, visit_date, created_at,
      testers(name),
      dishes(name, restaurants!inner(name, cities!inner(name)))
    `)
    .order('created_at', { ascending: false })
    .limit(5)

  const { data: restaurants } = await supabase
    .from('restaurants')
    .select('id, name, cities!inner(name, slug)')
    .order('created_at', { ascending: false })
    .limit(10)

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Link href="/admin/restaurants/new" className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-5 py-2 rounded-xl transition-colors text-sm">
          + Add Restaurant
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Restaurants', value: restaurantCount ?? 0, icon: '🏪' },
          { label: 'Dishes', value: dishCount ?? 0, icon: '🍽️' },
          { label: 'Reviews', value: reviewCount ?? 0, icon: '⭐' },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-2xl border border-gray-200 p-5 text-center shadow-sm">
            <div className="text-3xl mb-1">{s.icon}</div>
            <div className="text-3xl font-bold text-gray-900">{s.value}</div>
            <div className="text-sm text-gray-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent reviews */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <h2 className="font-bold text-lg mb-4">Recent Reviews</h2>
          {recentReviews?.length === 0 ? (
            <p className="text-gray-400 text-sm">No reviews yet.</p>
          ) : (
            <div className="space-y-3">
              {recentReviews?.map((r: any) => (
                <div key={r.id} className="border-b border-gray-100 pb-3 last:border-0">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm">{r.dishes?.name} — {r.dishes?.restaurants?.name}</p>
                    <span className="text-amber-500 text-sm">{'★'.repeat(r.rating)}</span>
                  </div>
                  {r.taste_notes && <p className="text-xs text-gray-500 mt-0.5 truncate">{r.taste_notes}</p>}
                  <p className="text-xs text-gray-400 mt-0.5">by {r.testers?.name} on {r.visit_date}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Restaurants list */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <h2 className="font-bold text-lg mb-4">Restaurants</h2>
          {restaurants?.length === 0 ? (
            <p className="text-gray-400 text-sm">No restaurants yet. <Link href="/admin/restaurants/new" className="text-orange-500">Add one →</Link></p>
          ) : (
            <div className="space-y-2">
              {restaurants?.map((r: any) => (
                <Link key={r.id} href={`/admin/restaurants/${r.id}`} className="flex items-center justify-between p-3 rounded-xl hover:bg-orange-50 transition-colors group">
                  <div>
                    <p className="font-medium text-sm">{r.name}</p>
                    <p className="text-xs text-gray-500">{r.cities?.name}</p>
                  </div>
                  <span className="text-orange-400 text-sm opacity-0 group-hover:opacity-100">Manage →</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
