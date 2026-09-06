import Footer from '@/components/ui/Footer'
import HomeClient, { CityBundle } from '@/components/home/HomeClient'
import { createClient } from '@/lib/supabase/server'
import { avgRating, scoreOutOf10, priceTierSymbol } from '@/lib/dishScore'
import type { RankedDish } from '@/components/home/MustTryRanking'
import type { WhatsNewItem } from '@/components/home/WhatsNewPanel'

const FALLBACK_WATERMARK_DISHES: Record<string, string[]> = {
  surat: [
    'Locho', 'Ghari', 'Surti Undhiyu', 'Ponk Vada', 'Rasawala Khaman', 'Dabeli', 'Jalebi',
    'Sutarfeni', 'Sev Khamani', 'Aamras Puri', 'Chola Puri', 'Surti Bhajiya', 'Khaman', 'Fafda', 'Gol Gappa',
  ],
  ahmedabad: [
    'Dhokla', 'Fafda Jalebi', 'Khandvi', 'Undhiyu', 'Thepla', 'Mohanthal', 'Sev Tameta',
    'Shrikhand', 'Basundi', 'Dal Baati', 'Khichu', 'Kadhi', 'Patra', 'Handvo', 'Ghughra',
  ],
  vadodara: [
    'Sev Usal', 'Gathiya', 'Chakri', 'Basundi', 'Shrikhand', 'Patra', 'Handvo', 'Muthia',
    'Kadhi Khichdi', 'Fafda', 'Mohanthal', 'Kopra Pak', 'Bhakar Vadi', 'Kesar Penda', 'Sukhdi',
  ],
  indore: [
    'Poha Jalebi', 'Bhutte Ka Kees', 'Sabudana Khichdi', 'Dal Bafla', 'Garadu', 'Ratlami Sev',
    'Namkeen', 'Shikanji', 'Imarti', 'Mawa Bati', 'Kachori', 'Samosa', 'Dahi Vada', 'Kadhi Bada', 'Malpua',
  ],
}

const NEW_WINDOW_DAYS = 21

// Surat is the current default/home city. Ahmedabad and Vadodara are also live.
// Order controls the default city before geolocation resolves (and the fallback if it fails/denies).
const CITY_PRIORITY = ['surat', 'ahmedabad', 'vadodara']

// Used only when the database is unreachable or has no data yet (e.g. fresh clone,
// offline dev), so the homepage never renders blank — mirrors the old FALLBACK_CITIES pattern.
const FALLBACK_BUNDLES: CityBundle[] = [
  {
    city: { name: 'Surat', slug: 'surat' },
    dishCount: 14,
    watermarkDishes: FALLBACK_WATERMARK_DISHES.surat,
    ranking: [
      { id: 'fallback-s1', name: 'Locho', restaurantName: 'Maskati Locho House', restaurantArea: 'Maskati Market', priceSymbol: '₹', score: 8.8, reviewCount: 4, isMustTry: true },
      { id: 'fallback-s2', name: 'Ghari', restaurantName: 'Rasoi', restaurantArea: 'Athwalines', priceSymbol: '₹₹', score: 8.6, reviewCount: 3, isMustTry: false },
      { id: 'fallback-s3', name: 'Ponk Vada', restaurantName: 'Gandhi Bhog', restaurantArea: 'Varachha', priceSymbol: '₹', score: 8.2, reviewCount: 1, isMustTry: false },
    ],
    justTasted: [
      { name: 'Ponk Vada', restaurantName: 'Gandhi Bhog, Varachha', score: 8.2, reviewCount: 1, date: new Date(Date.now() - 5 * 86400000).toISOString() },
    ],
    whatsNew: [
      { type: 'new_opening', name: 'Rasawala Khaman corner, Varachha', date: new Date(Date.now() - 4 * 86400000).toISOString() },
    ],
  },
  {
    city: { name: 'Ahmedabad', slug: 'ahmedabad' },
    dishCount: 64,
    watermarkDishes: FALLBACK_WATERMARK_DISHES.ahmedabad,
    ranking: [
      { id: 'fallback-1', name: 'Fafda jalebi', restaurantName: 'Chandravilas', restaurantArea: 'Gandhi Road', priceSymbol: '₹₹', score: 9.2, reviewCount: 6, isMustTry: true },
      { id: 'fallback-2', name: 'Dhokla', restaurantName: 'Das Khaman', restaurantArea: 'Naranpura', priceSymbol: '₹', score: 8.9, reviewCount: 4, isMustTry: true },
      { id: 'fallback-3', name: 'Dal vada', restaurantName: 'Ratanpole corner cart', restaurantArea: null, priceSymbol: '₹', score: 9.0, reviewCount: 3, isMustTry: false },
      { id: 'fallback-4', name: 'Undhiyu', restaurantName: 'Gordhan Thal', restaurantArea: 'Sindhu Bhavan Rd', priceSymbol: '₹₹₹', score: 8.7, reviewCount: 2, isMustTry: false },
      { id: 'fallback-5', name: 'Khandvi', restaurantName: 'Gopi Dining Hall', restaurantArea: 'Ellisbridge', priceSymbol: '₹₹', score: 8.5, reviewCount: 1, isMustTry: false },
      { id: 'fallback-6', name: 'Khaman dhokla', restaurantName: 'Jai Bhavani', restaurantArea: 'Paldi', priceSymbol: '₹', score: 8.4, reviewCount: 1, isMustTry: false },
    ],
    justTasted: [
      { name: 'Khaman dhokla', restaurantName: 'Jai Bhavani, Paldi', score: 8.4, reviewCount: 1, date: new Date(Date.now() - 3 * 86400000).toISOString() },
      { name: 'Bhungra bateta', restaurantName: 'Lucky Tea Stall, Lal Darwaja', score: 8.1, reviewCount: 2, date: new Date(Date.now() - 10 * 86400000).toISOString() },
      { name: 'Dal vada', restaurantName: 'Ratanpole corner cart', score: 9.0, reviewCount: 3, date: new Date(Date.now() - 17 * 86400000).toISOString() },
    ],
    whatsNew: [
      { type: 'new_opening', name: 'Kesar Kulfi House, Bopal', date: new Date(Date.now() - 3 * 86400000).toISOString() },
      { type: 'new_dish', name: 'Cheese khichu at Manek Chowk', score: 7.6, date: new Date(Date.now() - 7 * 86400000).toISOString() },
    ],
  },
  {
    city: { name: 'Vadodara', slug: 'vadodara' },
    dishCount: 0,
    watermarkDishes: FALLBACK_WATERMARK_DISHES.vadodara,
    ranking: [],
    justTasted: [],
    whatsNew: [],
  },
]

