'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button, Field, Input, Textarea } from '@/components/admin/ui'

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

    // Insert, not upsert: each review is one visit. Re-tasting a dish must add to the
    // history, never replace it — that's what makes "tasted 4×" mean anything.
    const { error } = await supabase.from('reviews').insert({
      dish_id: dishId,
      tester_id: user.id,
      rating: form.rating,
      taste_notes: form.taste_notes || null,
      visit_date: form.visit_date,
    })

    if (error) {
      setError(
        error.code === '23505'
          ? 'You already logged this dish for that date. Pick a different visit date, or edit the existing review.'
          : error.message
      )
      setLoading(false)
      return
    }

    const citySlug = dish?.restaurants?.cities?.slug
    const restaurantId = dish?.restaurants?.id
    router.push(citySlug && restaurantId ? `/admin/restaurants/${restaurantId}` : '/admin')
  }

  return (
    <div className="max-w-lg">
      <h1 className="mb-1 font-anek text-3xl font-bold text-charcoal">Log a visit</h1>
      {dish && (
        <p className="mb-6 font-anek text-[15px] text-muted">
          Dish: <strong>{dish.name}</strong> at {dish.restaurants?.name}
        </p>
      )}
      <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-warm-200 bg-white p-6">
        <Field label="Rating *">
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setForm((f) => ({ ...f, rating: star }))}
                className={`text-3xl transition-transform hover:scale-110 ${star <= form.rating ? 'text-amber-400' : 'text-warm-200'}`}
              >
                ★
              </button>
            ))}
            <span className="ml-2 self-center font-anek text-sm text-muted">{form.rating}/5</span>
          </div>
        </Field>
        <Field label="Taste Notes">
          <Textarea
            value={form.taste_notes}
            onChange={(e) => setForm((f) => ({ ...f, taste_notes: e.target.value }))}
            placeholder="How did it taste? What made it special or disappointing?"
            rows={4}
          />
        </Field>
        <Field label="Visit Date *">
          <Input
            type="date"
            required
            value={form.visit_date}
            onChange={(e) => setForm((f) => ({ ...f, visit_date: e.target.value }))}
          />
        </Field>
        {error && <p className="font-anek text-sm text-spice">{error}</p>}
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? 'Saving...' : 'Submit Review'}
        </Button>
      </form>
    </div>
  )
}
