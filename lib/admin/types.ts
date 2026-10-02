import type { DishTags } from './dishTags'

export type CityOption = { id: string; name: string; slug: string }

export type AdminDish = DishTags & {
  id: string
  name: string
  description: string | null
  photo_url: string | null
  is_must_try: boolean
  score: number | null
  deleted_at: string | null
  restaurant_id: string
  restaurant_name: string
}

export type AdminTrending = DishTags & {
  id: string
  dish_name: string
  place_name: string
  city_id: string
  restaurant_id: string | null
  area: string | null
  why: string
  source_url: string | null
  photo_url: string | null
  visited_dish_id: string | null
  rank: number
  buzz: number
  deleted_at: string | null
}