const FALLBACK_LOCKED_CITIES = [{ name: 'Indore', slug: 'indore' }]

export default async function HomePage() {
  const supabase = await createClient()

  const [{ data: cities }, { data: restaurants }] = await Promise.all([
    supabase.from('cities').select('name, slug, status').order('name'),
    supabase
      .from('restaurants')
      .select(
        `id, name, address, price_range, created_at, cities!inner(name, slug, status),
         dishes(id, name, is_must_try, created_at, reviews(rating, created_at))`
      )
      .is('deleted_at', null),
  ])

  if (!cities || cities.length === 0) {
    return (
      <>
        <HomeClient bundles={FALLBACK_BUNDLES} lockedCities={FALLBACK_LOCKED_CITIES} />
        <Footer
          cities={[
            ...FALLBACK_BUNDLES.map((b) => ({ ...b.city, status: 'active' })),
            ...FALLBACK_LOCKED_CITIES.map((c) => ({ ...c, status: 'coming_soon' })),
          ]}
        />
      </>
    )
  }

  // Treat missing/null status (e.g. before migration 002 has run) as active, so nothing breaks.
  const activeCities = cities.filter((c: any) => c.status !== 'coming_soon')
  const lockedCities = cities
    .filter((c: any) => c.status === 'coming_soon')
    .map((c: any) => ({ name: c.name, slug: c.slug }))

  const cutoff = Date.now() - NEW_WINDOW_DAYS * 86400000

  const bundles: CityBundle[] = activeCities.map((city: any) => {
    const cityRestaurants = (restaurants ?? []).filter((r: any) => (r.cities as any)?.slug === city.slug)

    const ranking: RankedDish[] = []
    const justTasted: { name: string; restaurantName: string; score: number; reviewCount: number; date: string }[] = []
    const whatsNew: WhatsNewItem[] = []

    for (const r of cityRestaurants) {
      const area = r.address ? String(r.address).split(',')[0].trim() : null
      const priceSymbol = priceTierSymbol(r.price_range)

      if (r.created_at && new Date(r.created_at).getTime() > cutoff && (r.dishes ?? []).length === 0) {
        whatsNew.push({ type: 'new_opening', name: r.name, date: r.created_at })
      }

      for (const d of r.dishes ?? []) {
        const reviews = d.reviews ?? []
        if (reviews.length === 0) continue
        const ratings = reviews.map((rv: any) => rv.rating)
        const score = scoreOutOf10(avgRating(ratings))

        ranking.push({
          id: d.id,
          name: d.name,
          restaurantName: r.name,
          restaurantArea: area,
          priceSymbol,
          score,
          reviewCount: reviews.length,
          isMustTry: !!d.is_must_try,
        })

        const latestReviewDate = reviews
          .map((rv: any) => rv.created_at)
          .filter(Boolean)
          .sort()
          .at(-1)
        if (latestReviewDate) {
          justTasted.push({ name: d.name, restaurantName: r.name, score, reviewCount: reviews.length, date: latestReviewDate })
        }

        if (reviews.length === 1 && d.created_at && new Date(d.created_at).getTime() > cutoff) {
          whatsNew.push({ type: 'new_dish', name: d.name, score, date: d.created_at })
        }
      }
    }

    ranking.sort((a, b) => (b.isMustTry ? 1 : 0) - (a.isMustTry ? 1 : 0) || b.score - a.score)
    justTasted.sort((a, b) => (a.date < b.date ? 1 : -1))
    whatsNew.sort((a, b) => (a.date < b.date ? 1 : -1))

    const dbWatermarks = ranking.map((d) => d.name)
    const watermarkDishes = dbWatermarks.length > 0 ? dbWatermarks : (FALLBACK_WATERMARK_DISHES[city.slug] ?? [])

    return {
      city: { name: city.name, slug: city.slug },
      dishCount: ranking.length,
      watermarkDishes,
      ranking,
      justTasted: justTasted.slice(0, 3),
      whatsNew: whatsNew.slice(0, 2),
    }
  })

  // Surat first — it's the default "home" view before geolocation resolves and the
  // fallback if it fails or is denied. Ahmedabad/Vadodara follow; anything else falls in after.
  bundles.sort((a, b) => {
    const ai = CITY_PRIORITY.indexOf(a.city.slug)
    const bi = CITY_PRIORITY.indexOf(b.city.slug)
    if (ai === -1 && bi === -1) return b.dishCount - a.dishCount
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })

  return (
    <>
      <HomeClient bundles={bundles} lockedCities={lockedCities} />
      <Footer cities={cities} />
    </>
  )
}
