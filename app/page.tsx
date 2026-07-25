import Link from 'next/link'
import Navbar from '@/components/ui/Navbar'
import HeroSection from '@/components/ui/HeroSection'
import RestaurantCard from '@/components/browse/RestaurantCard'
import Footer from '@/components/ui/Footer'
import { createClient } from '@/lib/supabase/server'

const GRADIENTS = [
  'linear-gradient(135deg,#D4956A,#C0432A)',
  'linear-gradient(135deg,#E8C49A,#A0522D)',
  'linear-gradient(135deg,#F5C842,#C0432A)',
  'linear-gradient(135deg,#C8E89A,#2D6A2D)',
  'linear-gradient(135deg,#F9C784,#E07B39)',
  'linear-gradient(135deg,#D4A0C8,#8B3070)',
]
const DISH_EMOJIS = ['🍛', '🥘', '🧁', '🫕', '🍜', '🥗']
const CITY_EMOJIS: Record<string, string> = {
  ahmedabad: '🏙️',
  surat:     '🌊',
  vadodara:  '🏛️',
  indore:    '🌆',
  mumbai:    '🏙️',
  pune:      '🏯',
  rajkot:    '🌅',
}

export default async function HomePage() {
  const supabase = await createClient()

  const [
    { data: cities },
    { data: restaurants },
    { data: allDishes },
  ] = await Promise.all([
    supabase.from('cities').select('name, slug').order('name'),
    supabase
      .from('restaurants')
      .select(`id, name, address, cover_image_url, cuisine_type, price_range, cities!inner(name, slug), dishes(name, is_must_try, reviews(rating))`)
      .is('deleted_at', null)
      .limit(12),
    supabase
      .from('dishes')
      .select('name, restaurants!inner(cities!inner(name, slug))')
      .is('deleted_at', null),
  ])

  // Build city → dish names map for hero
  const cityDishMap: Record<string, { city: { name: string; slug: string }; dishes: string[] }> = {}
  for (const d of allDishes ?? []) {
    const city = (d.restaurants as any)?.cities
    if (!city?.slug) continue
    if (!cityDishMap[city.slug]) cityDishMap[city.slug] = { city, dishes: [] }
    cityDishMap[city.slug].dishes.push(d.name)
  }
  const FALLBACK_CITIES = [
    {
      city: { name: 'Ahmedabad', slug: 'ahmedabad' },
      dishes: [
        'Dhokla', 'Fafda Jalebi', 'Khandvi', 'Undhiyu', 'Thepla', 'Mohanthal',
        'Sev Tameta', 'Shrikhand', 'Basundi', 'Dal Baati', 'Khichu', 'Methi Thepla',
        'Kadhi', 'Patra', 'Handvo', 'Ghughra', 'Aamras Puri', 'Sev Khamani',
        'Vaghareli Khichdi', 'Kopra Pak', 'Magas', 'Sukhdi',
      ],
    },
    {
      city: { name: 'Surat', slug: 'surat' },
      dishes: [
        'Locho', 'Ghari', 'Surti Undhiyu', 'Ponk Vada', 'Rasawala Khaman',
        'Dabeli', 'Jalebi', 'Sutarfeni', 'Sev Khamani', 'Aamras Puri',
        'Ghooghra', 'Chola Puri', 'Surti Bhajiya', 'Khaman', 'Fafda',
        'Surat Nasta', 'Batataa Puri', 'Gol Gappa', 'Methi Sev', 'Ponk',
      ],
    },
    {
      city: { name: 'Vadodara', slug: 'vadodara' },
      dishes: [
        'Sev Usal', 'Gathiya', 'Chakri', 'Basundi', 'Shrikhand', 'Patra',
        'Handvo', 'Muthia', 'Kadhi Khichdi', 'Fafda', 'Mohanthal',
        'Kopra Pak', 'Vaghareli Khichdi', 'Magas', 'Bhakar Vadi',
        'Thandai', 'Kesar Penda', 'Sukhdi', 'Gulab Jamun', 'Jalebi',
      ],
    },
    {
      city: { name: 'Indore', slug: 'indore' },
      dishes: [
        'Poha Jalebi', 'Bhutte Ka Kees', 'Sabudana Khichdi', 'Dal Bafla',
        'Garadu', 'Ratlami Sev', 'Namkeen', 'Shikanji', 'Imarti', 'Mawa Bati',
        'Kachori', 'Samosa', 'Dahi Vada', 'Palak Puri', 'Kadhi Bada',
        'Lavang Lata', 'Malpua', 'Shahi Shikanji', 'Rabdi Jalebi', 'Biryani',
      ],
    },
    {
      city: { name: 'Mumbai', slug: 'mumbai' },
      dishes: [
        'Vada Pav', 'Pav Bhaji', 'Bhel Puri', 'Sev Puri', 'Pani Puri',
        'Misal Pav', 'Keema Pav', 'Bun Maska', 'Cutting Chai', 'Frankies',
        'Bombay Sandwich', 'Dahi Puri', 'Ragda Pattice', 'Batata Vada',
        'Thalipeeth', 'Modak', 'Puran Poli', 'Solkadhi', 'Kokam Sherbet',
      ],
    },
    {
      city: { name: 'Pune', slug: 'pune' },
      dishes: [
        'Misal Pav', 'Bhakri', 'Puran Poli', 'Sabudana Khichdi', 'Thalipeeth',
        'Usal Pav', 'Poha', 'Shev Bhaji', 'Kothimbir Vadi', 'Pithla Bhakri',
        'Sol Kadhi', 'Modak', 'Karanji', 'Chiroti', 'Amti',
      ],
    },
    {
      city: { name: 'Rajkot', slug: 'rajkot' },
      dishes: [
        'Patudi', 'Gathiya', 'Dhokla', 'Kachori', 'Sev Tameta', 'Fafda',
        'Jalebi', 'Basundi', 'Shrikhand', 'Thepla', 'Mohanthal',
        'Ghughra', 'Adadiya', 'Methi Muthia', 'Dabeli',
      ],
    },
  ]
  // Merge DB dishes with predefined popular dishes — ensures hero always has rich content
  const cityData = (cities ?? []).length > 0
    ? (cities ?? []).map((c: any) => {
        const fromDB = cityDishMap[c.slug]?.dishes ?? []
        const predefined = FALLBACK_CITIES.find(f => f.city.slug === c.slug)?.dishes ?? []
        const merged = Array.from(new Set([...fromDB, ...predefined]))
        return { city: c, dishes: merged.length > 0 ? merged : predefined }
      })
    : FALLBACK_CITIES

  // Top rated restaurants
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

  // Top must-try dishes from all restaurants
  const topDishes = (restaurants ?? [])
    .flatMap((r: any) =>
      (r.dishes ?? [])
        .filter((d: any) => d.reviews?.length > 0)
        .map((d: any) => {
          const avg = d.reviews.reduce((s: number, rv: any) => s + rv.rating, 0) / d.reviews.length
          return { name: d.name, isMustTry: d.is_must_try, avg, restaurant: r.name, city: (r.cities as any) }
        })
    )
    .sort((a: any, b: any) => (b.isMustTry ? 1 : 0) - (a.isMustTry ? 1 : 0) || b.avg - a.avg)
    .slice(0, 6)

  // Restaurant count per city
  const cityCounts: Record<string, number> = {}
  for (const r of restaurants ?? []) {
    const slug = (r.cities as any)?.slug
    if (slug) cityCounts[slug] = (cityCounts[slug] ?? 0) + 1
  }

  return (
    <>
      <Navbar cities={cities ?? []} />

      <main>
        {/* Hero with location + search */}
        <HeroSection cityData={cityData} />

        {/* Top Picks — dishes */}
        {topDishes.length > 0 && (
          <section className="py-10 px-6 bg-cream">
            <div className="max-w-6xl mx-auto">
              <div className="flex items-end justify-between mb-6">
                <div>
                  <p className="font-body text-xs font-bold uppercase tracking-[0.2em] text-spice mb-1">✦ Top Picks</p>
                  <h2 className="font-display text-2xl font-bold text-charcoal">Most loved dishes right now</h2>
                </div>
                <div className="flex gap-4">
                  {(cities ?? []).map((c: any) => (
                    <Link key={c.slug} href={`/${c.slug}`} className="font-body text-sm text-spice hover:underline underline-offset-4">
                      All in {c.name} →
                    </Link>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {topDishes.map((dish: any, i: number) => (
                  <div key={i} className="bg-white rounded-2xl border border-warm-100 overflow-hidden flex hover:shadow-md transition-shadow cursor-pointer">
                    <div
                      className="w-24 flex-shrink-0 flex items-center justify-center text-4xl"
                      style={{ background: GRADIENTS[i % GRADIENTS.length] }}
                    >
                      {DISH_EMOJIS[i % DISH_EMOJIS.length]}
                    </div>
                    <div className="p-4 flex-1 min-w-0">
                      <p className="font-display font-bold text-charcoal text-sm leading-tight mb-1 truncate">{dish.name}</p>
                      <p className="font-body text-xs text-muted mb-3 truncate">{dish.restaurant} · {dish.city?.name}</p>
                      <div className="flex gap-2 flex-wrap">
                        {dish.isMustTry && (
                          <span className="font-body text-xs font-semibold px-2 py-0.5 rounded-full bg-red-50 text-spice">Must Try</span>
                        )}
                      </div>
                    </div>
                    <div className="bg-charcoal text-center rounded-lg m-3 px-2.5 py-2 flex-shrink-0 self-center">
                      <p className="font-display font-bold text-sm leading-none" style={{ color: '#C8A97E' }}>{dish.avg.toFixed(1)}</p>
                      <p className="font-body text-xs mt-0.5" style={{ color: '#555' }}>★★★★★</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Top Rated Restaurants */}
        {enriched.length > 0 && (
          <section className="py-10 px-6 bg-warm-50 border-y border-warm-100">
            <div className="max-w-6xl mx-auto">
              <div className="flex items-end justify-between mb-6">
                <div>
                  <p className="font-body text-xs font-bold uppercase tracking-[0.2em] text-spice mb-1">✦ Restaurants</p>
                  <h2 className="font-display text-2xl font-bold text-charcoal">Top Rated Places</h2>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 [&>*]:max-w-sm">
                {enriched.map((r: any) => (
                  <RestaurantCard key={r.id} restaurant={r} />
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Browse by City */}
        {(cities ?? []).length > 0 && (
          <section className="py-10 px-6 bg-warm-50">
            <div className="max-w-6xl mx-auto">
              <p className="font-body text-xs font-bold uppercase tracking-[0.2em] text-spice mb-1">Explore</p>
              <h2 className="font-display text-2xl font-bold text-charcoal mb-6">Browse by City</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {(cities ?? []).map((city: any) => (
                  <Link key={city.slug} href={`/${city.slug}`}>
                    <div className="bg-charcoal rounded-2xl py-7 px-4 text-center hover:bg-charcoal/80 transition-colors cursor-pointer">
                      <div className="text-3xl mb-2">{CITY_EMOJIS[city.slug] ?? '🍽️'}</div>
                      <p className="font-display font-bold text-warm-100 text-sm mb-1">{city.name}</p>
                      {cityCounts[city.slug] && (
                        <p className="font-body text-xs" style={{ color: '#C8A97E' }}>{cityCounts[city.slug]} {cityCounts[city.slug] === 1 ? 'restaurant' : 'restaurants'}</p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>

      <Footer cities={cities ?? []} />
    </>
  )
}
