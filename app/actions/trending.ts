'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

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
}

function revalidate() {
  revalidatePath('/whats-new')
  revalidatePath('/admin/trending')
}

export async function createTrending(data: TrendingInput) {
  const supabase = await createClient()
  const { error } = await supabase.from('trending_dishes').insert(data)
  if (error) throw new Error(error.message)
  revalidate()
}

export async function updateTrending(id: string, data: Partial<TrendingInput>) {
  const supabase = await createClient()
  const { error } = await supabase.from('trending_dishes').update(data).eq('id', id)
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
