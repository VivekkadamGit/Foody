'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function updateRestaurant(id: string, data: {
  name: string
  address: string
  cuisine_type: string[]
  price_range: number
  cover_image_url: string
}) {
  const supabase = await createClient()
  const { error } = await supabase.from('restaurants').update(data).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath(`/admin/restaurants/${id}`)
  revalidatePath('/admin')
}

export async function softDeleteRestaurant(id: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('restaurants')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath(`/admin/restaurants/${id}`)
  revalidatePath('/admin')
}

export async function restoreRestaurant(id: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('restaurants')
    .update({ deleted_at: null })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath(`/admin/restaurants/${id}`)
  revalidatePath('/admin')
}
