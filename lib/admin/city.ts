import { CITY_PRIORITY } from '@/lib/cities'

/** The requested city if it exists, else the home-priority city, else the first. */
export function pickCity(slugs: string[], requested: string | undefined): string | null {
  if (requested && slugs.includes(requested)) return requested
  return CITY_PRIORITY.find((s) => slugs.includes(s)) ?? slugs[0] ?? null
}

export const CITY_STATUSES = ['active', 'coming_soon'] as const
export type CityStatus = (typeof CITY_STATUSES)[number]

/** "Navi Mumbai (West)" → "navi-mumbai-west". */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function validateCity(input: { name: unknown; slug: unknown; status: unknown }): {
  name: string
  slug: string
  status: CityStatus
} {
  const name = typeof input.name === 'string' ? input.name.trim() : ''
  if (!name) throw new Error('City name is required')
  const slug = typeof input.slug === 'string' ? input.slug.trim() : ''
  if (!SLUG.test(slug)) throw new Error('Slug can only use lowercase letters, numbers and single dashes')
  if (!(CITY_STATUSES as readonly unknown[]).includes(input.status)) throw new Error(`Unknown status: ${String(input.status)}`)
  return { name, slug, status: input.status as CityStatus }
}
