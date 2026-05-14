import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { createClient } from '@supabase/supabase-js'

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

    const { data: dishes } = await supabase
      .from('dishes')
      .select(`
        name, description, is_must_try,
        restaurants!inner(name, address, cuisine_type, price_range, cities!inner(name, slug), id),
        reviews(rating, taste_notes)
      `)
      .limit(200)

    if (!dishes || dishes.length === 0) {
      return NextResponse.json({
        suggestion: "We're still building our database of reviewed dishes. Check back soon! In the meantime, browse Surat or Vadodara to see what's available.",
        restaurant: null,
        link: null,
      })
    }

    const dishContext = dishes
      .map((d: any) => {
        const ratings = d.reviews?.map((r: any) => r.rating) ?? []
        const avg = ratings.length ? (ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length).toFixed(1) : null
        if (!avg) return null
        const notes = d.reviews?.map((r: any) => r.taste_notes).filter(Boolean).join('; ')
        const price = ['', '₹ Budget', '₹₹ Mid-range', '₹₹₹ Premium'][d.restaurants.price_range]
        return `Dish: ${d.name} | Restaurant: ${d.restaurants.name} (${d.restaurants.cities.name}) | Cuisine: ${d.restaurants.cuisine_type?.join(', ')} | Price: ${price} | Rating: ${avg}/5${d.is_must_try ? ' | MUST TRY' : ''}${notes ? ` | Notes: ${notes}` : ''}`
      })
      .filter(Boolean)
      .join('\n')

    const prompt = `You are a local food expert for Surat and Vadodara, Gujarat, India. You only recommend dishes from the verified list below.

Verified reviewed dishes:
${dishContext}

A user is asking: "${message}"

Based ONLY on the dishes listed above, suggest the single best match for the user's request.
Reply in this exact JSON format (no markdown, no extra text):
{
  "dish": "dish name",
  "restaurant": "restaurant name",
  "city": "city name",
  "reason": "2-3 sentence explanation of why this is perfect for what they asked",
  "restaurant_id": "restaurant id from the data"
}

If nothing matches well, set dish to null and explain in reason why nothing fits.`

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
    const result = await model.generateContent(prompt)
    const text = result.response.text().trim()

    // Strip markdown code fences if Gemini wraps in ```json
    const cleaned = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '')

    let parsed: any = {}
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      return NextResponse.json({ suggestion: text, restaurant: null, link: null })
    }

    const matchedDish: any = dishes.find((d: any) =>
      d.name === parsed.dish && d.restaurants.name === parsed.restaurant
    )
    const citySlug = matchedDish?.restaurants.cities?.slug ?? null
    const restaurantId = matchedDish?.restaurants.id ?? null
    const link = citySlug && restaurantId ? `/${citySlug}/${restaurantId}` : null

    return NextResponse.json({
      dish: parsed.dish,
      restaurant: parsed.restaurant,
      city: parsed.city,
      reason: parsed.reason,
      link,
    })
  } catch (err) {
    console.error('Suggest API error:', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
