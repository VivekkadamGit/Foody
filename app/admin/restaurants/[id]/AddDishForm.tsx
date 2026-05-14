'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AddDishForm({ restaurantId }: { restaurantId: string }) {
  const router = useRouter()
  const [form, setForm] = useState({ name: '', description: '', is_must_try: false })
  const [photo, setPhoto] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()

    let photo_url: string | null = null
    if (photo) {
      const ext = photo.name.split('.').pop()
      const path = `dishes/${restaurantId}/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage.from('dish-photos').upload(path, photo)
      if (uploadError) { setError(uploadError.message); setLoading(false); return }
      const { data: { publicUrl } } = supabase.storage.from('dish-photos').getPublicUrl(path)
      photo_url = publicUrl
    }

    const { error } = await supabase.from('dishes').insert({
      restaurant_id: restaurantId,
      name: form.name,
      description: form.description || null,
      is_must_try: form.is_must_try,
      photo_url,
    })

    if (error) { setError(error.message); setLoading(false); return }
    setForm({ name: '', description: '', is_must_try: false })
    setPhoto(null)
    router.refresh()
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Dish Name *</label>
        <input
          type="text"
          required
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-orange-400"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <textarea
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          rows={2}
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Dish Photo</label>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
          className="w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100"
        />
      </div>
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={form.is_must_try}
          onChange={(e) => setForm((f) => ({ ...f, is_must_try: e.target.checked }))}
          className="w-4 h-4 accent-orange-500"
        />
        <span className="text-sm text-gray-700">Mark as "Must Try"</span>
      </label>
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white font-bold py-2.5 rounded-xl transition-colors"
      >
        {loading ? 'Saving...' : 'Add Dish'}
      </button>
    </form>
  )
}
