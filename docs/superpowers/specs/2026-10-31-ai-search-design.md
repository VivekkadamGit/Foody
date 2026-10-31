# AI Search — Design

**Date:** 2026-10-31
**Status:** Agreed in brainstorming, pending your review
**Builds on:** smart search (`docs/superpowers/specs/2026-09-30-smart-search-design.md`, which reserved a "RAG slot" in §2.3), `lib/search/`, `app/api/suggest/route.ts`

## 1. Intent

Today, search only understands words in a fixed dictionary (`lib/taxonomy.ts`). "best food of town"
works by luck, but "top class food", "something light after the gym" or "kuch meetha khana hai"
fall through to a name match and end up on "Nothing here yet".

Vivek wants search that **understands what the visitor means, whatever words they use**, and
answers with the reviewed dishes that genuinely suit the request. Chakh's whole value is
personally tasted, trustworthy picks, so the AI must **only ever surface dishes Chakh has
reviewed**. It is a smarter way of finding Vivek's dishes, not a chatbot that recommends food.

### What "best" means (Vivek's definition)

A dish is one of the best when it is marked **Must-try**, **or** when the review notes
(`reviews.taste_notes`) praise it strongly, even if Must-try was never ticked.

### Success looks like

- "top class food", "best food of town" and "highest quality dishes" all show essentially the same
  list: must-try and highly praised dishes.
- Mood, occasion, Hinglish and vague requests return sensible real dishes.
- Nothing invented ever appears.

## 2. Goals, non-goals, anti-goals

**Goals**
- Natural-language understanding for the `/search` page in any wording, including Hinglish.
- The AI reads dish name, tags, score, Must-try, restaurant, price and Vivek's taste notes.
- The result screen shows **only dishes** (cards), plus "Showing" chips saying what was understood.
- A clear, helpful screen when nothing in the city fits (§4).

**Non-goals**
- No AI-written explanation per dish. Vivek said "just dishes".
- No chat or follow-up conversation.
- No change to admin, tagging or the database schema.
- The `/suggest` page stays as it is, apart from the model fix in §6.

**Anti-goals (failure even if it "works")**
- Showing a dish or restaurant that isn't in Chakh's reviewed data.
- Search becoming slow or flaky. If the AI is down or slow, search must still answer (§5).
- Burning through the Gemini free tier with a call on every keystroke.

## 3. How it works

```
/search?q=...&city=...
   └─ runSearch
        ├─ AI path (new): load the city's reviewed dishes + notes ──► Gemini ──► dish ids + "Showing" labels
        │     └─ keep only ids that really exist in that city; order as Gemini returned them
        └─ if AI fails / times out / is disabled ──► today's keyword search, unchanged
```

1. **Candidate data.** Load every non-deleted, reviewed dish in the active city: id, name,
   restaurant, area, price tier, category, cuisine, diet, tastes, meals, score, Must-try, and the
   taste notes from its non-deleted reviews. Every query must include `.is('deleted_at', null)`.
   The data is small (tens to low hundreds of dishes per city), so it is sent whole, with no
   embeddings or vector DB.
2. **Ask Gemini** for strict JSON: the matching dish ids in best-first order (up to 10), a
   few short "Showing" labels (e.g. `Must-try or praised in reviews`, `Light`, `Sweet`), and the
   empty-state fields in §4. The prompt tells it: only use ids from the list, apply Vivek's
   definition of "best", and return no ids rather than weak matches.
3. **Validate.** Drop any id not in the candidate set. Map the rest to the existing `DishHit` shape
   and render with the existing `DishResultCard` (position numbers, score, Must-try badge).
4. **On our list** keeps working as today (viral entries, never ranked with rated dishes).
   Its matching can reuse the keyword filters, since AI matching of trending entries is out of scope.

### AI answers every search (Vivek's decision)

On `/search`, AI handles **every** query, including ones the keyword search already understands,
so results never depend on wording. Consequences, accepted:

- The grouped meal layout (Thali / by cuisine) and the City's Best board are no longer the
  answer to a normal query. "veg dinner" and "best food of town" become one ranked AI list. The
  board survives only as the last empty-state fallback (§4) and in the keyword safety net (§5).
