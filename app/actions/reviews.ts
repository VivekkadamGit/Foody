'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function updateReview(id: string, restaurantId: string, data: {
  rating: number
  taste_notes: string
  visit_date: string
}) {
  const supabase = await createClient()
  const { error } = await supabase.from('reviews').update(data).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath(`/admin/restaurants/${restaurantId}`)
}

export async function softDeleteReview(id: string, restaurantId: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('reviews')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath(`/admin/restaurants/${restaurantId}`)
}

export async function restoreReview(id: string, restaurantId: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('reviews')
    .update({ deleted_at: null })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath(`/admin/restaurants/${restaurantId}`)
}
