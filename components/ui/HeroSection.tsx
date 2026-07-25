'use client'

import { useState, useEffect, useRef, CSSProperties } from 'react'
import { useRouter } from 'next/navigation'

type CityData = { city: { name: string; slug: string }; dishes: string[] }
type FloatingWord = { id: number; text: string; style: CSSProperties }

const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  ahmedabad: { lat: 23.0225, lng: 72.5714 },
  surat:     { lat: 21.1702, lng: 72.8311 },
  vadodara:  { lat: 22.3072, lng: 73.1812 },
}

const ZONES = [
  () => ({ x: 4  + Math.random() * 90, y: 3  + Math.random() * 18 }),
  () => ({ x: 4  + Math.random() * 90, y: 76 + Math.random() * 18 }),
  () => ({ x: 2  + Math.random() * 21, y: 22 + Math.random() * 54 }),
  () => ({ x: 75 + Math.random() * 21, y: 22 + Math.random() * 54 }),
]

export default function HeroSection({ cityData }: { cityData: CityData[] }) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [step, setStep] = useState<'prompt' | 'loading' | 'done'>('prompt')
  const [activeCity, setActiveCity] = useState<CityData | null>(null)
  const [words, setWords] = useState<FloatingWord[]>([])
  const wordId = useRef(0)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  function nearestCity(lat: number, lng: number) {
    let best = cityData[0]
    let bestD = Infinity
    for (const cd of cityData) {
      const c = CITY_COORDS[cd.city.slug]
      if (!c) continue
      const d = Math.hypot(lat - c.lat, lng - c.lng)
      if (d < bestD) { bestD = d; best = cd }
    }
    return best
  }

  function spawnWord(dishes: string[]) {
    const id = ++wordId.current
    const size  = 18 + Math.random() * 34
    const peak  = 0.10 + Math.random() * 0.22
    const dur   = 12 + Math.random() * 8
    const zone  = ZONES[Math.floor(Math.random() * ZONES.length)]()
    const angle = Math.random() * Math.PI * 2
    const dist  = 60 + Math.random() * 70
    const gx    = Math.cos(angle) * dist
    const gy    = Math.sin(angle) * dist
    const mid   = 0.45 + Math.random() * 0.1

    setWords(prev => [...prev, {
      id,
      text: dishes[Math.floor(Math.random() * dishes.length)],
      style: {
        position: 'absolute', left: `${zone.x}%`, top: `${zone.y}%`,
        fontSize: `${size}px`, color: '#C8A97E', fontWeight: 700,
        letterSpacing: '0.3px', pointerEvents: 'none', whiteSpace: 'nowrap',
        zIndex: 1, opacity: 0,
        animation: `wordFloat ${dur}s ease-in-out forwards`,
        ['--peak' as string]: peak,
        ['--x1' as string]: `${gx * mid}px`, ['--y1' as string]: `${gy * mid}px`,
        ['--x2' as string]: `${gx}px`,        ['--y2' as string]: `${gy}px`,
        ['--x3' as string]: `${gx * 1.06}px`, ['--y3' as string]: `${gy * 1.06}px`,
      },
    }])
    setTimeout(() => setWords(prev => prev.filter(w => w.id !== id)), (dur + 1) * 1000)
  }

  function loadCity(cd: CityData | undefined) {
    if (!cd) return
    setActiveCity(cd)
    setStep('done')
    const dishes = cd.dishes
    for (let i = 0; i < 5; i++) setTimeout(() => spawnWord(dishes), i * 1200)
    timer.current = setInterval(() => spawnWord(dishes), 2500)
  }

  function requestLocation() {
    setStep('loading')
    if (!navigator.geolocation) { loadCity(cityData[0]); return }
    navigator.geolocation.getCurrentPosition(
      pos => loadCity(nearestCity(pos.coords.latitude, pos.coords.longitude)),
      ()  => loadCity(cityData[0]),
      { timeout: 6000 }
    )
  }

  useEffect(() => () => { if (timer.current) clearInterval(timer.current) }, [])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const slug = activeCity?.city.slug ?? cityData[0]?.city.slug
    if (slug) router.push(`/${slug}${query ? `?q=${encodeURIComponent(query)}` : ''}`)
  }

  const tags = activeCity?.dishes.slice(0, 4) ?? []
  const [searchFocused, setSearchFocused] = useState(false)

  return (
    <section style={{
      position: 'relative',
      background: 'linear-gradient(160deg,#1A1614 0%,#2C1F1A 60%,#1A1614 100%)',
      padding: 'clamp(80px,10vw,120px) clamp(24px,5vw,60px)',
      textAlign: 'center', overflow: 'hidden',
      minHeight: '560px', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
    }}>
      {/* Floating dish words */}
      {words.map(w => <div key={w.id} style={w.style}>{w.text}</div>)}

      {/* Location overlay */}
      {step !== 'done' && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 20,
          background: 'rgba(15,11,9,0.88)', backdropFilter: 'blur(4px)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: '14px',
        }}>
          <div style={{ fontSize: '38px', animation: 'locPulse 2s ease-in-out infinite' }}>📍</div>
          {step === 'prompt' ? (
            <>
              <h2 style={{ color: '#FAF6EF', fontSize: '22px', fontWeight: 800 }}>Where are you eating?</h2>
              <p style={{ color: '#888', fontSize: '14px', textAlign: 'center', maxWidth: '280px', lineHeight: 1.6 }}>
                Allow location and we&apos;ll show popular dishes near you
              </p>
              <button onClick={requestLocation} style={{
                background: '#C0432A', color: '#fff', border: 'none',
                padding: '13px 32px', borderRadius: '30px',
                fontSize: '15px', fontWeight: 700, cursor: 'pointer',
              }}>
                Allow Location
              </button>
              <button onClick={() => loadCity(cityData[0])} style={{
                background: 'none', border: 'none', color: '#666',
                fontSize: '12px', cursor: 'pointer',
              }}>
                Skip — show {cityData[0]?.city.name}
              </button>
            </>
          ) : (
            <p style={{ color: '#FAF6EF', fontSize: '15px' }}>Detecting your location…</p>
          )}
        </div>
      )}

      {/* Hero content */}
      <div style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: '640px', margin: '0 auto' }}>
        <p style={{ color: '#C8A97E', fontSize: '11px', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '14px', fontWeight: 600 }}>
          India&apos;s honest food guide
        </p>
        <h1 style={{ color: '#FAF6EF', fontSize: 'clamp(36px,5vw,56px)', fontWeight: 800, lineHeight: 1.15, marginBottom: '12px', textShadow: '0 2px 20px rgba(0,0,0,.6)' }}>
          Find your next<br />favourite dish
        </h1>
        <p style={{ color: activeCity ? '#C8A97E' : '#555', fontSize: '14px', marginBottom: '32px', minHeight: '20px', transition: 'color .4s' }}>
          {activeCity ? `Popular food around ${activeCity.city.name}` : ' '}
        </p>

        <form onSubmit={handleSearch} style={{ maxWidth: '560px', margin: '0 auto' }}>
          <div style={{
            background: '#fff', borderRadius: '14px', overflow: 'hidden',
            boxShadow: searchFocused ? '0 8px 40px rgba(192,67,42,.5)' : '0 8px 32px rgba(0,0,0,.5)',
            border: searchFocused ? '2.5px solid #C8A97E' : '2.5px solid #C0432A',
            transition: 'border-color .2s, box-shadow .2s',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', padding: '4px 4px 4px 18px', gap: '10px' }}>
              <span style={{ fontSize: '18px' }}>🔍</span>
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                placeholder={activeCity ? `Search in ${activeCity.city.name}…` : 'Search dishes, restaurants…'}
                style={{
                  flex: 1, border: 'none', outline: 'none', padding: '14px 0',
                  fontSize: '15px', color: '#1A1614', background: 'transparent',
                  minWidth: 0, fontWeight: 500,
                }}
              />
              <button type="submit" style={{
                background: '#C0432A', color: '#fff', border: 'none',
                padding: '14px 22px', fontSize: '13px', fontWeight: 700,
                cursor: 'pointer', borderRadius: '10px', flexShrink: 0,
              }}>
                Search
              </button>
            </div>
            <div style={{
              background: '#FAF6EF', padding: '19px 28px', borderTop: '1px solid #E8E2D9',
              fontSize: '11px', color: '#888', display: 'flex', gap: '8px',
              flexWrap: 'wrap', alignItems: 'center',
            }}>
              {tags.length > 0 ? (
                <>
                  <span style={{ opacity: 0.6 }}>Popular:</span>
                  {tags.map(dish => (
                    <button key={dish} type="button" onClick={() => setQuery(dish)} style={{
                      background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                      color: '#C0432A', fontWeight: 600, fontSize: '11px',
                    }}>
                      {dish}
                    </button>
                  ))}
                  <span style={{ marginLeft: 'auto', opacity: 0.45, fontSize: '10px' }}>📍 {activeCity?.city.name}</span>
                </>
              ) : (
                <span style={{ color: '#bbb' }}>Allow location to see popular dishes nearby</span>
              )}
            </div>
          </div>
        </form>
      </div>
    </section>
  )
}
