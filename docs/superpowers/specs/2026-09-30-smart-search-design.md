# Smart Search — Design

**Date:** 2026-09-30
**Status:** Approved in brainstorming, pending spec review
**Builds on:** migration 007 (dish taxonomy), `lib/taxonomy.ts`, migration 006 (trending dishes)

## Goal

Search is the main feature of Chakh. A visitor types what they want in plain words —
"best cake", "dinner", "best food in town" — and gets Chakh's answer: dishes ranked by
Chakh's own score, plus the places Chakh is about to visit.

## Decisions

| Question | Decision |
|---|---|
| Who defines "best"? | Chakh's hand-set `dishes.score` (0–10). Nothing else ranks rated dishes. |
| Viral / unvisited places | Shown in a separate **"On our list · visiting soon"** section below rated results — never interleaved, never outranking a rated dish. Moves to the top when there are no rated results. These are places Chakh plans to visit. |
| Measuring virality | Hand-set buzz level 1–3 (🔥 / 🔥🔥 / 🔥🔥🔥). No scraped or copied view counts. |
| "best food in town" | **City's Best** board: the top-scored dish per category leaf. |
| "dinner" | Grouped sections (Thali, then by cuisine), top 3 per group. |
| Matching | Taxonomy tags + synonyms (existing) as backbone, plus `pg_trgm` for typos. |
| Architecture | Classify the query in code, render one of four layouts. |
| AI / RAG search | Out of scope now; the design leaves one fallback slot and a shared response shape so RAG can plug in later. |

## 1. Data changes

**Prerequisite:** apply migration `006_trending_dishes.sql` — it is written but has never
been run against the database.

**New migration `008_search_foundations.sql`:**

- `trending_dishes.buzz smallint NOT NULL DEFAULT 1 CHECK (buzz BETWEEN 1 AND 3)`
- `trending_dishes` gains `diet`, `category`, `cuisine`, `tastes`, `meals` with the **same
  types, defaults and CHECK constraints** as on `dishes` (migration 007), so a viral entry is
  found by the same filters as a dish.
- `CREATE EXTENSION IF NOT EXISTS pg_trgm;` and GIN trigram indexes on `dishes.name`,
  `trending_dishes.dish_name`, `restaurants.name`.
- `CREATE INDEX ... ON dishes (category, score DESC NULLS LAST) WHERE deleted_at IS NULL`.
- A Postgres function for fuzzy name search (PostgREST cannot express trigram
  `similarity()` ordering directly), returning dish/restaurant/trending ids with a similarity
  value, filtered by city and `deleted_at IS NULL`.

`dishes` is unchanged. The visited handover already exists: setting
`trending_dishes.visited_dish_id` removes an entry from "On our list".

**Future RAG:** add an `embedding` column to `dishes` and `trending_dishes`, built from name +
tags + taste notes. Nothing in 008 needs to change for that.

## 2. Search logic

### 2.1 Classification — `lib/search/classify.ts`

Pure function, no I/O: `classifyQuery(parsed: ParsedQuery): SearchKind`.

Before classifying, filler words are stripped from the leftover text: `best, top, good,
famous, popular, food, foods, in, the, town, city, place, places, eat, to, what, where,
near, me`.

| Kind | Rule | Examples |
|---|---|---|
| `broad` | No tags and no leftover text after filler removal | "best food in town", "best", "what to eat" |
| `meal` | `meals` present, no `categories` and no `cuisines` (diet/taste allowed as filters) | "dinner", "veg dinner", "spicy breakfast" |
| `specific` | Any of `categories`, `cuisines`, `tastes`, `diets` present | "best cake", "spicy veg curry", "south indian" |
| `text` | No tags recognised, leftover text remains | "nutella", "brwnie", "Theobroma" |

Precedence: `specific` > `meal` > `text` > `broad`. "dinner thali" is `specific`
(category thali); "veg dinner" is `meal` with a veg filter. A `specific` query with leftover
text (e.g. "nutella brownie") keeps the existing behaviour: tags AND name contains the text.

### 2.2 Fetching and ranking — `lib/search/fetch.ts`

One function per kind. All filter by city and `deleted_at IS NULL`.

- **specific → `ranked`**: dishes matching every present dimension (existing AND logic),
  ordered `score DESC NULLS LAST`, then `is_must_try DESC`, then `name`. Limit 30.
  Unrated dishes render after rated ones as "Not rated yet".
