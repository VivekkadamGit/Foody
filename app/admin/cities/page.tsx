import { createClient } from '@/lib/supabase/server'
import CityList, { type AdminCity } from '@/components/admin/CityList'
import { EmptyState } from '@/components/admin/ui'

export const metadata = { title: 'Cities — Chakh admin' }

export default async function AdminCitiesPage() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('cities')
    .select('id, name, slug, status, restaurants(id, deleted_at, dishes(id, deleted_at))')
    .order('name')
  if (error) {
    console.error('[admin] cities query failed:', error.message)
    return <EmptyState icon="⚠️" text="Couldn't load cities — refresh to retry." />
  }

  const cities: AdminCity[] = (data ?? []).map((c: any) => {
    const all = c.restaurants ?? []
    const live = all.filter((r: any) => !r.deleted_at)
    return {
      id: c.id,
      name: c.name,
      slug: c.slug,
      status: c.status === 'coming_soon' ? 'coming_soon' : 'active',
      restaurants: all.length,
      liveRestaurants: live.length,
      dishes: live.reduce((n: number, r: any) => n + (r.dishes ?? []).filter((d: any) => !d.deleted_at).length, 0),
    }
  })

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-anek text-3xl font-bold text-charcoal">Cities</h1>
        <p className="font-anek text-[15px] text-muted">Add a city, or switch it between Live and Coming soon.</p>
      </header>
      <CityList cities={cities} />
    </div>
  )
}
