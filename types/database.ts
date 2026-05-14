export type City = {
  id: string
  name: string
  slug: string
}

export type Restaurant = {
  id: string
  city_id: string
  name: string
  address: string
  google_place_id: string | null
  latitude: number | null
  longitude: number | null
  cuisine_type: string[]
  price_range: 1 | 2 | 3
  cover_image_url: string | null
  created_at: string
}

export type Dish = {
  id: string
  restaurant_id: string
  name: string
  description: string | null
  photo_url: string | null
  is_must_try: boolean
  created_at: string
}

export type Review = {
  id: string
  dish_id: string
  tester_id: string
  rating: 1 | 2 | 3 | 4 | 5
  taste_notes: string | null
  visit_date: string
  created_at: string
}

export type Tester = {
  id: string
  name: string
  role: 'tester' | 'admin'
}

// Joined types for UI use
export type DishWithReviews = Dish & {
  avg_rating: number
  reviews: Review[]
}

export type RestaurantWithDishes = Restaurant & {
  city: City
  dishes: DishWithReviews[]
}

export type PriceLabel = { [key: number]: string }
export const PRICE_LABELS: PriceLabel = {
  1: '₹ Budget',
  2: '₹₹ Mid-range',
  3: '₹₹₹ Premium',
}
