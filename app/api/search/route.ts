import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runSearch } from '@/lib/search/run'
import type { SearchResponse } from '@/lib/search/types'

/** Feeds the hero dropdown. The /search page calls runSearch directly. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = (searchParams.get('q') ?? '').trim()
  const city = (searchParams.get('city') ?? '').trim()

  if (q.length < 2 || !city) {
    const empty: SearchResponse = {
      kind: 'text', filters: { text: '', categories: [], diets: [], tastes: [], meals: [], cuisines: [] },
      ranked: [], onOurList: [], restaurants: [],
    }
    return NextResponse.json(empty)
  }

  try {
    const supabase = await createClient()
    return NextResponse.json(await runSearch(supabase, q, city))
  } catch (err) {
    console.error('[search] api failed:', err)
    return NextResponse.json({ error: 'search_failed' }, { status: 500 })
  }
}
