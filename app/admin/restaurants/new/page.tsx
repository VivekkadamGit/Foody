'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button, Field, Input, Select, Chip } from '@/components/admin/ui'

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
    <div className="space-y-6">
      <h1 className="font-anek text-3xl font-bold text-charcoal">Add New Restaurant</h1>
      <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-warm-200 bg-white p-6">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="Restaurant Name *">
            <Input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </Field>
          <Field label="City *">
            <Select
              required
              value={form.city_id}
              onChange={(e) => setForm((f) => ({ ...f, city_id: e.target.value }))}
            >
              <option value="">Select city</option>
              {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
        </div>

        <Field label="Address (Google Places will autofill)">
          <Input
            ref={addressRef}
            type="text"
            value={form.address}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            placeholder="Start typing the restaurant address..."
          />
          {form.latitude && (
            <p className="mt-1 font-anek text-xs text-[#1f7a52]">✓ Location captured: {form.latitude}, {form.longitude}</p>
          )}
        </Field>

        <Field label="Price Range *">
          <div className="flex gap-3">
            {[['1', '₹ Budget'], ['2', '₹₹ Mid-range'], ['3', '₹₹₹ Premium']].map(([val, label]) => (
              <Chip key={val} selected={form.price_range === val} onClick={() => setForm((f) => ({ ...f, price_range: val }))}>
                {label}
              </Chip>
            ))}
          </div>
        </Field>

        <Field label="Cuisine Types">
          <div className="flex flex-wrap gap-2">
            {CUISINES.map((c) => (
              <Chip key={c} selected={form.cuisine_type.includes(c)} onClick={() => toggleCuisine(c)}>
                {c.replace(/\b\w/g, (ch) => ch.toUpperCase())}
              </Chip>
            ))}
          </div>
        </Field>

        <Field label="Cover Image URL (optional)">
          <Input
            type="url"
            value={form.cover_image_url}
            onChange={(e) => setForm((f) => ({ ...f, cover_image_url: e.target.value }))}
            placeholder="https://..."
          />
        </Field>

        {error && <p className="font-anek text-sm text-spice">{error}</p>}
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? 'Saving...' : 'Save Restaurant'}
        </Button>
      </form>
    </div>
  )
}
