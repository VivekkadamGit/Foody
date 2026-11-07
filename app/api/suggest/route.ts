import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateJson } from '@/lib/ai/gemini'
import { fetchAllCandidates } from '@/lib/search/ai/candidates'
import { buildSuggestPrompt, resolveSuggestion } from '@/lib/suggest/suggest'

export async function POST(req: NextRequest) {
  try {
    const { message } = await req.json()
    if (!message?.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const dishes = await fetchAllCandidates(supabase)

    if (dishes.length === 0) {
      return NextResponse.json({
        suggestion: "We're still building our list of dishes. Check back soon!",
        restaurant: null,
        link: null,
      })
    }

    let parsed: unknown
    try {
      parsed = await generateJson(buildSuggestPrompt(message, dishes))
    } catch (err) {
      console.error('Suggest AI error:', err)
      return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
    }

    return NextResponse.json(resolveSuggestion(parsed, dishes))
  } catch (err) {
    console.error('Suggest API error:', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
