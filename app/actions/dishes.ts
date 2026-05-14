'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function updateDish(id: string, restaurantId: string, data: {
  name: string
  description: string
  is_must_try: boolean
}) {
  const supabase = await createClient()
  const { error } = await supabase.from('dishes').update(data).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath(`/admin/restaurants/${restaurantId}`)
}

export async function softDeleteDish(id: string, restaurantId: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('dishes')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath(`/admin/restaurants/${restaurantId}`)
}

export async function restoreDish(id: string, restaurantId: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('dishes')
    .update({ deleted_at: null })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath(`/admin/restaurants/${restaurantId}`)
}
