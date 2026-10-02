import TrendingCard from '@/components/whatsnew/TrendingCard'
import type { TrendingHit } from '@/lib/search/types'

export default function OnOurList({ items, citySlug }: { items: TrendingHit[]; citySlug: string }) {
  if (items.length === 0) return null
  return (
    <section className="mt-10">
      <h2 className="font-anek text-xl font-bold text-charcoal m-0">On our list · visiting soon</h2>
      <p className="font-anek text-[13px] text-muted mt-1 mb-4">
        Places the city is talking about. We haven&apos;t tasted them yet, so they carry no score.
      </p>
      <div className="grid grid-cols-1 gap-3">
        {items.map((t) => (
          <TrendingCard
            key={t.id}
            entry={{
              id: t.id,
              dish_name: t.dishName,
              place_name: t.placeName,
              area: t.area,
              why: t.why,
              source_url: t.sourceUrl,
              photo_url: t.photoUrl,
              restaurant_id: t.restaurantId,
              citySlug,
              buzz: t.buzz,
            }}
          />
        ))}
      </div>
    </section>
  )
}
