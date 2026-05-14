'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AddReviewPage() {
  const router = useRouter()
  const { id: dishId } = useParams<{ id: string }>()
  const [dish, setDish] = useState<any>(null)
  const [form, setForm] = useState({ rating: 5, taste_notes: '', visit_date: new Date().toISOString().split('T')[0] })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('dishes')
      .select('name, restaurants!inner(name, id, cities!inner(slug))')
      .eq('id', dishId)
      .single()
      .then(({ data }) => setDish(data))
  }, [dishId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Not logged in'); setLoading(false); return }

    const { error } = await supabase.from('reviews').upsert({
      dish_id: dishId,
      tester_id: user.id,
      rating: form.rating,
      taste_notes: form.taste_notes || null,
      visit_date: form.visit_date,
    }, { onConflict: 'dish_id,tester_id' })

    if (error) { setError(error.message); setLoading(false); return }

    const citySlug = dish?.restaurants?.cities?.slug
    const restaurantId = dish?.restaurants?.id
    router.push(citySlug && restaurantId ? `/admin/restaurants/${restaurantId}` : '/admin')
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold mb-1">Add Review</h1>
      {dish && (
        <p className="text-gray-500 mb-6 text-sm">
          Dish: <strong>{dish.name}</strong> at {dish.restaurants?.name}
        </p>
      )}
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Rating *</label>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setForm((f) => ({ ...f, rating: star }))}
                className={`text-3xl transition-transform hover:scale-110 ${star <= form.rating ? 'text-amber-400' : 'text-gray-200'}`}
              >
                ★
              </button>
            ))}
            <span className="text-sm text-gray-500 self-center ml-2">{form.rating}/5</span>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Taste Notes</label>
          <textarea
            value={form.taste_notes}
            onChange={(e) => setForm((f) => ({ ...f, taste_notes: e.target.value }))}
            placeholder="How did it taste? What made it special or disappointing?"
            rows={4}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Visit Date *</label>
          <input
            type="date"
            required
            value={form.visit_date}
            onChange={(e) => setForm((f) => ({ ...f, visit_date: e.target.value }))}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white font-bold py-3 rounded-xl transition-colors"
        >
          {loading ? 'Saving...' : 'Submit Review'}
        </button>
      </form>
    </div>
  )
}
