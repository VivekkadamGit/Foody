import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { pickCity } from '@/lib/admin/city'
import { priceTierSymbol } from '@/lib/dishScore'
import type { CityOption } from '@/lib/admin/types'
import CityTabs from '@/components/admin/CityTabs'
import { EmptyState } from '@/components/admin/ui'

export const metadata = { title: 'Restaurants — Chakh admin' }

export default async function AdminRestaurantsPage({ searchParams }: { searchParams: { city?: string; deleted?: string } }) {
  const supabase = await createClient()
  const { data: cities, error: cErr } = await supabase.from('cities').select('id, name, slug').order('name')
  if (cErr) {
    console.error('[admin] cities query failed:', cErr.message)
    return <EmptyState icon="⚠️" text="Couldn't load cities — refresh to retry." />
  }
  const city = pickCity((cities ?? []).map((c) => c.slug), searchParams.city)
  if (!city) return <EmptyState text="Add a city first." />
  const showDeleted = searchParams.deleted === '1'

  const { data, error } = await supabase
    .from('restaurants')
    .select('id, name, address, price_range, deleted_at, cities!inner(slug), dishes(id, deleted_at)')
    .eq('cities.slug', city)
    .order('name')
  if (error) {
    console.error('[admin] restaurants query failed:', error.message)
    return <EmptyState icon="⚠️" text="Couldn't load restaurants — refresh to retry." />
  }
  const rows = (data ?? []).filter((r: any) => showDeleted || !r.deleted_at)

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-anek text-3xl font-bold text-charcoal">Restaurants</h1>
          <p className="font-anek text-[15px] text-muted">Places we&apos;ve been. Open one to edit it and its dishes.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <CityTabs cities={cities as CityOption[]} current={city} basePath="/admin/restaurants" params={{ deleted: searchParams.deleted }} />
          <Link href="/admin/restaurants/new" className="rounded-lg bg-ember px-4 py-2.5 font-anek text-[14px] font-semibold text-white">+ Add restaurant</Link>
        </div>
      </header>
      <Link
        href={`/admin/restaurants?city=${city}${showDeleted ? '' : '&deleted=1'}`}
        className="inline-block font-anek text-[13.5px] text-muted hover:text-charcoal"
      >
        {showDeleted ? 'Hide deleted' : 'Show deleted'}
      </Link>
      {rows.length === 0 ? (
        <EmptyState icon="🏪" text="No restaurants in this city yet." />
      ) : (
        <ul className="overflow-hidden rounded-2xl border border-warm-200 bg-white">
          {rows.map((r: any) => {
            const live = (r.dishes ?? []).filter((d: any) => !d.deleted_at).length
            return (
              <li key={r.id} className="border-t border-warm-100 first:border-t-0">
                <Link href={`/admin/restaurants/${r.id}`} className="flex min-w-0 items-center gap-4 px-4 py-3.5 hover:bg-[#fdf6f2]">
                  <div className="min-w-0 flex-1">
                    <p className={`truncate font-anek text-[15.5px] font-semibold ${r.deleted_at ? 'text-muted line-through' : 'text-charcoal'}`}>{r.name}</p>
                    <p className="truncate font-anek text-[13px] text-muted">{r.address?.split(',')[0]}</p>
                  </div>
                  <span className="font-anek text-[13px] text-muted">{live} {live === 1 ? 'dish' : 'dishes'}</span>
                  <span className="w-10 text-right font-anek text-[14px] text-charcoal">{priceTierSymbol(r.price_range)}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
