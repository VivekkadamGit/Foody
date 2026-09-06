'use client'

import { useEffect, useRef, useState, CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import { confidenceLabel, confidenceTier } from '@/lib/dishScore'
import MustTryRanking, { RankedDish } from './MustTryRanking'
import WhatsNewPanel, { WhatsNewItem } from './WhatsNewPanel'
import VotingBox from './VotingBox'
import HowWeRate from './HowWeRate'
import WatchSection from './WatchSection'
import CitiesGrid from './CitiesGrid'

type JustTasted = { name: string; restaurantName: string; score: number; reviewCount: number; date: string }

export type CityBundle = {
  city: { name: string; slug: string }
  dishCount: number
  watermarkDishes: string[]
  ranking: RankedDish[]
  justTasted: JustTasted[]
  whatsNew: WhatsNewItem[]
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
    ? active.ranking.filter((d) => d.name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 4)
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
            <a href="#must-try" className="hover:text-[#fdf9f4] transition-colors">What&apos;s new</a>
            <a href="#watch" className="hover:text-[#fdf9f4] transition-colors">Watch</a>
            <a href="#how-we-rate" className="hover:text-[#fdf9f4] transition-colors">How we rate</a>
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

        {/* Headline + search */}
        <div className="relative text-center px-6 pt-6 pb-4">
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full border border-white/[0.14] mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-confirmed" />
            <span className="font-anek text-[12.5px] font-medium text-[#cdc2b8]">
              {active.dishCount} {active.dishCount === 1 ? 'dish' : 'dishes'} · new scores as they are eaten
            </span>
          </div>
          <h1 className="font-anek text-[42px] sm:text-[64px] font-bold leading-[1.05] tracking-tight text-[#fdf9f4] max-w-3xl mx-auto mb-4">
            One score per dish.<br />Nobody paid for it.
          </h1>
          <p className="font-anek text-base sm:text-[17px] text-sand max-w-lg mx-auto mb-8">
            Stop reading twelve Reddit threads to find one good plate. We eat it, we score it, we tell you exactly where to go.
          </p>

          <form
            onSubmit={handleSearch}
            className="max-w-3xl mx-auto text-left rounded-2xl overflow-hidden"
            style={{ border: '2px solid #d9482b', boxShadow: '0 24px 60px rgba(0,0,0,.5)' }}
          >
            <div className="flex items-center bg-white pl-5 pr-1.5 py-1.5 gap-3.5">
              <span className="w-[15px] h-[15px] rounded-full border-2 border-[#b4aaa2] flex-shrink-0" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                placeholder={`Search in ${active.city.name}…`}
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
                  <div
                    key={d.id}
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
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span
                        className={`font-anek text-[10px] font-semibold px-2 py-1 rounded border tracking-wide whitespace-nowrap ${
                          confidenceTier(d.reviewCount) === 'CONFIRMED'
                            ? 'bg-confirmed/[0.14] border-confirmed/40 text-[#1f7d52]'
                            : confidenceTier(d.reviewCount) === 'HOLDING_UP'
                            ? 'bg-gold2/20 border-gold2/50 text-[#a97521]'
                            : 'bg-[#f2ede6] border-[#e2dcd1] text-[#6f665d]'
                        }`}
                      >
                        {confidenceLabel(d.reviewCount)}
                      </span>
                      <span className="font-barlow text-2xl font-bold text-[#1c1611]">{d.score.toFixed(1)}</span>
                    </div>
                  </div>
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

        {/* Just tasted strip */}
        {active.justTasted.length > 0 && (
          <div className="relative px-6 sm:px-8 pt-4 pb-8" style={{ background: 'linear-gradient(rgba(23,17,14,0),#1d1512 55%)' }}>
            <div className="max-w-6xl mx-auto">
              <div className="flex items-baseline justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-ember" />
                  <span className="font-anek text-[11.5px] font-semibold uppercase tracking-[0.18em] text-gold2">Just tasted</span>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                {active.justTasted.slice(0, 3).map((d, i) => (
                  <div key={i} className="bg-ink-card border border-white/[0.07] rounded-xl px-4 pt-3.5 pb-5">
                    <div className="flex justify-between items-baseline mb-2">
                      <span
                        className={`font-anek text-[10px] font-semibold px-1.5 py-1 rounded border tracking-wide whitespace-nowrap ${
                          confidenceTier(d.reviewCount) === 'CONFIRMED'
                            ? 'bg-confirmed/[0.14] border-confirmed/40 text-confirmed'
                            : confidenceTier(d.reviewCount) === 'HOLDING_UP'
                            ? 'bg-gold2/[0.16] border-gold2/40 text-gold2'
                            : 'bg-ember/20 border-ember/45 text-[#e8735f]'
                        }`}
                      >
                        {confidenceLabel(d.reviewCount)}
                      </span>
                      <span className="font-barlow text-2xl font-bold text-[#cdc2b8]">{d.score.toFixed(1)}</span>
                    </div>
                    <p className="font-anek text-base font-semibold text-[#fdf9f4] m-0">{d.name}</p>
                    <p className="font-anek text-[12.5px] text-sand-dark m-0">{d.restaurantName}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ===== Must try + What's new/Vote ===== */}
      <section id="must-try" className="bg-ink-light px-6 sm:px-8 py-13 sm:py-14 border-t border-white/[0.06]">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[1fr_356px] gap-8 items-start">
          <MustTryRanking
            dishes={active.ranking}
            cityName={active.city.name}
            citySlug={active.city.slug}
            totalCount={active.dishCount}
          />
          <div className="grid gap-4">
            <WhatsNewPanel items={active.whatsNew} />
            <VotingBox />
          </div>
        </div>
      </section>

      <div id="how-we-rate">
        <HowWeRate />
      </div>
      <div id="watch">
        <WatchSection />
      </div>
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