- **Restaurant-name matches still show** below the dishes. That's the cheap existing DB lookup
  (as in `fetchFuzzy`'s restaurants), run in parallel with the AI call.
- Keyword search is **not** run on every request. It runs only as the fallback in §5.

### Candidate set and ordering (my calls)

- **"Reviewed dish"** = not soft-deleted, its restaurant not soft-deleted, and it has a `score`
  or at least one non-deleted review. Dishes with neither are never sent to the AI. Results
  that have reviews but no score still render "Not rated yet", as today.
- **Ordering:** the AI chooses *which* dishes fit (up to 10). Chakh then orders them by `score`
  descending, Must-try first on ties, unscored last, consistent with how search ranks today.
  The AI's own order is ignored, so position numbers always reflect Vivek's scores.
- **Filter chips** apply everywhere in the response: the AI results, "Closest we've tried",
  and the other-cities check. Chips are part of every cache key.

### Where AI runs (my call)

- **`/search` page: yes.** Pressing Enter in the hero, or landing on `/search?q=`, uses AI.
- **Hero dropdown: no.** It fires on each keystroke (180ms debounce in `HomeClient.tsx`), so it
  stays keyword-based for speed and quota. When the keyword preview finds nothing, the dropdown
  shows a line inviting Enter ("Press Enter and we'll find what fits") instead of a dead end.
- **Filter chips** (`diet`, `taste`, `meal` URL params) still apply as hard filters on the AI
  results, so the chips behave the same as today.

### Response shape

Extend `SearchResponse` with `kind: 'ai'`, the `showing: string[]` labels, and the
empty-state fields below. `headingFor` gets an `ai` case. The page renders `ranked` as today.

## 4. When nothing in the city fits (agreed order)

Example: "sushi" in Surat.

1. **Honest line:** "We haven't tasted sushi in Surat yet." Gemini supplies the short noun
   phrase ("sushi"). If it can't, fall back to the raw query.
2. **"Closest we've tried"**: up to 3 nearest reviewed dishes in this city, if the AI judges
   any reasonably close. Skip the section otherwise.
3. **Other cities**: "We've tried sushi in Vadodara", linking to `/search?q=…&city=vadodara`.
   This needs the other cities' dishes. Do it as a **second, cheaper call only when step 1
   happens**: send a compact list (name, category, cuisine, city) for the other Live cities and
   ask which cities have a good match.
4. **On our list** matches, shown as "Visiting soon" (existing component).
5. **City's Best board** when none of 2–4 produced anything, so there's never a dead end.

## 5. Reliability, speed, cost

- **Timeout:** around 6 seconds on the Gemini call. On a timeout, error, bad JSON or zero valid ids
  *when the keyword search would have found something*, use today's keyword result. A visitor
  should never see "unavailable" just because the AI failed.
- **Cache:** cache AI answers per (normalized query, city, chips) for a while (e.g. 1 hour, via
  `unstable_cache` or similar), so repeated popular queries are free and instant. Stale-by-an-hour
  is acceptable. Invalidating on dish edits is nice-to-have, not required.
- **Kill switch:** an env flag (e.g. `AI_SEARCH=off`) falls straight back to keyword search.
- **Loading:** `/search` is a server component, so either stream the AI section with
  `Suspense` and a loading state ("Finding what fits…") or accept the wait. That choice is left
  to the builder, but the user must never see a blank page for several seconds.
- **Server-only:** Gemini key and service-role access stay on the server. The query is user
  input, so it is passed as data in the prompt and never trusted as instructions. Keep the
  100-char cap `runSearch` already applies.

## 6. Model and SDK

`app/api/suggest/route.ts` uses `gemini-1.5-flash`, which Google has retired. Use a current
Gemini Flash model for AI search, defined once in a shared helper (e.g. `lib/ai/gemini.ts`)
holding the model id, JSON-mode call and timeout, and point `/suggest` at the same helper so it
is fixed too. Check whether `@google/generative-ai` should be replaced by Google's current
`@google/genai` SDK. Use JSON/structured output mode rather than stripping code fences.

This overlaps the separate "Fix AI Suggest" task card. If this ships first, that card is done.

## 7. Testing

- Unit tests (Vitest, `lib/**/*.test.ts`) for the pure parts: building the dish context,
  validating and mapping AI output (unknown ids dropped, order kept, chips applied), choosing
  fallbacks, and the empty-state assembly. Gemini is mocked.
- Manual check on the dev server against real data: "top class food", "best food of town",
  "something light after the gym", "kuch meetha khana hai", "veg dinner for family under budget",
  "sushi", and a nonsense query. Also check with `AI_SEARCH=off` and with a bad API key.

## 8. Decided vs. left to the builder

**Decided with Vivek:** AI understands any wording; results are only real reviewed dishes;
"best" = Must-try or praised in notes; show dishes only (no per-dish reason); keep the "Showing"
chips; the five-step empty state in §4, in that order; AI answers every `/search` query, not
only the ones keyword search can't handle.

**My calls (open to change):** Gemini rather than a new provider; AI only on `/search`, not the
keystroke dropdown; "reviewed" = has a score or a live review; AI picks the dishes, Chakh orders
them by score; chips apply to every section; restaurant-name matches kept below the dishes; scoped to the active city except the §4 other-cities step; up to 10
results; 1-hour cache; keyword search as the safety net; shared Gemini helper that also fixes
`/suggest`.

**Left to the builder:** exact prompt wording, the precise current model id, the caching mechanism,
Suspense vs. plain await, and the empty-state copy beyond the lines quoted above.
