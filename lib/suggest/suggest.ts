import type { Candidate } from '@/lib/search/ai/candidates'

const NO_MATCH = "We couldn't find a dish we've listed that fits. Try describing it differently!"

/** One dish as the AI sees it. The score is the only rating; unscored dishes say so. */
export function dishLine(c: Candidate): string {
  return [
    `id: ${c.id}`,
    `Dish: ${c.name}`,
    `Restaurant: ${c.restaurantName}${c.area ? `, ${c.area}` : ''} (${c.cityName})`,
    c.category && `Category: ${c.category}`,
    c.cuisine && `Cuisine: ${c.cuisine}`,
    `Price level: ${c.priceSymbol} (₹ cheapest, ₹₹₹ priciest; not an amount)`,
    c.score === null ? 'Not rated yet' : `Score: ${c.score}/10`,
    c.isMustTry && 'MUST TRY',
    c.diet && `Diet: ${c.diet}`,
    c.tastes.length > 0 && `Tastes: ${c.tastes.join(', ')}`,
    c.meals.length > 0 && `Meals: ${c.meals.join(', ')}`,
    c.notes.length > 0 && `Notes: ${c.notes.join('; ')}`,
  ]
    .filter(Boolean)
    .join(' | ')
}

export function buildSuggestPrompt(message: string, cands: Candidate[]): string {
  return `You are a local food expert for Chakh, an honest food guide in Gujarat, India. You only recommend dishes from the list below.

Dishes:
${cands.map(dishLine).join('\n')}

A user is asking: "${message}"

Suggest the single best match from the list.
- Among dishes that fit, prefer a higher score, then MUST TRY.
- "Not rated yet" means we haven't scored it. Suggest one only if no rated dish fits, and say plainly in the reason that we haven't rated it yet.
- Never invent a score or a taste. Only describe a dish using what the list says about it.
- Write the reason to the visitor, as "you". Never mention "the user", "the query" or "the list".

Reply in this exact JSON format (no markdown, no extra text):
{
  "id": "the dish's id from the list",
  "reason": "2-3 sentences on why it fits what they asked"
}

If nothing fits, set id to null and explain why in reason.`
}

export type Suggestion = {
  dish: string | null
  restaurant: string | null
  city: string | null
  score: number | null
  reason: string
  link: string | null
}

/** The AI only picks an id; every fact shown comes from the real dish, so it can't invent one. */
export function resolveSuggestion(raw: unknown, cands: Candidate[]): Suggestion {
  const parsed = (raw && typeof raw === 'object' ? raw : {}) as { id?: unknown; reason?: unknown }
  const reason = typeof parsed.reason === 'string' ? parsed.reason.trim() : ''
  const none = (why: string): Suggestion => ({ dish: null, restaurant: null, city: null, score: null, reason: why, link: null })

  if (parsed.id === null || parsed.id === undefined) return none(reason || NO_MATCH)
  const c = cands.find((d) => d.id === parsed.id)
  if (!c) return none(NO_MATCH)

  return {
    dish: c.name,
    restaurant: c.restaurantName,
    city: c.cityName,
    score: c.score,
    reason,
    link: `/${c.citySlug}/${c.restaurantId}`,
  }
}
