'use client'

import { useState } from 'react'
import Link from 'next/link'

type SuggestionResult = {
  dish: string | null
  restaurant: string | null
  city: string | null
  reason: string | null
  link: string | null
  suggestion?: string
  error?: string
}

const EXAMPLE_PROMPTS = [
  'I want something spicy and cheap in Surat',
  'Best street food near me',
  'Something sweet for dessert in Vadodara',
  'Light lunch that is healthy',
  'Must try local Gujarati food',
]

export default function SuggestPage() {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<SuggestionResult | null>(null)

  async function handleSubmit(e: React.FormEvent | null, prefill?: string) {
    e?.preventDefault()
    const msg = prefill ?? input
    if (!msg.trim()) return

    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg }),
      })
      const data = await res.json()
      setResult(data)
    } catch {
      setResult({ dish: null, restaurant: null, city: null, reason: null, link: null, error: 'Network error. Please try again.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-10">
        <div className="text-6xl mb-4">🤖</div>
        <h1 className="text-4xl font-bold mb-3">AI Food Suggest</h1>
        <p className="text-gray-500 text-lg">
          Tell us what you&apos;re craving in plain language — our AI will find the perfect verified dish for you.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-orange-100 p-6 mb-6">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. I want something spicy and cheap in Surat, or the best street food in Vadodara..."
          className="w-full border border-gray-200 rounded-xl p-4 text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none h-28"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="mt-3 w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white font-bold py-3 px-6 rounded-xl transition-colors"
        >
          {loading ? '🔍 Finding your dish...' : '🍽️ Find My Food'}
        </button>
      </form>

      {/* Example prompts */}
      <div className="mb-8">
        <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-2">Try an example</p>
        <div className="flex flex-wrap gap-2">
          {EXAMPLE_PROMPTS.map((p) => (
            <button
              key={p}
              onClick={() => { setInput(p); handleSubmit(null, p) }}
              className="text-sm bg-orange-50 hover:bg-orange-100 text-orange-700 px-3 py-1.5 rounded-full transition-colors"
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Result */}
      {result && (
        <div className="bg-white rounded-2xl shadow-sm border border-orange-200 overflow-hidden">
          {result.error ? (
            <div className="p-6 text-center text-red-500">{result.error}</div>
          ) : result.dish ? (
            <>
              <div className="bg-gradient-to-r from-orange-500 to-red-500 p-6 text-white">
                <p className="text-xs uppercase tracking-wide font-semibold text-orange-100 mb-1">AI Recommendation</p>
                <h2 className="text-2xl font-bold">{result.dish}</h2>
                <p className="text-orange-100 mt-1">at {result.restaurant}, {result.city}</p>
              </div>
              <div className="p-6">
                <p className="text-gray-700 leading-relaxed">{result.reason}</p>
                {result.link && (
                  <Link
                    href={result.link}
                    className="mt-4 inline-block bg-orange-500 hover:bg-orange-600 text-white font-bold py-2.5 px-6 rounded-xl transition-colors"
                  >
                    View Restaurant →
                  </Link>
                )}
              </div>
            </>
          ) : (
            <div className="p-6">
              <p className="text-gray-600">{result.suggestion ?? result.reason ?? 'No match found. Try a different description!'}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
