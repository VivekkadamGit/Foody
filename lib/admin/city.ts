import { CITY_PRIORITY } from '@/lib/cities'

/** The requested city if it exists, else the home-priority city, else the first. */
export function pickCity(slugs: string[], requested: string | undefined): string | null {
  if (requested && slugs.includes(requested)) return requested
  return CITY_PRIORITY.find((s) => slugs.includes(s)) ?? slugs[0] ?? null
}
