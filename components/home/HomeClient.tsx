'use client'

import { useEffect, useRef, useState, CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import MustTryRanking, { RankedDish } from './MustTryRanking'
import QualityBadge from './QualityBadge'
import CitiesGrid from './CitiesGrid'

export type CityBundle = {
  city: { name: string; slug: string }
  dishCount: number
  watermarkDishes: string[]
  ranking: RankedDish[]
}

type FloatingWord = { id: number; text: string; style: CSSProperties }

const CACHE_KEY = 'chakh_nearby_city'
const CACHE_TTL = 24 * 60 * 60 * 1000

const ZONES = [
  () => ({ x: 4 + Math.random() * 90, y: 3 + Math.random() * 16 }),
  () => ({ x: 4 + Math.random() * 90, y: 74 + Math.random() * 16 }),
  () => ({ x: 2 + Math.random() * 18, y: 22 + Math.random() * 48 }),
  () => ({ x: 78 + Math.random() * 18, y: 22 + Math.random() * 48 }),
]

type LockedCity = { name: string; slug: string }

export default function HomeClient({ bundles, lockedCities = [] }: { bundles: CityBundle[]; lockedCities?: LockedCity[] }) {
  const router = useRouter()
  const [activeSlug, setActiveSlug] = useState(bundles[0]?.city.slug ?? '')
  const [query, setQuery] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const [words, setWords] = useState<FloatingWord[]>([])
  const wordId = useRef(0)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)
  const activeSpotsRef = useRef<{ id: number; x: number; y: number }[]>([])
  const recentTextsRef = useRef<string[]>([])

  const active = bundles.find((b) => b.city.slug === activeSlug) ?? bundles[0]

  const MIN_SPACING = 26 // percentage points apart, so concurrent words don't crowd

  function pickSpacedZone() {
    let zone = ZONES[Math.floor(Math.random() * ZONES.length)]()
    for (let attempt = 0; attempt < 10; attempt++) {
      const candidate = ZONES[Math.floor(Math.random() * ZONES.length)]()
      const tooClose = activeSpotsRef.current.some(
        (spot) => Math.hypot(spot.x - candidate.x, spot.y - candidate.y) < MIN_SPACING
      )
      zone = candidate
      if (!tooClose) break
    }
    return zone
  }

  function pickDish(dishes: string[]) {
    const unused = dishes.filter((d) => !recentTextsRef.current.includes(d))
    const pool = unused.length > 0 ? unused : dishes
    const text = pool[Math.floor(Math.random() * pool.length)]
    recentTextsRef.current = [text, ...recentTextsRef.current].slice(0, Math.min(5, dishes.length - 1))
    return text
  }

  function spawnWord(dishes: string[]) {
    if (dishes.length === 0) return
    const id = ++wordId.current
    const size = 60 + Math.random() * 50
    const peak = 0.5 + Math.random() * 0.15
    const dur = 10 + Math.random() * 6
    const zone = pickSpacedZone()

    activeSpotsRef.current.push({ id, x: zone.x, y: zone.y })
    setWords((prev) => [
      ...prev,
      {
        id,
        text: pickDish(dishes),
        style: {
          position: 'absolute',
          left: `${zone.x}%`,
          top: `${zone.y}%`,
          fontSize: `${size}px`,
          color: '#5c4834',
          fontWeight: 700,
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          zIndex: 0,
          fontFamily: 'var(--font-anek), sans-serif',
          opacity: 0,
          animation: `gwFloat ${dur}s ease-in-out forwards`,
          ['--peak' as string]: peak,
        },
      },
    ])
    setTimeout(() => {
      setWords((prev) => prev.filter((w) => w.id !== id))
      activeSpotsRef.current = activeSpotsRef.current.filter((spot) => spot.id !== id)
    }, (dur + 1) * 1000)
  }

  useEffect(() => {
    if (!active) return
    const dishes = active.watermarkDishes
    activeSpotsRef.current = []
    recentTextsRef.current = []
    for (let i = 0; i < 4; i++) setTimeout(() => spawnWord(dishes), i * 1800)
    if (timer.current) clearInterval(timer.current)
    timer.current = setInterval(() => spawnWord(dishes), 3600)
    return () => { if (timer.current) clearInterval(timer.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSlug])

  useEffect(() => {
    const cached = localStorage.getItem(CACHE_KEY)
    if (cached) {
      try {
        const { slug, ts } = JSON.parse(cached)
        if (Date.now() - ts < CACHE_TTL && bundles.some((b) => b.city.slug === slug)) {
          setActiveSlug(slug)
          return
        }
      } catch { /* ignore corrupt cache */ }
    }

    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
            { headers: { 'Accept-Language': 'en' } }
          )
          const data = await res.json()
          const detected = (data.address?.city || data.address?.town || data.address?.state_district || '').toLowerCase()
          const matched = bundles.find(
            (b) => detected.includes(b.city.name.toLowerCase()) || b.city.name.toLowerCase().includes(detected)
          )
          if (matched) {
            localStorage.setItem(CACHE_KEY, JSON.stringify({ slug: matched.city.slug, ts: Date.now() }))
            setActiveSlug(matched.city.slug)
          }
        } catch { /* keep default city */ }
      },
      () => { /* keep default city */ }
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!active) return null

  const matches = query.trim()
    ? active.ranking.filter((d) => d.name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 5)
    : []

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    router.push(`/${active.city.slug}${query ? `?q=${encodeURIComponent(query)}` : ''}`)
  }

  const popularTags = active.ranking.slice(0, 4).map((d) => d.name)

  return (
    <>
      {/* ===== Hero ===== */}
      <section className="relative overflow-hidden bg-ink">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {words.map((w) => (
            <span key={w.id} style={w.style}>{w.text}</span>
          ))}
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(120% 78% at 50% 40%, rgba(23,17,14,.75) 0%, rgba(23,17,14,.36) 45%, rgba(23,17,14,.93) 100%)',
            }}
          />
        </div>

        {/* Nav */}
        <div className="relative flex items-center justify-between px-6 sm:px-8 py-5">
          <div className="flex items-baseline">
            <span className="font-anek text-3xl font-extrabold tracking-tight text-ember-light">chakh</span>
            <span className="w-2 h-2 rounded-full bg-ember ml-1" />
          </div>
          <div className="hidden md:flex items-center gap-6 font-anek text-[13.5px] font-medium text-[#cdc2b8]">
            <a href="#must-try" className="hover:text-[#fdf9f4] transition-colors">Must try</a>
            {bundles.length > 1 ? (
              <select
                value={activeSlug}
                onChange={(e) => setActiveSlug(e.target.value)}
                className="appearance-none bg-transparent border border-ember-light/45 rounded-full px-4 py-2 text-ember-light font-semibold cursor-pointer"
              >
                {bundles.map((b) => (
                  <option key={b.city.slug} value={b.city.slug} className="bg-ink text-[#fdf9f4]">
                    {b.city.name}
                  </option>
                ))}
              </select>
            ) : (
              <span className="border border-ember-light/45 rounded-full px-4 py-2 text-ember-light font-semibold">
                {active.city.name}
              </span>
            )}
          </div>
        </div>

        {/* Headline + search — the centerpiece: find food fast */}
        <div className="relative text-center px-6 pt-6 pb-14">
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full border border-white/[0.14] mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-confirmed" />
            <span className="font-anek text-[12.5px] font-medium text-[#cdc2b8]">
              {active.dishCount} {active.dishCount === 1 ? 'dish' : 'dishes'} rated in {active.city.name}
            </span>
          </div>
          <h1 className="font-anek text-[42px] sm:text-[64px] font-bold leading-[1.05] tracking-tight text-[#fdf9f4] max-w-3xl mx-auto mb-4">
            Find your next great plate,<br />in seconds.
          </h1>
          <p className="font-anek text-base sm:text-[17px] text-sand max-w-lg mx-auto mb-8">
            Stop reading online forums and boring, random reviews. Search, filter, and go.
          </p>

          <form
            onSubmit={handleSearch}
            className="max-w-3xl mx-auto text-left rounded-2xl overflow-hidden"
            style={{ border: '2px solid #d9482b', boxShadow: '0 24px 60px rgba(0,0,0,.5)' }}
          >
            <div className="flex items-center bg-white pl-5 pr-1.5 py-1.5 gap-3.5">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#b4aaa2" strokeWidth={2.5} className="flex-shrink-0">
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.3-4.3" strokeLinecap="round" />
              </svg>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                placeholder={`Search dishes in ${active.city.name}…`}
                className="flex-1 min-w-0 border-none outline-none py-3.5 text-[16.5px] text-[#1c1611] bg-transparent font-anek"
              />
              <button
                type="submit"
                className="font-anek text-[15px] font-semibold px-8 py-3.5 rounded-lg bg-ember text-white flex-shrink-0"
              >
                Chakhle
              </button>
            </div>

            {matches.length > 0 && (
              <div className="bg-white border-t border-[#ede8e1]">
                {matches.map((d, i) => (
                  <Link
                    key={d.id}
                    href={`/${active.city.slug}?q=${encodeURIComponent(d.name)}`}
                    className={`flex items-center gap-3.5 px-5 py-3 ${i % 2 === 1 ? 'bg-[#fdf6f2]' : ''} ${i > 0 ? 'border-t border-[#f2ede6]' : ''}`}
                  >
                    <div
                      className="w-10 h-10 rounded-md flex-shrink-0"
                      style={{ background: 'repeating-linear-gradient(135deg,#ece7dd 0 7px,#e2dcd1 7px 14px)' }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-anek text-[15px] font-semibold text-[#1c1611] truncate m-0">{d.name}</p>
                      <p className="font-anek text-[12.5px] text-sand-dark truncate m-0">
                        Best at {d.restaurantName} · {d.priceSymbol}
                      </p>
                    </div>
                    <div className="flex items-center gap-2.5 flex-shrink-0">
                      <QualityBadge score={d.score} reviewCount={d.reviewCount} size="sm" dark={false} />
                      <span className="font-barlow text-2xl font-bold text-[#1c1611]">{d.score.toFixed(1)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between px-5 py-3 bg-[#fdfbf8] border-t border-[#ede8e1] flex-wrap gap-2">
              <div className="flex items-center gap-3.5 font-anek text-[13.5px] flex-wrap">
                <span className="text-sand-dark">Popular:</span>
                {popularTags.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setQuery(name)}
                    className="text-ember hover:text-ember-light transition-colors font-medium"
                  >
                    {name}
                  </button>
                ))}
              </div>
              <span className="font-anek text-[12.5px] text-[#a09a90]">{active.city.name}</span>
            </div>
          </form>
        </div>
      </section>

      {/* ===== Must try — filterable, full width ===== */}
      <section id="must-try" className="bg-ink-light px-6 sm:px-8 py-13 sm:py-14 border-t border-white/[0.06]">
        <div className="max-w-4xl mx-auto">
          <MustTryRanking
            dishes={active.ranking}
            cityName={active.city.name}
            citySlug={active.city.slug}
            totalCount={active.dishCount}
          />
        </div>
      </section>

      <CitiesGrid
        cities={[
          ...bundles.map((b) => ({ name: b.city.name, slug: b.city.slug, dishCount: b.dishCount, locked: false })),
          ...lockedCities.map((c) => ({ name: c.name, slug: c.slug, dishCount: 0, locked: true })),
        ]}
        homeSlug={active.city.slug}
      />
    </>
  )
}
