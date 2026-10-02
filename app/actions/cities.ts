'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { validateCity } from '@/lib/admin/city'

function revalidateCities() {
  revalidatePath('/')
  revalidatePath('/admin/cities')
  revalidatePath('/whats-new')
}

function friendly(message: string): string {
  if (/duplicate key|cities_slug_key/i.test(message)) return 'Another city already uses that slug'
  return message
}

export async function createCity(input: { name: string; slug: string; status: string }) {
  const city = validateCity(input)
  const supabase = await createClient()
  const { error } = await supabase.from('cities').insert(city)
  if (error) throw new Error(friendly(error.message))
  revalidateCities()
}

export async function updateCity(id: string, input: { name: string; slug: string; status: string }) {
  const city = validateCity(input)
  const supabase = await createClient()
  const { error } = await supabase.from('cities').update(city).eq('id', id)
  if (error) throw new Error(friendly(error.message))
  revalidateCities()
}

/** restaurants.city_id is ON DELETE CASCADE — refuse unless there is nothing to cascade. */
export async function deleteCity(id: string) {
  const supabase = await createClient()
  const { count, error: countError } = await supabase
    .from('restaurants')
    .select('id', { count: 'exact', head: true })
    .eq('city_id', id)
  if (countError) throw new Error(countError.message)
  if ((count ?? 0) > 0) throw new Error('This city still has restaurants (including deleted ones). Move or delete them first.')

  const { error } = await supabase.from('cities').delete().eq('id', id)
  if (error) {
    if (/foreign key/i.test(error.message)) throw new Error('This city is still used by an On our list entry. Remove those first.')
    throw new Error(error.message)
  }
  revalidateCities()
}
