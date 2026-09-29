import { DIETS, MEALS, TASTES, labelFor, type Diet, type Meal, type ParsedQuery, type Taste } from '@/lib/taxonomy'
import type { ChipParams, DishHit, SearchResponse } from './types'

export type Chip = { dim: 'diet' | 'taste' | 'meal'; value: string; label: string }

export const CHIPS: Chip[] = [
  { dim: 'diet', value: 'veg', label: 'Veg' },
  { dim: 'diet', value: 'non_veg', label: 'Non-veg' },
  { dim: 'taste', value: 'sweet', label: 'Sweet' },
  { dim: 'taste', value: 'spicy', label: 'Spicy' },
  { dim: 'taste', value: 'tangy', label: 'Tangy' },
  { dim: 'meal', value: 'breakfast', label: 'Breakfast' },
  { dim: 'meal', value: 'lunch', label: 'Lunch' },
  { dim: 'meal', value: 'dinner', label: 'Dinner' },
]

function addIfValid<T extends string>(list: T[], vocab: readonly T[], value: string | undefined): T[] {
  if (!value || !(vocab as readonly string[]).includes(value) || list.includes(value as T)) return list
  return [...list, value as T]
}

/** Chips are URL params layered on top of what was typed. Unknown values are dropped. */
export function applyChips(p: ParsedQuery, c: ChipParams): ParsedQuery {
  return {
    ...p,
    diets: addIfValid<Diet>(p.diets, DIETS, c.diet),
    tastes: addIfValid<Taste>(p.tastes, TASTES, c.taste),
    meals: addIfValid<Meal>(p.meals, MEALS, c.meal),
  }
}

function typedValues(p: ParsedQuery, dim: Chip['dim']): string[] {
  return dim === 'diet' ? p.diets : dim === 'taste' ? p.tastes : p.meals
}

/** 'typed' chips came from the search words and can't be toggled off by the chip. */
export function chipState(typed: ParsedQuery, c: ChipParams, chip: Chip): 'off' | 'param' | 'typed' {
  if (typedValues(typed, chip.dim).includes(chip.value)) return 'typed'
  return c[chip.dim] === chip.value ? 'param' : 'off'
}

/** One value per dimension: tapping a chip sets it, tapping it again clears it. */
export function chipHref(q: string, city: string, c: ChipParams, chip: Chip): string {
  const next: ChipParams = { ...c, [chip.dim]: c[chip.dim] === chip.value ? undefined : chip.value }
  const params = new URLSearchParams()
  if (q) params.set('q', q)
  params.set('city', city)
  for (const dim of ['diet', 'taste', 'meal'] as const) {
    const v = next[dim]
    if (v) params.set(dim, v)
  }
  return `/search?${params.toString()}`
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function headingFor(res: SearchResponse, q: string, cityName: string): string {
  const typed = q.trim()
  switch (res.kind) {
    case 'broad':
      return `${cityName}'s Best`
    case 'text':
      return `Results for "${typed}"`
    case 'meal': {
      const f = res.filters
      return `${[...f.diets, ...f.tastes, f.meals[0]].map(labelFor).join(' ')} in ${cityName}`
    }
    case 'specific':
      return typed ? `${capitalize(typed)} in ${cityName}` : `Top picks in ${cityName}`
  }
}

/** The hero dropdown shows a flat preview of whichever layout came back. */
export function previewDishes(res: SearchResponse, limit = 5): DishHit[] {
  if (res.empty) return []
  const all =
    res.ranked ??
    res.groups?.flatMap((g) => g.dishes) ??
    res.board?.map((b) => b.dish) ??
    []
  return all.slice(0, limit)
}

function countDishes(res: SearchResponse): number {
  if (res.empty) return 0
  return res.ranked?.length ?? res.groups?.reduce((n, g) => n + g.dishes.length, 0) ?? res.board?.length ?? 0
}

export function summaryLine(res: SearchResponse): string {
  const n = countDishes(res)
  const parts = [`${n} ${n === 1 ? 'dish' : 'dishes'}`]
  if (res.onOurList.length > 0) parts.push(`${res.onOurList.length} on our list`)
  return parts.join(' · ')
}
