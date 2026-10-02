'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { EMPTY_TAGS, validateTags, type DishTags } from '@/lib/admin/dishTags'

export type DishInput = {
  restaurant_id: string
  name: string
  description: string | null
  is_must_try: boolean
  /** 0–10, one decimal. null means "not scored yet" — the dish stays out of rankings. */
  score: number | null
  photo_url: string | null
} & DishTags

export type DishPatch = Partial<Omit<DishInput, 'restaurant_id'>>

function checkScore(score: number | null | undefined) {
  if (score === null || score === undefined) return
  if (Number.isNaN(score) || score < 0 || score > 10) throw new Error('Score must be between 0 and 10')
}

function checkName(name: string | undefined) {
  if (name !== undefined && name.trim() === '') throw new Error('Dish name is required')
}

async function revalidateDish(restaurantId: string | null) {
  revalidatePath('/admin')
  revalidatePath('/admin/dishes')
  if (restaurantId) revalidatePath(`/admin/restaurants/${restaurantId}`)
  revalidatePath('/')
}

export async function createDish(input: DishInput): Promise<{ id: string }> {
  checkName(input.name)
  checkScore(input.score)
  if (!input.restaurant_id) throw new Error('Pick a restaurant')
  const tags = { ...EMPTY_TAGS, ...validateTags(input) }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('dishes')
    .insert({
      restaurant_id: input.restaurant_id,
      name: input.name.trim(),
      description: input.description || null,
      is_must_try: input.is_must_try,
      score: input.score,
      photo_url: input.photo_url,
      ...tags,
    })
    .select('id')
    .single()
  if (error) throw new Error(error.message)

  await revalidateDish(input.restaurant_id)
  return { id: data.id }
}

export async function updateDish(id: string, patch: DishPatch): Promise<void> {
  checkName(patch.name)
  checkScore(patch.score)
  const { diet, category, cuisine, tastes, meals, ...rest } = patch
  const tagInput = Object.fromEntries(
    Object.entries({ diet, category, cuisine, tastes, meals }).filter(([, v]) => v !== undefined)
  )
  const update = {
    ...rest,
    ...(rest.name !== undefined ? { name: rest.name.trim() } : {}),
    ...validateTags(tagInput),
  }

  const supabase = await createClient()
  const { data, error } = await supabase.from('dishes').update(update).eq('id', id).select('restaurant_id').single()
  if (error) throw new Error(error.message)

  await revalidateDish(data.restaurant_id)
}

export async function softDeleteDish(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('dishes')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .select('restaurant_id')
    .single()
  if (error) throw new Error(error.message)
  await revalidateDish(data.restaurant_id)
}

export async function restoreDish(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('dishes')
    .update({ deleted_at: null })
    .eq('id', id)
    .select('restaurant_id')
    .single()
  if (error) throw new Error(error.message)
  await revalidateDish(data.restaurant_id)
}
