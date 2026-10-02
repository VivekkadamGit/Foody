import Link from 'next/link'
import type { CityOption } from '@/lib/admin/types'

/** Server-renderable city switcher. Keeps every other query param, replaces `city`. */
export default function CityTabs({
  cities,
  current,
  basePath,
  params = {},
}: {
  cities: CityOption[]
  current: string
  basePath: string
  params?: Record<string, string | undefined>
}) {
  if (cities.length < 2) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      {cities.map((c) => {
        const qs = new URLSearchParams()
        for (const [k, v] of Object.entries(params)) if (v && k !== 'city') qs.set(k, v)
        qs.set('city', c.slug)
        const on = c.slug === current
        return (
          <Link
            key={c.slug}
            href={`${basePath}?${qs.toString()}`}
            aria-current={on ? 'page' : undefined}
            className={`rounded-full border px-3.5 py-1.5 font-anek text-[13px] font-medium ${
              on ? 'border-charcoal bg-charcoal text-white' : 'border-warm-200 bg-white text-charcoal hover:border-charcoal/40'
            }`}
          >
            {c.name}
          </Link>
        )
      })}
    </div>
  )
}
