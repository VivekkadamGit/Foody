import Link from 'next/link'

type City = { name: string; slug: string; status?: string }

export default function Footer({ cities }: { cities?: City[] }) {
  return (
    <footer className="bg-charcoal">

      {/* CTA Strip */}
      {process.env.NEXT_PUBLIC_ENABLE_AI_SUGGEST === 'true' && (
        <div className="bg-spice px-6 py-5 flex items-center justify-between gap-4 flex-wrap">
          <p className="font-display text-white text-lg font-bold">
            Not sure what to eat? Let AI decide. 🤖
          </p>
          <Link
            href="/suggest"
            className="font-body text-sm font-bold bg-cream text-spice px-6 py-2.5 rounded-full hover:bg-white transition-colors uppercase tracking-wider flex-shrink-0"
          >
            Try AI Suggest →
          </Link>
        </div>
      )}

      {/* Main section */}
      <div className="max-w-6xl mx-auto px-6 pt-5 pb-8 border-b border-white/10">

        {/* Logo */}
        <div className="mb-2 flex items-baseline">
          <span className="font-anek text-4xl font-extrabold tracking-tight text-ember-light">chakh</span>
          <span className="w-2 h-2 rounded-full bg-ember ml-1.5" />
        </div>

        {/* 3-column — all start at description text level */}
        <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr] gap-10">

        {/* Brand */}
        <div>
          <p className="font-body text-sm text-muted leading-relaxed max-w-xs">
            Every restaurant visited in person. Every dish personally tasted and rated — zero sponsored content, ever.
          </p>
          <div className="flex gap-3 mt-5">
            {[
              { label: 'Instagram', path: 'M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z' },
              { label: 'YouTube', path: 'M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z' },
              { label: 'Twitter/X', path: 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z' },
            ].map(({ label, path }) => (
              <a key={label} href="#" aria-label={label}
                className="w-9 h-9 rounded-lg border border-white/10 flex items-center justify-center text-muted hover:text-warm-200 hover:border-white/25 transition-colors">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d={path} /></svg>
              </a>
            ))}
          </div>
        </div>

        {/* Cities */}
        <div>
          <p className="font-body text-xs font-bold uppercase tracking-widest mb-4" style={{ color: '#C8A97E' }}>
            Cities
          </p>
          <div className="flex flex-col gap-3">
            {(cities ?? []).length > 0
              ? (cities ?? []).map((city) =>
                  city.status === 'coming_soon' ? (
                    <span key={city.slug} className="font-body text-sm text-muted/50 w-fit flex items-center gap-1.5">
                      {city.name} <span className="text-[10px] uppercase tracking-wide">· soon</span>
                    </span>
                  ) : (
                    <Link key={city.slug} href={`/${city.slug}`}
                      className="font-body text-sm text-muted hover:text-warm-200 transition-colors w-fit">
                      {city.name}
                    </Link>
                  )
                )
              : ['Surat', 'Ahmedabad', 'Vadodara'].map((name) => (
                  <span key={name} className="font-body text-sm text-muted">{name}</span>
                ))
            }
          </div>
        </div>

        {/* Explore */}
        <div>
          <p className="font-body text-xs font-bold uppercase tracking-widest mb-4" style={{ color: '#C8A97E' }}>
            Explore
          </p>
          <div className="flex flex-col gap-3">
            {[
              ...(process.env.NEXT_PUBLIC_ENABLE_AI_SUGGEST === 'true' ? [{ label: 'AI Food Suggest', href: '/suggest' }] : []),
              { label: 'Must Try Dishes', href: '/#must-try' },
              { label: 'About Us', href: '#' },
            ].map(({ label, href }) => (
              <Link key={label} href={href}
                className="font-body text-sm text-muted hover:text-warm-200 transition-colors w-fit">
                {label}
              </Link>
            ))}
          </div>
        </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="max-w-6xl mx-auto px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="flex gap-5">
          {['Privacy Policy', 'Terms of Service'].map((label) => (
            <a key={label} href="#" className="font-body text-xs text-muted hover:text-white transition-colors">
              {label}
            </a>
          ))}
        </div>
        <p className="font-body text-xs text-muted">
          © 2026 Chakh — Real reviews. Real taste.
        </p>
      </div>

    </footer>
  )
}
