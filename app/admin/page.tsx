import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { isUntagged } from '@/lib/taxonomy'
import { EmptyState } from '@/components/admin/ui'
import PasswordToast from './PasswordToast'

export default async function AdminDashboard({ searchParams }: { searchParams: { password?: string } }) {
  const supabase = await createClient()

  const [restaurantsRes, dishesRes, trendingRes, reviewsRes] = await Promise.all([
    supabase.from('restaurants').select('id, name, created_at, cities!inner(name)').is('deleted_at', null).order('created_at', { ascending: false }),
    supabase.from('dishes').select('id, score, diet, category').is('deleted_at', null),
    supabase.from('trending_dishes').select('id, diet, category').is('deleted_at', null).is('visited_dish_id', null),
    supabase
      .from('reviews')
      .select('id, rating, taste_notes, visit_date, testers(name), dishes(name, restaurants!inner(name))')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  const failed = [restaurantsRes, dishesRes, trendingRes, reviewsRes].find((r) => r.error)
  if (failed?.error) {
    console.error('[admin] dashboard query failed:', failed.error.message)
    return <EmptyState icon="⚠️" text="Couldn't load the dashboard — refresh to retry." />
  }

  const dishes = dishesRes.data ?? []
  const scored = dishes.filter((d: any) => d.score !== null).length
  const needsScore = dishes.length - scored
  const needsTags = dishes.filter((d: any) => isUntagged(d)).length
  const trending = trendingRes.data ?? []
  const trendingNeedsTags = trending.filter((t: any) => isUntagged(t)).length
  const restaurants = restaurantsRes.data ?? []

  const stats = [
    { label: 'Restaurants', value: String(restaurants.length), href: '/admin/restaurants' },
    { label: 'Dishes', value: String(dishes.length), href: '/admin/dishes' },
    { label: 'Scored', value: `${scored} / ${dishes.length}`, href: '/admin/dishes?tab=needs_score' },
    { label: 'On our list', value: String(trending.length), href: '/admin/trending' },
  ]

  const todo = [
    { n: needsScore, text: `${needsScore} ${needsScore === 1 ? 'dish needs' : 'dishes need'} a score`, href: '/admin/dishes?tab=needs_score' },
    { n: needsTags, text: `${needsTags} ${needsTags === 1 ? 'dish needs' : 'dishes need'} tags`, href: '/admin/dishes?tab=needs_tags' },
    { n: trendingNeedsTags, text: `${trendingNeedsTags} ${trendingNeedsTags === 1 ? 'place' : 'places'} on our list ${trendingNeedsTags === 1 ? 'needs' : 'need'} tags`, href: '/admin/trending' },
  ].filter((t) => t.n > 0)

  return (
    <div className="space-y-8">
      {searchParams.password === 'updated' && <PasswordToast />}
      <header>
        <h1 className="font-anek text-3xl font-bold text-charcoal">Dashboard</h1>
        <p className="font-anek text-[15px] text-muted">What&apos;s in Chakh, and what still needs you.</p>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="rounded-2xl border border-warm-200 bg-white p-5 transition-colors hover:border-ember/50">
            <p className="font-anek text-[11px] font-bold uppercase tracking-[0.14em] text-muted">{s.label}</p>
            <p className="mt-1 font-barlow text-4xl font-bold text-charcoal">{s.value}</p>
          </Link>
        ))}
      </section>

      <section className="rounded-2xl border border-warm-200 bg-white p-6">
        <h2 className="font-anek text-lg font-bold text-charcoal">Needs attention</h2>
        {todo.length === 0 ? (
          <p className="mt-2 font-anek text-[15px] text-[#1f7a52]">✓ All caught up.</p>
        ) : (
          <ul className="mt-3 divide-y divide-warm-100">
            {todo.map((t) => (
              <li key={t.href + t.text}>
                <Link href={t.href} className="flex items-center justify-between py-3 font-anek text-[15px] text-charcoal hover:text-ember">
                  <span><span className="mr-2 inline-block h-2 w-2 rounded-full bg-ember align-middle" />{t.text}</span>
                  <span aria-hidden>→</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-warm-200 bg-white p-6">
          <h2 className="mb-3 font-anek text-lg font-bold text-charcoal">Recent visits</h2>
          {(reviewsRes.data ?? []).length === 0 ? (
            <p className="font-anek text-[14px] text-muted">No visits logged yet.</p>
          ) : (
            <ul className="divide-y divide-warm-100">
              {(reviewsRes.data ?? []).map((r: any) => (
                <li key={r.id} className="py-3">
                  <p className="font-anek text-[15px] font-semibold text-charcoal">{r.dishes?.name}</p>
                  <p className="font-anek text-[13px] text-muted">
                    {r.dishes?.restaurants?.name} · {r.testers?.name ?? 'Tester'} · {r.visit_date}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="rounded-2xl border border-warm-200 bg-white p-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-anek text-lg font-bold text-charcoal">Recent restaurants</h2>
            <Link href="/admin/restaurants/new" className="font-anek text-[14px] font-semibold text-ember hover:underline">+ Add</Link>
          </div>
          <ul className="divide-y divide-warm-100">
            {restaurants.slice(0, 6).map((r: any) => (
              <li key={r.id}>
                <Link href={`/admin/restaurants/${r.id}`} className="flex items-center justify-between py-3 font-anek text-[15px] text-charcoal hover:text-ember">
                  <span>{r.name}</span>
                  <span className="text-[13px] text-muted">{r.cities?.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
