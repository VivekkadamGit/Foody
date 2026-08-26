'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

type City = { name: string; slug: string }

export default function Navbar({ cities }: { cities?: City[] }) {
  const pathname = usePathname()

  return (
    <div className="fixed top-4 left-0 right-0 z-50 px-5 pointer-events-none">
      <nav
        className="pointer-events-auto max-w-6xl mx-auto flex items-center justify-between px-5 h-[58px] rounded-full border border-warm-200 bg-cream/90 backdrop-blur-md"
        style={{ boxShadow: '0 4px 28px rgba(26, 22, 20, 0.10), 0 1px 4px rgba(26, 22, 20, 0.06)' }}
      >
        <Link href="/" className="flex-shrink-0">
          <span className="font-display text-2xl font-bold tracking-tight text-spice">
            Chakh
          </span>
        </Link>

        <div className="flex items-center gap-7">
          {cities?.map((city) => (
            <Link
              key={city.slug}
              href={`/${city.slug}`}
              className="font-body text-sm text-muted hover:text-charcoal transition-colors duration-150"
            >
              {city.name}
            </Link>
          ))}

          {process.env.NEXT_PUBLIC_ENABLE_AI_SUGGEST === 'true' && (
            <Link
              href="/suggest"
              className={`font-body text-sm font-semibold px-5 py-2 rounded-full transition-all duration-150 ${
                pathname === '/suggest'
                  ? 'bg-spice text-cream'
                  : 'bg-charcoal text-cream hover:bg-spice'
              }`}
            >
              AI Suggest
            </Link>
          )}
        </div>
      </nav>
    </div>
  )
}
