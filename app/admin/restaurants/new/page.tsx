'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const CUISINES = ['gujarati', 'street food', 'chinese', 'south indian', 'north indian', 'desserts', 'fast food', 'continental', 'pizza', 'burgers']

declare global {
  interface Window { initAutocomplete: () => void; google: any }
}

export default function NewRestaurantPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    name: '',
    address: '',
    city_id: '',
    google_place_id: '',
    latitude: '',
    longitude: '',
    price_range: '1',
    cuisine_type: [] as string[],
    cover_image_url: '',
  })
  const [cities, setCities] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const addressRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.from('cities').select('id, name').then(({ data }) => setCities(data ?? []))
  }, [])

  // Google Places Autocomplete
  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    if (!apiKey) return

    window.initAutocomplete = () => {
      if (!addressRef.current || !window.google) return
      const autocomplete = new window.google.maps.places.Autocomplete(addressRef.current, {
        componentRestrictions: { country: 'in' },
        fields: ['formatted_address', 'geometry', 'place_id', 'name'],
      })
      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace()
        setForm((f) => ({
          ...f,
          address: place.formatted_address ?? '',
          google_place_id: place.place_id ?? '',
          latitude: place.geometry?.location?.lat()?.toString() ?? '',
          longitude: place.geometry?.location?.lng()?.toString() ?? '',
        }))
      })
    }

    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initAutocomplete`
    script.async = true
    script.defer = true
    document.head.appendChild(script)
    return () => { document.head.removeChild(script) }
  }, [])

  function toggleCuisine(c: string) {
    setForm((f) => ({
      ...f,
      cuisine_type: f.cuisine_type.includes(c)
        ? f.cuisine_type.filter((x) => x !== c)
        : [...f.cuisine_type, c],
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { data, error } = await supabase.from('restaurants').insert({
      name: form.name,
      address: form.address,
      city_id: form.city_id,
      google_place_id: form.google_place_id || null,
      latitude: form.latitude ? parseFloat(form.latitude) : null,
      longitude: form.longitude ? parseFloat(form.longitude) : null,
      price_range: parseInt(form.price_range),
      cuisine_type: form.cuisine_type,
      cover_image_url: form.cover_image_url || null,
    }).select().single()

    if (error) { setError(error.message); setLoading(false); return }
    router.push(`/admin/restaurants/${data.id}`)
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Add New Restaurant</h1>
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Restaurant Name *</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
            <select
              required
              value={form.city_id}
              onChange={(e) => setForm((f) => ({ ...f, city_id: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-orange-400"
            >
              <option value="">Select city</option>
              {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Address (Google Places will autofill)</label>
          <input
            ref={addressRef}
            type="text"
            value={form.address}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            placeholder="Start typing the restaurant address..."
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
          {form.latitude && (
            <p className="text-xs text-green-600 mt-1">✓ Location captured: {form.latitude}, {form.longitude}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Price Range *</label>
          <div className="flex gap-3">
            {[['1', '₹ Budget'], ['2', '₹₹ Mid-range'], ['3', '₹₹₹ Premium']].map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => setForm((f) => ({ ...f, price_range: val }))}
                className={`flex-1 py-2 rounded-xl border text-sm font-medium transition-colors ${form.price_range === val ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-600 border-gray-200 hover:border-orange-300'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Cuisine Types</label>
          <div className="flex flex-wrap gap-2">
            {CUISINES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => toggleCuisine(c)}
                className={`text-sm px-3 py-1.5 rounded-full border capitalize transition-colors ${form.cuisine_type.includes(c) ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-600 border-gray-200 hover:border-orange-300'}`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Cover Image URL (optional)</label>
          <input
            type="url"
            value={form.cover_image_url}
            onChange={(e) => setForm((f) => ({ ...f, cover_image_url: e.target.value }))}
            placeholder="https://..."
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white font-bold py-3 rounded-xl transition-colors"
        >
          {loading ? 'Saving...' : 'Save Restaurant'}
        </button>
      </form>
    </div>
  )
}
