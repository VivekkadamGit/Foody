// Surat is the default "home" city — it leads the homepage before geolocation resolves
// and is the fallback when geolocation fails or is denied. Ahmedabad and Vadodara follow;
// any city not listed sorts after them.
//
// Lives here rather than in app/page.tsx so every surface that has to pick a "first" city
// picks the same one.
export const CITY_PRIORITY = ['surat', 'ahmedabad', 'vadodara']

export function cityPriorityIndex(slug: string): number {
  const i = CITY_PRIORITY.indexOf(slug)
  return i === -1 ? Number.MAX_SAFE_INTEGER : i
}
