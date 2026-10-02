'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { EMPTY_TAGS, validateTags, type DishTags } from '@/lib/admin/dishTags'

export type TrendingInput = {
  dish_name: string
  place_name: string
  city_id: string
  restaurant_id: string | null
  area: string | null
  why: string
  source_url: string | null
  photo_url: string | null
  rank: number
  /** 1–3, shown as 🔥. Orders "On our list". */
  buzz: number
} & DishTags

function revalidate() {
  revalidatePath('/whats-new')
  revalidatePath('/admin/trending')
  revalidatePath('/admin')
  revalidatePath('/search')
}

function checkTrending(data: Partial<TrendingInput>) {
  if (data.dish_name !== undefined && !data.dish_name.trim()) throw new Error('Dish name is required')
  if (data.place_name !== undefined && !data.place_name.trim()) throw new Error('Place name is required')
  if (data.why !== undefined && !data.why.trim()) throw new Error("Say why it's buzzing")
  if (data.buzz !== undefined && ![1, 2, 3].includes(data.buzz)) throw new Error('Buzz must be 1, 2 or 3')
  if (data.source_url && !/^https?:\/\//.test(data.source_url)) throw new Error('Source link must start with http')
}

export async function createTrending(data: TrendingInput) {
  checkTrending(data)
  const supabase = await createClient()
  const { error } = await supabase.from('trending_dishes').insert({ ...data, ...EMPTY_TAGS, ...validateTags(data) })
  if (error) throw new Error(error.message)
  revalidate()
}

export async function updateTrending(id: string, data: Partial<TrendingInput>) {
  checkTrending(data)
  const supabase = await createClient()
  const { error } = await supabase.from('trending_dishes').update({ ...data, ...validateTags(data) }).eq('id', id)
  if (error) throw new Error(error.message)
  revalidate()
}

export async function softDeleteTrending(id: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('trending_dishes')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidate()
}

export async function restoreTrending(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('trending_dishes').update({ deleted_at: null }).eq('id', id)
  if (error) throw new Error(error.message)
  revalidate()
}

/**
 * Retires an entry from the Trending column by linking it to the dish we finally
 * reviewed. This is the whole lifecycle: the column cleans itself instead of
 * accumulating stale hype, and the dish can now say the city sent us there.
 */
export async function markTrendingVisited(id: string, dishId: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('trending_dishes')
    .update({ visited_dish_id: dishId })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidate()
}
