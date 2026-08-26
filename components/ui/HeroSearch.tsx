'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

type CityDishes = {
  city: { name: string; slug: string }
  dishes: string[]
}

export default function HeroSearch({ cityDishes }: { cityDishes: CityDishes[] }) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [nearbyCity, setNearbyCity] = useState<CityDishes | null>(null)
  const [locationStatus, setLocationStatus] = useState<'idle' | 'loading' | 'found' | 'denied'>('idle')

  useEffect(() => {
    const CACHE_KEY = 'chakh_nearby_city'
    const CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours

    const cached = localStorage.getItem(CACHE_KEY)
    if (cached) {
      try {
        const { slug, ts } = JSON.parse(cached)
        if (Date.now() - ts < CACHE_TTL) {
          const matched = cityDishes.find((cd) => cd.city.slug === slug)
          if (matched) {
            setNearbyCity(matched)
            setLocationStatus('found')
            return
          }
        }
      } catch { /* ignore corrupt cache */ }
    }

    if (!navigator.geolocation) return
    setLocationStatus('loading')
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
            { headers: { 'Accept-Language': 'en' } }
          )
          const data = await res.json()
          const detectedCity = (
            data.address?.city ||
            data.address?.town ||
            data.address?.state_district ||
            ''
          ).toLowerCase()

          const matched = cityDishes.find((cd) =>
            detectedCity.includes(cd.city.name.toLowerCase()) ||
            cd.city.name.toLowerCase().includes(detectedCity)
          )
          const result = matched ?? cityDishes[0] ?? null
          if (result) {
            localStorage.setItem(CACHE_KEY, JSON.stringify({ slug: result.city.slug, ts: Date.now() }))
          }
          setNearbyCity(result)
          setLocationStatus('found')
        } catch {
          setNearbyCity(cityDishes[0] ?? null)
          setLocationStatus('found')
        }
      },
      () => {
        setLocationStatus('denied')
        setNearbyCity(cityDishes[0] ?? null)
      }
    )
  }, [cityDishes])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const city = nearbyCity?.city.slug ?? cityDishes[0]?.city.slug
    if (city) router.push(`/${city}${query ? `?q=${encodeURIComponent(query)}` : ''}`)
  }

  const tags = nearbyCity?.dishes.slice(0, 4) ?? []

  return (
    <div className="w-full max-w-xl">
      <form onSubmit={handleSearch}>
        <div
          style={{
            background: '#FAF3E8',
            borderRadius: '14px',
            overflow: 'hidden',
            boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
            border: '2px solid #C0432A',
          }}
        >
          {/* Input row */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '4px 4px 4px 16px', gap: '8px' }}>
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#9B7B5A" strokeWidth={2.5}>
              <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
            </svg>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                locationStatus === 'loading'
                  ? 'Detecting your location…'
                  : nearbyCity
                  ? `Search in ${nearbyCity.city.name}…`
                  : 'Search dishes, restaurants…'
              }
              style={{
                flex: 1,
                border: 'none',
                outline: 'none',
                padding: '11px 0',
                fontSize: '14px',
                color: '#1A1614',
                background: 'transparent',
                minWidth: 0,
              }}
            />
            <button
              type="submit"
              style={{
                background: '#C0432A',
                color: '#fff',
                border: 'none',
                padding: '11px 20px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                borderRadius: '10px',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
              }}
            >
              Search
            </button>
          </div>

          {/* Tags row */}
          {(tags.length > 0 || locationStatus === 'idle') && (
            <div
              style={{
                background: '#F0E8D8',
                padding: '7px 16px',
                borderTop: '1px solid #E0D4C0',
                fontSize: '11px',
                color: '#7A6550',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                flexWrap: 'wrap',
              }}
            >
              {locationStatus === 'idle' && tags.length === 0 ? (
                <span style={{ color: '#9B7B5A' }}>Allow location to see nearby dishes</span>
              ) : (
                <>
                  <span style={{ opacity: 0.6 }}>Popular:</span>
                  {tags.map((dish) => (
                    <button
                      key={dish}
                      type="button"
                      onClick={() => setQuery(dish)}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        cursor: 'pointer',
                        color: '#C0432A',
                        fontWeight: 600,
                        fontSize: '11px',
                      }}
                    >
                      {dish}
                    </button>
                  ))}
                  {nearbyCity && locationStatus === 'found' && (
                    <span style={{ marginLeft: 'auto', opacity: 0.5, fontSize: '10px' }}>
                      📍 {nearbyCity.city.name}
                    </span>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </form>
    </div>
  )
}
