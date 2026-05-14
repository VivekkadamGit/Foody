import Link from 'next/link'
import Image from 'next/image'
import { Restaurant, City, PRICE_LABELS } from '@/types/database'
import StarRating from '@/components/ui/StarRating'

type Props = {
  restaurant: Restaurant & { city: City; avg_rating: number; top_dish: string | null }
}

export default function RestaurantCard({ restaurant }: Props) {
  return (
    <Link href={`/${restaurant.city.slug}/${restaurant.id}`}>
      <div className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow border border-orange-100 group">
        <div className="relative h-44 bg-orange-100">
          {restaurant.cover_image_url ? (
            <Image
              src={restaurant.cover_image_url}
              alt={restaurant.name}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-5xl">🍛</div>
          )}
          <div className="absolute top-3 right-3 bg-white text-xs font-semibold px-2 py-1 rounded-full text-gray-600">
            {PRICE_LABELS[restaurant.price_range]}
          </div>
        </div>
        <div className="p-4">
          <h3 className="font-bold text-lg text-gray-900 truncate">{restaurant.name}</h3>
          <p className="text-sm text-gray-500 truncate">{restaurant.address}</p>
          <div className="flex items-center gap-2 mt-2">
            <StarRating rating={restaurant.avg_rating} />
            <span className="text-sm text-gray-500">{restaurant.avg_rating.toFixed(1)}</span>
          </div>
          {restaurant.top_dish && (
            <p className="text-xs text-orange-600 font-medium mt-2 truncate">
              🌟 Try: {restaurant.top_dish}
            </p>
          )}
          <div className="flex flex-wrap gap-1 mt-2">
            {restaurant.cuisine_type.slice(0, 3).map((c) => (
              <span key={c} className="text-xs bg-orange-50 text-orange-700 px-2 py-0.5 rounded-full capitalize">
                {c}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Link>
  )
}
