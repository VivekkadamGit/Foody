import { unstable_cache } from 'next/cache'
import { generateJson } from '@/lib/ai/gemini'
import { buildMatchPrompt, buildOtherCitiesPrompt } from './prompt'
import type { AiDeps } from './run'

/** An hour-old answer is fine; ids that stopped existing are dropped by resolveMatch anyway. */
const CACHE_SECONDS = 3600

export const aiDeps: AiDeps = {
  match: (query, cands, key) =>
    unstable_cache(() => generateJson(buildMatchPrompt(query, cands)), ['ai-match', key], {
      revalidate: CACHE_SECONDS,
    })(),
  otherCities: (missing, cands, key) =>
    unstable_cache(() => generateJson(buildOtherCitiesPrompt(missing, cands)), ['ai-other-cities', key], {
      revalidate: CACHE_SECONDS,
    })(),
}