- **meal → `groups`**: dishes whose `meals` contains the searched meal (explicit tag only —
  `anytime` is not included), plus any diet/taste filters. Group key: `category = 'thali'`
  → group "Thali"; otherwise `cuisine`; null cuisine → "Other". Each group keeps its top 3
  by the same ordering as `ranked`. Groups are ordered by their best score (unrated groups
  last). Empty groups are not shown.
- **broad → `board`**: for each category leaf, the single highest-scored dish with a
  non-null score. Ordered by parent: main, snack, dessert, beverage (then tree order within
  a parent). Unrated dishes never appear on the board.
- **text → `ranked` + `restaurants`**: the fuzzy search function; ordered by similarity,
  then score.

**Every kind → `onOurList`**: `trending_dishes` with the same filters applied (for `text`,
fuzzy on `dish_name`/`place_name`; for `broad`, no filter), `visited_dish_id IS NULL`,
ordered `buzz DESC, rank ASC, created_at DESC`, limit 6.

### 2.3 Fallbacks

1. `specific` with zero dishes → rerun as `text` using the original query.
2. Still zero dishes → response has `empty: true` and a `board`, so the page shows
   "Nothing here yet" followed by City's Best.
3. **RAG slot (future):** unclassifiable / zero-result queries go to AI search instead of
   step 1. It returns the same response shape.

### 2.4 Response shape

```ts
type SearchResponse = {
  kind: 'specific' | 'meal' | 'broad' | 'text'
  filters: ParsedQuery          // what was understood — drives chips and headings
  ranked?: DishHit[]
  groups?: { key: string; label: string; dishes: DishHit[] }[]
  board?: { category: CategoryLeaf; label: string; dish: DishHit }[]
  onOurList: TrendingHit[]      // TrendingHit: id, dishName, placeName, area, why, sourceUrl, photoUrl, buzz
  restaurants: RestaurantHit[]
  empty?: boolean
}
```

`DishHit` and `RestaurantHit` keep their current definitions in `app/api/search/route.ts`
(moved to `lib/search/types.ts`).

`app/api/search/route.ts` becomes: parse → classify → fetch → return `SearchResponse`.

## 3. Results UI

### 3.1 Hero search (existing `HeroSearch` / `HomeClient`)

- The typing dropdown remains a preview: top 5 items plus a summary line
  ("Best cake · 6 dishes · 2 on our list").
- Enter, or a "See all" row, navigates to `/search?q=<query>&city=<slug>`.

### 3.2 `/search` page — `app/(public)/search/page.tsx`

Server component; calls the same `lib/search` functions directly (no HTTP round trip).
The URL is shareable and indexable.

| Kind | Layout |
|---|---|
| specific | Heading "Best cake in Pune"; numbered cards (#1, #2 …) with score badge, restaurant, area, price; unrated below a divider |
| meal | Heading "Dinner in Pune"; one section per group, 3 cards each |
| broad | Heading "Pune's Best"; grid of per-category winners labelled "Best Cake", "Best Biryani" … |
| text | "Results for '<q>'"; matching dishes, then restaurants |

All layouts end with **"On our list · visiting soon"** (cards with 🔥 buzz, why, "Seen on"
link), which moves to the top when there are no rated results.

**Filter chips** above the results: diet (Veg, Non-veg), taste (Sweet, Spicy …), meal
(Breakfast, Dinner …). Tapping one adds it to the query string and re-runs the search;
active chips come from `filters`.

Reuse `QualityBadge`, `TrendingCard` and the Spice Market palette. Visual detail is decided
during implementation.

## 4. Testing

- `classifyQuery`: table-driven test of ~25 real queries covering every kind, precedence
  ("dinner thali", "veg dinner"), filler stripping, and empty input.
- Group-key and board-selection logic tested as pure functions on fixture dishes.
- Browser verification of each kind against the live 12 tagged dishes, plus at least one
  tagged trending entry.

## Out of scope

- Admin tagging UI (tags + buzz on trending entries) — next spec; without it new dishes are
  unsearchable.
- "Flag untagged dishes" behaviour.
- Best/Nearby toggle (blocked: no coordinates / Maps key).
- RAG / AI search (slot reserved in §2.3).
- Committing the pending What's New work — to be committed separately, before this work.
