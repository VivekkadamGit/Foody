import Link from 'next/link'
import Image from 'next/image'
import { Restaurant, City, PRICE_LABELS } from '@/types/database'

type Props = {
  restaurant: Restaurant & { city: City; avg_rating: number; top_dish: string | null }
}

export default function RestaurantCard({ restaurant }: Props) {
  return (
    <Link href={`/${restaurant.city.slug}/${restaurant.id}`} className="group block">
      <div className="bg-white border border-warm-100 hover:border-warm-200 hover:shadow-lg transition-all duration-300">
        {/* Photo */}
        <div className="relative h-52 bg-warm-100 overflow-hidden">
          {restaurant.cover_image_url ? (
            <Image
              src={restaurant.cover_image_url}
              alt={restaurant.name}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <span className="font-display text-8xl font-bold text-warm-200 select-none">
                {restaurant.name[0]}
              </span>
            </div>
          )}
          <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm font-body text-xs font-semibold px-2 py-1 text-charcoal tracking-wide">
            {PRICE_LABELS[restaurant.price_range]}
          </div>
          {restaurant.avg_rating > 0 && (
            <div className="absolute bottom-0 left-0 bg-spice text-white font-body text-sm font-bold px-3 py-1.5">
              ★ {restaurant.avg_rating.toFixed(1)}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-5">
          <h3 className="font-display font-bold text-lg text-charcoal group-hover:text-spice transition-colors leading-tight">
            {restaurant.name}
          </h3>
          <p className="font-body text-xs text-muted mt-1 uppercase tracking-wide">{restaurant.city.name}</p>

          <div className="flex flex-wrap gap-1.5 mt-3">
            {restaurant.cuisine_type.slice(0, 3).map((c) => (
              <span key={c} className="font-body text-xs text-spice border border-spice/20 px-2 py-0.5 capitalize">
                {c}
              </span>
            ))}
          </div>

          {restaurant.top_dish && (
            <p className="font-body text-xs text-muted mt-3 pt-3 border-t border-warm-100 truncate">
              <span className="text-spice font-semibold">Try:</span> {restaurant.top_dish}
            </p>
          )}
        </div>
      </div>
    </Link>
  )
}
