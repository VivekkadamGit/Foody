# Smart Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn plain-words searches ("best cake", "dinner", "best food in town", "brwnie") into Chakh's ranked answer — plus an "On our list · visiting soon" section of viral places Chakh plans to visit.

**Architecture:** `parseQuery` (existing) extracts taxonomy; a new pure `classifyQuery` picks one of four kinds (specific / meal / broad / text). Pure ranking functions order, group, or board the dishes; thin fetchers query Supabase; `runSearch` orchestrates and returns one `SearchResponse` shape consumed by both the API route (hero dropdown) and a new server-rendered `/search` page.

**Tech Stack:** Next.js 14 App Router, Supabase (Postgres + `pg_trgm`), TypeScript, Tailwind, Vitest (new, dev-only).

**Spec:** `docs/superpowers/specs/2026-09-30-smart-search-design.md`

## Global Constraints

- "Best" is defined only by `dishes.score` (0–10, hand-set). Nothing else ranks rated dishes.
- Ranking order everywhere: `score DESC NULLS LAST`, then `is_must_try` first, then `name` A–Z.
- Viral entries (`trending_dishes`) are never interleaved with dishes and never carry a score. Section title is exactly **"On our list · visiting soon"**; ordered `buzz DESC, rank ASC, created_at DESC`, max 6; only rows with `visited_dish_id IS NULL`.
- `buzz` is 1–3, rendered as 🔥 repeated `buzz` times.
- Meal search matches the explicit meal tag only — `anytime` is NOT included in "dinner".
- City's Best board shows only dishes with a non-null score.
- Every public query filters `deleted_at IS NULL` (CLAUDE.md rule).
- Never swallow a failed query: `console.error('[search] ...')` then degrade or throw (existing house rule, see `app/(public)/whats-new/page.tsx`).
- Migrations are run manually: `export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"` then `psql "$DATABASE_URL" -f <file>` with `DATABASE_URL` from `.env.local`.
- Do not run `npm run lint`: the repo has no ESLint config, so `next lint` starts an interactive setup. Use `npx tsc --noEmit` and `npm run build`.
- Colors: Spice Market palette via existing Tailwind tokens (`ember`, `ink`, `sand`, `charcoal`, `spice`, `muted`, `warm-*`).

## File Map

| File | Status | Responsibility |
|---|---|---|
| `supabase/migrations/008_search_foundations.sql` | create | buzz + tags on trending, pg_trgm, indexes, `search_fuzzy` function |
| `types/database.ts` | modify | `TrendingDish` gains `buzz` and tag fields |
| `lib/taxonomy.ts` | modify | extend `STOP_WORDS` with filler words |
| `lib/search/types.ts` | create | `SearchKind`, `DishHit`, `RestaurantHit`, `TrendingHit`, `DishGroup`, `BoardEntry`, `SearchResponse`, `ChipParams` |
| `lib/search/classify.ts` (+ `.test.ts`) | create | `classifyQuery` |
| `lib/search/rank.ts` (+ `.test.ts`) | create | `compareDishes`, `groupForMeal`, `pickBoard`, `BOARD_LABELS` |
| `lib/search/present.ts` (+ `.test.ts`) | create | chips, headings, dropdown preview |
| `lib/search/fetch.ts` | create | Supabase queries, one per kind |
| `lib/search/run.ts` | create | `runSearch` orchestration + fallbacks |
| `app/api/search/route.ts` | rewrite | thin wrapper over `runSearch` |
| `app/(public)/search/page.tsx` | create | server-rendered results page |
| `components/search/*.tsx` | create | `DishResultCard`, `FilterChips`, `OnOurList` |
| `components/whatsnew/TrendingCard.tsx` | modify | optional 🔥 buzz |
| `components/home/HomeClient.tsx` | modify | dropdown uses `SearchResponse`, Enter → `/search` |
| `vitest.config.ts`, `package.json` | create/modify | test runner |
| `CLAUDE.md` | modify | document search architecture |

---

### Task 0: Commit the pending What's New work

The What's New work (migration 006, `components/whatsnew/`, `app/(public)/whats-new/`, `app/actions/trending.ts`, `lib/cities.ts`, `Navbar.tsx`, `types/database.ts`) is uncommitted. This plan edits `TrendingCard.tsx` and `types/database.ts`, so commit that work first to keep the history readable.

- [ ] **Step 1: Confirm with the user** that the pending What's New files should be committed as-is on `advance-search`. Stop if they say no.

- [ ] **Step 2: Commit**

```bash
git add "app/(public)/whats-new" app/actions/trending.ts components/whatsnew lib/cities.ts supabase/migrations/006_trending_dishes.sql components/ui/Navbar.tsx types/database.ts
git commit -m "Add What's New page with a Trending Right Now column

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 1: Database — apply 006, write and apply 008

**Files:**
- Create: `supabase/migrations/008_search_foundations.sql`
- Modify: `types/database.ts` (the `TrendingDish` type, ~line 67)

**Interfaces:**
- Produces: `trending_dishes.buzz smallint` (1–3), `trending_dishes.{diet, category, cuisine, tastes, meals}` with the same values as `dishes`; SQL function `search_fuzzy(q text, city_slug text) RETURNS TABLE (hit_kind text, hit_id uuid, sim real)` where `hit_kind ∈ {'dish','restaurant','trending'}`.

- [ ] **Step 1: Apply migration 006** (never applied before)

```bash
export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"
export DATABASE_URL=$(grep '^DATABASE_URL=' .env.local | cut -d= -f2-)
psql "$DATABASE_URL" -f supabase/migrations/006_trending_dishes.sql
```

Expected: `CREATE TABLE`, `CREATE INDEX`, `ALTER TABLE`, `CREATE POLICY` lines, no `ERROR`.

- [ ] **Step 2: Write `supabase/migrations/008_search_foundations.sql`**

```sql
-- Migration 008: search foundations
--
-- 1. Viral entries ("On our list · visiting soon") get a hand-set buzz level and the
--    same taxonomy tags as dishes, so "cake" can find a viral cake place.
-- 2. pg_trgm for typo tolerance ("brwnie" -> "Brownie").
-- 3. search_fuzzy(): PostgREST cannot order by trigram similarity, so the fuzzy path
--    is one SQL function returning ids + similarity; the app loads the rows itself.

-- 1. Trending: buzz + tags ---------------------------------------------------------

ALTER TABLE trending_dishes
  ADD COLUMN IF NOT EXISTS buzz     smallint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS diet     text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS cuisine  text,
  ADD COLUMN IF NOT EXISTS tastes   text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS meals    text[] NOT NULL DEFAULT '{}';

ALTER TABLE trending_dishes DROP CONSTRAINT IF EXISTS trending_buzz_check;
ALTER TABLE trending_dishes ADD CONSTRAINT trending_buzz_check
  CHECK (buzz BETWEEN 1 AND 3);

-- Same vocabularies as dishes (migration 007). Keep the two lists in step.
ALTER TABLE trending_dishes DROP CONSTRAINT IF EXISTS trending_diet_check;
ALTER TABLE trending_dishes ADD CONSTRAINT trending_diet_check
  CHECK (diet IS NULL OR diet IN ('veg', 'non_veg', 'jain', 'egg'));

ALTER TABLE trending_dishes DROP CONSTRAINT IF EXISTS trending_category_check;
ALTER TABLE trending_dishes ADD CONSTRAINT trending_category_check
  CHECK (category IS NULL OR category IN (
    'baked', 'frozen', 'dessert_drink',
    'coffee', 'tea', 'shake', 'juice',
    'thali', 'curry', 'rice', 'bread', 'noodles',
    'roll', 'chaat', 'fried', 'sandwich'
  ));

ALTER TABLE trending_dishes DROP CONSTRAINT IF EXISTS trending_cuisine_check;
ALTER TABLE trending_dishes ADD CONSTRAINT trending_cuisine_check
  CHECK (cuisine IS NULL OR cuisine IN (
    'south_indian', 'north_indian', 'punjabi', 'mughlai', 'gujarati',
    'chinese', 'italian', 'continental', 'street_food'
  ));

ALTER TABLE trending_dishes DROP CONSTRAINT IF EXISTS trending_tastes_check;
ALTER TABLE trending_dishes ADD CONSTRAINT trending_tastes_check
  CHECK (tastes <@ ARRAY['sweet','spicy','tangy','savoury','rich','light','creamy','crispy']::text[]);

ALTER TABLE trending_dishes DROP CONSTRAINT IF EXISTS trending_meals_check;
ALTER TABLE trending_dishes ADD CONSTRAINT trending_meals_check
  CHECK (meals <@ ARRAY['breakfast','brunch','lunch','dinner','anytime']::text[]);

-- 2. Typo tolerance -----------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

CREATE INDEX IF NOT EXISTS idx_dishes_name_trgm
  ON dishes USING gin (name extensions.gin_trgm_ops) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_restaurants_name_trgm
  ON restaurants USING gin (name extensions.gin_trgm_ops) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_trending_dish_name_trgm
  ON trending_dishes USING gin (dish_name extensions.gin_trgm_ops) WHERE deleted_at IS NULL;

-- "best X" orders by score within a category.
CREATE INDEX IF NOT EXISTS idx_dishes_category_score
  ON dishes (category, score DESC NULLS LAST) WHERE deleted_at IS NULL;

-- 3. Fuzzy search -------------------------------------------------------------------

-- word_similarity, not similarity: "nutella" should match "Nutella Brownie" fully.
-- Threshold 0.4 lets one-letter typos through ("brwnie" ~ 0.7) without matching noise.
-- SECURITY INVOKER (the default), so RLS still applies to the caller.
CREATE OR REPLACE FUNCTION search_fuzzy(q text, city_slug text)
RETURNS TABLE (hit_kind text, hit_id uuid, sim real)
LANGUAGE sql STABLE
SET search_path = public, extensions
SET pg_trgm.word_similarity_threshold = 0.4
AS $$
  (SELECT 'dish'::text, d.id, word_similarity(q, d.name)
     FROM dishes d
     JOIN restaurants r ON r.id = d.restaurant_id
     JOIN cities c ON c.id = r.city_id
    WHERE c.slug = city_slug
      AND d.deleted_at IS NULL AND r.deleted_at IS NULL
      AND q <% d.name
    ORDER BY 3 DESC
    LIMIT 20)
  UNION ALL
  (SELECT 'restaurant'::text, r.id, word_similarity(q, r.name)
     FROM restaurants r
     JOIN cities c ON c.id = r.city_id
    WHERE c.slug = city_slug
      AND r.deleted_at IS NULL
      AND q <% r.name
    ORDER BY 3 DESC
    LIMIT 5)
  UNION ALL
  (SELECT 'trending'::text, t.id,
          GREATEST(word_similarity(q, t.dish_name), word_similarity(q, t.place_name))
     FROM trending_dishes t
     JOIN cities c ON c.id = t.city_id
    WHERE c.slug = city_slug
      AND t.deleted_at IS NULL AND t.visited_dish_id IS NULL
      AND (q <% t.dish_name OR q <% t.place_name)
    ORDER BY 3 DESC
    LIMIT 6)
$$;

GRANT EXECUTE ON FUNCTION search_fuzzy(text, text) TO anon, authenticated;
```

- [ ] **Step 3: Apply 008**

```bash
psql "$DATABASE_URL" -f supabase/migrations/008_search_foundations.sql
```

Expected: no `ERROR`. If `CREATE EXTENSION ... WITH SCHEMA extensions` fails because pg_trgm is already installed in another schema, run `psql "$DATABASE_URL" -c "select extnamespace::regnamespace from pg_extension where extname='pg_trgm'"` and replace `extensions.` / `extensions` in the migration with that schema name, then re-run.

- [ ] **Step 4: Verify fuzzy matching against real data**

```bash
psql "$DATABASE_URL" -c "select d.name, s.sim from search_fuzzy('brwnie', (select slug from cities where status is distinct from 'coming_soon' order by name limit 1)) s join dishes d on d.id = s.hit_id where s.hit_kind='dish';"
```

Expected: at least one row whose name contains "Brownie", `sim` ≥ 0.4. If the city picked has no brownies, repeat with the slug of the city that does (`select distinct c.slug from dishes d join restaurants r on r.id=d.restaurant_id join cities c on c.id=r.city_id where d.name ilike '%brownie%'`).

- [ ] **Step 5: Update `TrendingDish` in `types/database.ts`**

Replace the `TrendingDish` type with:

```ts
export type TrendingDish = {
  id: string
  dish_name: string
  place_name: string
  city_id: string
  restaurant_id: string | null
  area: string | null
  why: string
  source_url: string | null
  photo_url: string | null
  visited_dish_id: string | null
  rank: number
  /** Hand-set 1–3, rendered as 🔥. Orders "On our list". */
  buzz: number
  diet: string | null
  category: string | null
  cuisine: string | null
  tastes: string[]
  meals: string[]
  created_at: string
  deleted_at: string | null
}
```

- [ ] **Step 6: Type-check and commit**

Run: `npx tsc --noEmit`
Expected: exit 0.

```bash
git add supabase/migrations/008_search_foundations.sql types/database.ts
git commit -m "Give viral entries buzz and tags; add fuzzy search for typos

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Then remind the user: **Directus → Settings → Data Model → Reload** to pick up the new columns.

---

### Task 2: Test runner + search types + `classifyQuery`

**Files:**
- Modify: `package.json`, `lib/taxonomy.ts` (the `STOP_WORDS` line)
- Create: `vitest.config.ts`, `lib/search/types.ts`, `lib/search/classify.ts`, `lib/search/classify.test.ts`

**Interfaces:**
- Consumes: `parseQuery(raw: string): ParsedQuery` from `@/lib/taxonomy`.
- Produces: `classifyQuery(p: ParsedQuery): SearchKind`; all types in `lib/search/types.ts` (below) used by every later task.

- [ ] **Step 1: Install Vitest and add the script**

```bash
npm install --save-dev vitest@^2
npm pkg set scripts.test="vitest run"
```

- [ ] **Step 2: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('.', import.meta.url)) },
  },
  test: {
    include: ['lib/**/*.test.ts'],
  },
})
```

- [ ] **Step 3: Create `lib/search/types.ts`**

```ts
import type { CategoryLeaf, ParsedQuery } from '@/lib/taxonomy'

/** How a query is answered. See docs/superpowers/specs/2026-09-30-smart-search-design.md §2.1 */
export type SearchKind = 'specific' | 'meal' | 'broad' | 'text'

export type DishHit = {
  kind: 'dish'
  id: string
  name: string
  restaurantId: string
  restaurantName: string
  area: string | null
  priceSymbol: string
  /** null until it has been scored — shown as "Not rated yet" rather than hidden. */
  score: number | null
  isMustTry: boolean
  category: string | null
  cuisine: string | null
  /** Whether this came back on its name or on its tags. */
  matchedOn: 'name' | 'taxonomy'
}

export type RestaurantHit = {
  kind: 'restaurant'
  id: string
  name: string
  area: string | null
  priceSymbol: string
  dishCount: number
}

/** A viral place Chakh plans to visit. Never has a score. */
export type TrendingHit = {
  id: string
  dishName: string
  placeName: string
  area: string | null
  why: string
  sourceUrl: string | null
  photoUrl: string | null
  restaurantId: string | null
  buzz: number
}

export type DishGroup = { key: string; label: string; dishes: DishHit[] }

export type BoardEntry = { category: CategoryLeaf; label: string; dish: DishHit }

export type SearchResponse = {
  kind: SearchKind
  /** What was understood — drives chips and headings. */
  filters: ParsedQuery
  ranked?: DishHit[]
  groups?: DishGroup[]
  board?: BoardEntry[]
  onOurList: TrendingHit[]
  restaurants: RestaurantHit[]
  /** Nothing rated matched; `board` is included as a suggestion. */
  empty?: boolean
}

/** Filter chips carried as URL params on /search, on top of the typed query. */
export type ChipParams = { diet?: string; taste?: string; meal?: string }
```

- [ ] **Step 4: Write the failing test `lib/search/classify.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { parseQuery } from '@/lib/taxonomy'
import { classifyQuery } from './classify'

const kindOf = (q: string) => classifyQuery(parseQuery(q))

describe('classifyQuery', () => {
  it.each([
    // specific: a category, cuisine, taste or diet
    ['best cake', 'specific'],
    ['cake', 'specific'],
    ['nutella brownie', 'specific'],
    ['spicy veg curry', 'specific'],
    ['south indian', 'specific'],
    ['veg', 'specific'],
    ['spicy', 'specific'],
    ['ice cream', 'specific'],
    ['best biryani in town', 'specific'],
    // a category beats a meal
    ['dinner thali', 'specific'],
    // meal: meal tag, no category/cuisine (diet/taste are just filters)
    ['dinner', 'meal'],
    ['best dinner', 'meal'],
    ['veg dinner', 'meal'],
    ['spicy breakfast', 'meal'],
    ['supper', 'meal'],
    // broad: nothing left after filler words
    ['best food in town', 'broad'],
    ['best', 'broad'],
    ['what to eat', 'broad'],
    ['top places in city', 'broad'],
    ['famous food', 'broad'],
    ['', 'broad'],
    // text: no tags, words remain
    ['nutella', 'text'],
    ['brwnie', 'text'],
    ['theobroma', 'text'],
    ['best theobroma', 'text'],
  ])('%s -> %s', (q, expected) => {
    expect(kindOf(q)).toBe(expected)
  })

  it('keeps the non-filler word as text', () => {
    expect(parseQuery('best theobroma in town').text).toBe('theobroma')
  })
})
```

- [ ] **Step 5: Run it to verify it fails**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./classify"`.

- [ ] **Step 6: Extend `STOP_WORDS` in `lib/taxonomy.ts`**

Replace the `STOP_WORDS` line with:

```ts
const STOP_WORDS = new Set([
  'best', 'top', 'good', 'nice', 'famous', 'popular',
  'the', 'a', 'an', 'in', 'near', 'me', 'for', 'of', 'to',
  'food', 'foods', 'dish', 'dishes', 'place', 'places', 'town', 'city',
  'eat', 'what', 'where', 'something',
])
```

- [ ] **Step 7: Create `lib/search/classify.ts`**

```ts
import type { ParsedQuery } from '@/lib/taxonomy'
import type { SearchKind } from './types'

/**
 * Picks how a query is answered. Precedence: specific > meal > text > broad.
 *
 *   "best cake"          -> specific  (ranked list)
 *   "veg dinner"         -> meal      (grouped; veg is a filter inside the groups)
 *   "dinner thali"       -> specific  (a category beats a meal)
 *   "best food in town"  -> broad     (City's Best board)
 *   "brwnie"             -> text      (fuzzy name match)
 */
export function classifyQuery(p: ParsedQuery): SearchKind {
  if (p.categories.length > 0 || p.cuisines.length > 0) return 'specific'
  if (p.meals.length > 0) return 'meal'
  if (p.tastes.length > 0 || p.diets.length > 0) return 'specific'
  if (p.text) return 'text'
  return 'broad'
}
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `npm test`
Expected: 26 passed.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json vitest.config.ts lib/taxonomy.ts lib/search/types.ts lib/search/classify.ts lib/search/classify.test.ts
git commit -m "Classify a search as specific, meal, broad or text

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Ranking, meal groups and the City's Best board (pure)

**Files:**
- Create: `lib/search/rank.ts`, `lib/search/rank.test.ts`

**Interfaces:**
- Consumes: `DishHit`, `DishGroup`, `BoardEntry` from `./types`; `CATEGORY_TREE`, `CategoryLeaf`, `CategoryParent`, `labelFor` from `@/lib/taxonomy`.
- Produces: `compareDishes(a: DishHit, b: DishHit): number`, `groupForMeal(dishes: DishHit[]): DishGroup[]`, `pickBoard(dishes: DishHit[]): BoardEntry[]`, `GROUP_SIZE = 3`, `BOARD_LABELS: Record<CategoryLeaf, string>`.

- [ ] **Step 1: Write the failing test `lib/search/rank.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import type { DishHit } from './types'
import { compareDishes, groupForMeal, pickBoard } from './rank'

function dish(over: Partial<DishHit> & { id: string }): DishHit {
  return {
    kind: 'dish',
    name: over.id,
    restaurantId: 'r1',
    restaurantName: 'R',
    area: null,
    priceSymbol: '₹',
    score: null,
    isMustTry: false,
    category: null,
    cuisine: null,
    matchedOn: 'taxonomy',
    ...over,
  }
}

const ids = (ds: DishHit[]) => ds.map((d) => d.id)

describe('compareDishes', () => {
  it('orders by score desc, unrated last, must-try breaks ties, then name', () => {
    const list = [
      dish({ id: 'unrated' }),
      dish({ id: 'b-8', score: 8 }),
      dish({ id: 'a-8', score: 8 }),
      dish({ id: 'must-8', score: 8, isMustTry: true }),
      dish({ id: 'top-9', score: 9 }),
    ]
    expect(ids([...list].sort(compareDishes))).toEqual(['top-9', 'must-8', 'a-8', 'b-8', 'unrated'])
  })
})

describe('groupForMeal', () => {
  it('puts thali in its own group, groups the rest by cuisine, null cuisine as Other', () => {
    const groups = groupForMeal([
      dish({ id: 'gujarati-thali', category: 'thali', cuisine: 'gujarati', score: 7 }),
      dish({ id: 'paneer', category: 'curry', cuisine: 'north_indian', score: 9 }),
      dish({ id: 'dosa', category: 'fried', cuisine: 'south_indian', score: 6 }),
      dish({ id: 'mystery', category: 'curry', cuisine: null, score: 5 }),
    ])
    expect(groups.map((g) => [g.key, g.label])).toEqual([
      ['north_indian', 'North Indian'],
      ['thali', 'Thali'],
      ['south_indian', 'South Indian'],
      ['other', 'Other'],
    ])
  })

  it('keeps the top 3 per group and orders groups by their best dish, unrated groups last', () => {
    const groups = groupForMeal([
      dish({ id: 'c1', cuisine: 'chinese' }),
      dish({ id: 'n1', cuisine: 'north_indian', score: 6 }),
      dish({ id: 'n2', cuisine: 'north_indian', score: 9 }),
      dish({ id: 'n3', cuisine: 'north_indian', score: 7 }),
      dish({ id: 'n4', cuisine: 'north_indian', score: 8 }),
    ])
    expect(groups.map((g) => g.key)).toEqual(['north_indian', 'chinese'])
    expect(ids(groups[0].dishes)).toEqual(['n2', 'n4', 'n3'])
  })

  it('returns no groups for no dishes', () => {
    expect(groupForMeal([])).toEqual([])
  })
})

describe('pickBoard', () => {
  it('takes the top rated dish per category, in main/snack/dessert/beverage order', () => {
    const board = pickBoard([
      dish({ id: 'latte', category: 'coffee', score: 8 }),
      dish({ id: 'brownie', category: 'baked', score: 9 }),
      dish({ id: 'cheesecake', category: 'baked', score: 9.5 }),
      dish({ id: 'biryani', category: 'rice', score: 7 }),
      dish({ id: 'chaat', category: 'chaat', score: 6 }),
    ])
    expect(board.map((b) => [b.category, b.dish.id, b.label])).toEqual([
      ['rice', 'biryani', 'Best Biryani & Rice'],
      ['chaat', 'chaat', 'Best Chaat'],
      ['baked', 'cheesecake', 'Best Cakes & Bakes'],
      ['coffee', 'latte', 'Best Coffee'],
    ])
  })

  it('never puts an unrated dish on the board', () => {
    expect(pickBoard([dish({ id: 'x', category: 'baked', score: null })])).toEqual([])
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./rank"`.

- [ ] **Step 3: Create `lib/search/rank.ts`**

```ts
import { CATEGORY_TREE, labelFor, type CategoryLeaf, type CategoryParent } from '@/lib/taxonomy'
import type { BoardEntry, DishGroup, DishHit } from './types'

/** The one ordering used everywhere: score desc (unrated last), must-try, then name. */
export function compareDishes(a: DishHit, b: DishHit): number {
  if (a.score === null && b.score !== null) return 1
  if (b.score === null && a.score !== null) return -1
  if (a.score !== null && b.score !== null && a.score !== b.score) return b.score - a.score
  if (a.isMustTry !== b.isMustTry) return a.isMustTry ? -1 : 1
  return a.name.localeCompare(b.name)
}

export const GROUP_SIZE = 3

/** Thali is how people think about dinner, so it gets its own group; the rest go by cuisine. */
function groupKeyOf(d: DishHit): string {
  if (d.category === 'thali') return 'thali'
  return d.cuisine ?? 'other'
}

function groupLabel(key: string): string {
  return key === 'other' ? 'Other' : labelFor(key)
}

/** "dinner" -> Thali / North Indian / South Indian …, top 3 each, strongest group first. */
export function groupForMeal(dishes: DishHit[]): DishGroup[] {
  const byKey = new Map<string, DishHit[]>()
  for (const d of dishes) {
    const key = groupKeyOf(d)
    byKey.set(key, [...(byKey.get(key) ?? []), d])
  }

  return Array.from(byKey, ([key, ds]) => ({
    key,
    label: groupLabel(key),
    dishes: [...ds].sort(compareDishes).slice(0, GROUP_SIZE),
  })).sort((a, b) => compareDishes(a.dishes[0], b.dishes[0]))
}

const BOARD_PARENT_ORDER: CategoryParent[] = ['main', 'snack', 'dessert', 'beverage']

/** Readable names for the board — "Best Baked" reads badly. */
export const BOARD_LABELS: Record<CategoryLeaf, string> = {
  baked: 'Cakes & Bakes',
  frozen: 'Ice Cream',
  dessert_drink: 'Dessert Drink',
  coffee: 'Coffee',
  tea: 'Chai',
  shake: 'Shake',
  juice: 'Juice',
  thali: 'Thali',
  curry: 'Curry',
  rice: 'Biryani & Rice',
  bread: 'Breads',
  noodles: 'Noodles',
  roll: 'Rolls',
  chaat: 'Chaat',
  fried: 'Fried Snacks',
  sandwich: 'Sandwich',
}

/** "best food in town" -> the single top-rated dish per category. Unrated never qualifies. */
export function pickBoard(dishes: DishHit[]): BoardEntry[] {
  const board: BoardEntry[] = []
  for (const parent of BOARD_PARENT_ORDER) {
    for (const leaf of CATEGORY_TREE[parent] as readonly CategoryLeaf[]) {
      const best = dishes
        .filter((d) => d.category === leaf && d.score !== null)
        .sort(compareDishes)[0]
      if (best) board.push({ category: leaf, label: `Best ${BOARD_LABELS[leaf]}`, dish: best })
    }
  }
  return board
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all pass (classify + rank).

- [ ] **Step 5: Commit**

```bash
git add lib/search/rank.ts lib/search/rank.test.ts
git commit -m "Rank dishes by score, group dinner by kind, pick a City's Best board

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Chips, headings and dropdown preview (pure)

**Files:**
- Create: `lib/search/present.ts`, `lib/search/present.test.ts`

**Interfaces:**
- Consumes: `ParsedQuery`, `DIETS`, `TASTES`, `MEALS`, `labelFor` from `@/lib/taxonomy`; `ChipParams`, `SearchResponse`, `DishHit` from `./types`.
- Produces:
  - `CHIPS: Chip[]` where `type Chip = { dim: 'diet' | 'taste' | 'meal'; value: string; label: string }`
  - `applyChips(p: ParsedQuery, c: ChipParams): ParsedQuery`
  - `chipState(typed: ParsedQuery, c: ChipParams, chip: Chip): 'off' | 'param' | 'typed'`
  - `chipHref(q: string, city: string, c: ChipParams, chip: Chip): string`
  - `headingFor(res: SearchResponse, q: string, cityName: string): string`
  - `previewDishes(res: SearchResponse, limit?: number): DishHit[]`
  - `summaryLine(res: SearchResponse): string`

- [ ] **Step 1: Write the failing test `lib/search/present.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { parseQuery } from '@/lib/taxonomy'
import type { DishHit, SearchResponse } from './types'
import { CHIPS, applyChips, chipHref, chipState, headingFor, previewDishes, summaryLine } from './present'

const chip = (value: string) => CHIPS.find((c) => c.value === value)!

function dish(id: string): DishHit {
  return {
    kind: 'dish', id, name: id, restaurantId: 'r', restaurantName: 'R', area: null,
    priceSymbol: '₹', score: 8, isMustTry: false, category: null, cuisine: null, matchedOn: 'taxonomy',
  }
}

function response(over: Partial<SearchResponse>): SearchResponse {
  return { kind: 'specific', filters: parseQuery(''), onOurList: [], restaurants: [], ...over }
}

describe('applyChips', () => {
  it('adds valid chip values without duplicating typed ones', () => {
    const p = applyChips(parseQuery('veg cake'), { diet: 'veg', meal: 'dinner' })
    expect(p.diets).toEqual(['veg'])
    expect(p.meals).toEqual(['dinner'])
    expect(p.categories).toEqual(['baked'])
  })

  it('ignores values outside the vocabulary', () => {
    const p = applyChips(parseQuery('cake'), { diet: 'carnivore', taste: 'umami' })
    expect(p.diets).toEqual([])
    expect(p.tastes).toEqual([])
  })
})

describe('chipState', () => {
  it('distinguishes typed, param and off', () => {
    const typed = parseQuery('veg cake')
    expect(chipState(typed, {}, chip('veg'))).toBe('typed')
    expect(chipState(typed, { taste: 'sweet' }, chip('sweet'))).toBe('param')
    expect(chipState(typed, {}, chip('spicy'))).toBe('off')
  })
})

describe('chipHref', () => {
  it('turns a chip on, keeping the query and city', () => {
    expect(chipHref('best cake', 'surat', {}, chip('veg'))).toBe('/search?q=best+cake&city=surat&diet=veg')
  })
  it('turns an active chip off', () => {
    expect(chipHref('best cake', 'surat', { diet: 'veg' }, chip('veg'))).toBe('/search?q=best+cake&city=surat')
  })
  it('replaces another value in the same dimension', () => {
    expect(chipHref('cake', 'surat', { taste: 'sweet' }, chip('spicy'))).toBe('/search?q=cake&city=surat&taste=spicy')
  })
})

describe('headingFor', () => {
  it('names each kind', () => {
    expect(headingFor(response({ kind: 'specific' }), 'best cake', 'Surat')).toBe('Best cake in Surat')
    expect(headingFor(response({ kind: 'specific' }), '', 'Surat')).toBe('Top picks in Surat')
    expect(headingFor(response({ kind: 'meal', filters: parseQuery('veg dinner') }), 'veg dinner', 'Surat')).toBe('Veg Dinner in Surat')
    expect(headingFor(response({ kind: 'broad' }), 'best food in town', 'Surat')).toBe("Surat's Best")
    expect(headingFor(response({ kind: 'text' }), 'brwnie', 'Surat')).toBe('Results for “brwnie”')
  })
})

describe('previewDishes / summaryLine', () => {
  it('flattens whichever layout came back', () => {
    expect(previewDishes(response({ ranked: [dish('a'), dish('b')] })).map((d) => d.id)).toEqual(['a', 'b'])
    expect(
      previewDishes(response({ kind: 'meal', groups: [{ key: 'x', label: 'X', dishes: [dish('a')] }, { key: 'y', label: 'Y', dishes: [dish('b')] }] })).map((d) => d.id)
    ).toEqual(['a', 'b'])
    expect(
      previewDishes(response({ kind: 'broad', board: [{ category: 'baked', label: 'Best Cakes & Bakes', dish: dish('a') }] })).map((d) => d.id)
    ).toEqual(['a'])
  })

  it('caps the preview at 5', () => {
    const many = ['a', 'b', 'c', 'd', 'e', 'f'].map(dish)
    expect(previewDishes(response({ ranked: many }))).toHaveLength(5)
  })

  it('does not preview the suggestion board of an empty result', () => {
    expect(previewDishes(response({ empty: true, ranked: [], board: [{ category: 'baked', label: 'x', dish: dish('a') }] }))).toEqual([])
  })

  it('summarises counts', () => {
    const trend = { id: 't', dishName: 'd', placeName: 'p', area: null, why: 'w', sourceUrl: null, photoUrl: null, restaurantId: null, buzz: 2 }
    expect(summaryLine(response({ ranked: [dish('a'), dish('b')], onOurList: [trend] }))).toBe('2 dishes · 1 on our list')
    expect(summaryLine(response({ ranked: [dish('a')] }))).toBe('1 dish')
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./present"`.

- [ ] **Step 3: Create `lib/search/present.ts`**

```ts
import { DIETS, MEALS, TASTES, labelFor, type Diet, type Meal, type ParsedQuery, type Taste } from '@/lib/taxonomy'
import type { ChipParams, DishHit, SearchResponse } from './types'

export type Chip = { dim: 'diet' | 'taste' | 'meal'; value: string; label: string }

export const CHIPS: Chip[] = [
  { dim: 'diet', value: 'veg', label: 'Veg' },
  { dim: 'diet', value: 'non_veg', label: 'Non-veg' },
  { dim: 'taste', value: 'sweet', label: 'Sweet' },
  { dim: 'taste', value: 'spicy', label: 'Spicy' },
  { dim: 'taste', value: 'tangy', label: 'Tangy' },
  { dim: 'meal', value: 'breakfast', label: 'Breakfast' },
  { dim: 'meal', value: 'lunch', label: 'Lunch' },
  { dim: 'meal', value: 'dinner', label: 'Dinner' },
]

function addIfValid<T extends string>(list: T[], vocab: readonly T[], value: string | undefined): T[] {
  if (!value || !(vocab as readonly string[]).includes(value) || list.includes(value as T)) return list
  return [...list, value as T]
}

/** Chips are URL params layered on top of what was typed. Unknown values are dropped. */
export function applyChips(p: ParsedQuery, c: ChipParams): ParsedQuery {
  return {
    ...p,
    diets: addIfValid<Diet>(p.diets, DIETS, c.diet),
    tastes: addIfValid<Taste>(p.tastes, TASTES, c.taste),
    meals: addIfValid<Meal>(p.meals, MEALS, c.meal),
  }
}

function typedValues(p: ParsedQuery, dim: Chip['dim']): string[] {
  return dim === 'diet' ? p.diets : dim === 'taste' ? p.tastes : p.meals
}

/** 'typed' chips came from the search words and can't be toggled off by the chip. */
export function chipState(typed: ParsedQuery, c: ChipParams, chip: Chip): 'off' | 'param' | 'typed' {
  if (typedValues(typed, chip.dim).includes(chip.value)) return 'typed'
  return c[chip.dim] === chip.value ? 'param' : 'off'
}

/** One value per dimension: tapping a chip sets it, tapping it again clears it. */
export function chipHref(q: string, city: string, c: ChipParams, chip: Chip): string {
  const next: ChipParams = { ...c, [chip.dim]: c[chip.dim] === chip.value ? undefined : chip.value }
  const params = new URLSearchParams()
  if (q) params.set('q', q)
  params.set('city', city)
  for (const dim of ['diet', 'taste', 'meal'] as const) {
    const v = next[dim]
    if (v) params.set(dim, v)
  }
  return `/search?${params.toString()}`
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function headingFor(res: SearchResponse, q: string, cityName: string): string {
  const typed = q.trim()
  switch (res.kind) {
    case 'broad':
      return `${cityName}'s Best`
    case 'text':
      return `Results for “${typed}”`
    case 'meal': {
      const f = res.filters
      return `${[...f.diets, ...f.tastes, f.meals[0]].map(labelFor).join(' ')} in ${cityName}`
    }
    case 'specific':
      return typed ? `${capitalize(typed)} in ${cityName}` : `Top picks in ${cityName}`
  }
}

/** The hero dropdown shows a flat preview of whichever layout came back. */
export function previewDishes(res: SearchResponse, limit = 5): DishHit[] {
  if (res.empty) return []
  const all =
    res.ranked ??
    res.groups?.flatMap((g) => g.dishes) ??
    res.board?.map((b) => b.dish) ??
    []
  return all.slice(0, limit)
}

function countDishes(res: SearchResponse): number {
  if (res.empty) return 0
  return res.ranked?.length ?? res.groups?.reduce((n, g) => n + g.dishes.length, 0) ?? res.board?.length ?? 0
}

export function summaryLine(res: SearchResponse): string {
  const n = countDishes(res)
  const parts = [`${n} ${n === 1 ? 'dish' : 'dishes'}`]
  if (res.onOurList.length > 0) parts.push(`${res.onOurList.length} on our list`)
  return parts.join(' · ')
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add lib/search/present.ts lib/search/present.test.ts
git commit -m "Add filter chips, headings and dropdown preview for search results

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Fetchers, `runSearch` and the API route

**Files:**
- Create: `lib/search/fetch.ts`, `lib/search/run.ts`
- Rewrite: `app/api/search/route.ts`

**Interfaces:**
- Consumes: everything from Tasks 1–4; `search_fuzzy` SQL function; `priceTierSymbol` from `@/lib/dishScore`.
- Produces: `runSearch(sb: SupabaseClient, q: string, city: string, chips?: ChipParams): Promise<SearchResponse>` — throws on dish/restaurant query failure; `onOurList` failures degrade to `[]`. Route `GET /api/search?q=&city=` returns `SearchResponse` (or `{ error: 'search_failed' }` with 500). The route's old exported types `DishHit`, `RestaurantHit`, `SearchResults` are removed; importers switch to `@/lib/search/types` (Task 7 updates `HomeClient`).

- [ ] **Step 1: Create `lib/search/fetch.ts`**

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ParsedQuery } from '@/lib/taxonomy'
import { priceTierSymbol } from '@/lib/dishScore'
import { compareDishes, groupForMeal, pickBoard } from './rank'
import type { BoardEntry, DishGroup, DishHit, RestaurantHit, TrendingHit } from './types'

const DISH_SELECT = `id, name, score, is_must_try, category, cuisine,
  restaurants!inner(id, name, address, price_range, cities!inner(slug))`

const TRENDING_SELECT = `id, dish_name, place_name, area, why, source_url, photo_url,
  restaurant_id, buzz, cities!inner(slug)`

const ON_OUR_LIST_LIMIT = 6

/** `%` and `_` are ILIKE wildcards — escape them so a literal query stays literal. */
function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, (ch) => `\\${ch}`)
}

function areaOf(address: string | null | undefined): string | null {
  return address ? String(address).split(',')[0].trim() : null
}

function toDishHit(d: any, matchedOn: DishHit['matchedOn']): DishHit {
  return {
    kind: 'dish',
    matchedOn,
    id: d.id,
    name: d.name,
    restaurantId: d.restaurants.id,
    restaurantName: d.restaurants.name,
    area: areaOf(d.restaurants.address),
    priceSymbol: priceTierSymbol(d.restaurants.price_range),
    score: d.score === null || d.score === undefined ? null : Number(d.score),
    isMustTry: !!d.is_must_try,
    category: d.category ?? null,
    cuisine: d.cuisine ?? null,
  }
}

function toTrendingHit(t: any): TrendingHit {
  return {
    id: t.id,
    dishName: t.dish_name,
    placeName: t.place_name,
    area: t.area,
    why: t.why,
    sourceUrl: t.source_url,
    photoUrl: t.photo_url,
    restaurantId: t.restaurant_id,
    buzz: t.buzz ?? 1,
  }
}

/**
 * Every taxonomy dimension present must hold (AND), so "spicy veg curry" narrows.
 * Leftover words must appear in the name: "nutella brownie" -> baked + "nutella".
 * Shared by dishes and trending so both answer the same query the same way.
 */
function withFilters(query: any, f: ParsedQuery, nameColumn: string): any {
  if (f.categories.length) query = query.in('category', f.categories)
  if (f.diets.length) query = query.in('diet', f.diets)
  if (f.cuisines.length) query = query.in('cuisine', f.cuisines)
  if (f.tastes.length) query = query.overlaps('tastes', f.tastes)
  if (f.meals.length) query = query.overlaps('meals', f.meals)
  if (f.text) query = query.ilike(nameColumn, `%${escapeLike(f.text)}%`)
  return query
}

function dishesInCity(sb: SupabaseClient, city: string) {
  return sb
    .from('dishes')
    .select(DISH_SELECT)
    .eq('restaurants.cities.slug', city)
    .is('deleted_at', null)
    .is('restaurants.deleted_at', null)
}

function fail(what: string, message: string): never {
  console.error(`[search] ${what} failed:`, message)
  throw new Error(`${what} failed`)
}

/** specific: tag-matched dishes, best first. */
export async function fetchSpecific(sb: SupabaseClient, city: string, f: ParsedQuery): Promise<DishHit[]> {
  const { data, error } = await withFilters(dishesInCity(sb, city), f, 'name')
    .order('score', { ascending: false, nullsFirst: false })
    .limit(30)
  if (error) fail('specific query', error.message)
  return (data ?? []).map((d: any) => toDishHit(d, 'taxonomy')).sort(compareDishes)
}

/** meal: dishes tagged with the meal, grouped Thali / by cuisine. */
export async function fetchMeal(sb: SupabaseClient, city: string, f: ParsedQuery): Promise<DishGroup[]> {
  const { data, error } = await withFilters(dishesInCity(sb, city), f, 'name').limit(300)
  if (error) fail('meal query', error.message)
  return groupForMeal((data ?? []).map((d: any) => toDishHit(d, 'taxonomy')))
}

/** broad: top rated dish per category. */
export async function fetchBoard(sb: SupabaseClient, city: string): Promise<BoardEntry[]> {
  const { data, error } = await dishesInCity(sb, city)
    .not('score', 'is', null)
    .not('category', 'is', null)
    .limit(1000)
  if (error) fail('board query', error.message)
  return pickBoard((data ?? []).map((d: any) => toDishHit(d, 'taxonomy')))
}

/** text: typo-tolerant name match across dishes, restaurants and viral entries. */
export async function fetchFuzzy(
  sb: SupabaseClient,
  city: string,
  text: string
): Promise<{ dishes: DishHit[]; restaurants: RestaurantHit[]; trending: TrendingHit[] }> {
  const { data: hits, error } = await sb.rpc('search_fuzzy', { q: text, city_slug: city })
  if (error) fail('fuzzy search', error.message)

  const simOf = new Map<string, number>()
  const idsOf = (kind: string) =>
    (hits ?? []).filter((h: any) => h.hit_kind === kind).map((h: any) => {
      simOf.set(h.hit_id, Number(h.sim))
      return h.hit_id as string
    })
  const dishIds = idsOf('dish')
  const restaurantIds = idsOf('restaurant')
  const trendingIds = idsOf('trending')

  const none = Promise.resolve({ data: [] as any[], error: null })
  const [dishRes, restRes, trendRes] = await Promise.all([
    dishIds.length ? sb.from('dishes').select(DISH_SELECT).in('id', dishIds) : none,
    restaurantIds.length
      ? sb.from('restaurants').select('id, name, address, price_range, dishes(id)')
          .in('id', restaurantIds).is('dishes.deleted_at', null)
      : none,
    trendingIds.length ? sb.from('trending_dishes').select(TRENDING_SELECT).in('id', trendingIds) : none,
  ])
  if (dishRes.error) fail('fuzzy dishes', dishRes.error.message)
  if (restRes.error) fail('fuzzy restaurants', restRes.error.message)
  if (trendRes.error) console.error('[search] fuzzy trending failed:', trendRes.error.message)

  const bySim = (a: { id: string }, b: { id: string }) => (simOf.get(b.id) ?? 0) - (simOf.get(a.id) ?? 0)

  const dishes = (dishRes.data ?? [])
    .map((d: any) => toDishHit(d, 'name'))
    .sort((a: DishHit, b: DishHit) => bySim(a, b) || compareDishes(a, b))

  const restaurants: RestaurantHit[] = (restRes.data ?? [])
    .map((r: any) => ({
      kind: 'restaurant' as const,
      id: r.id,
      name: r.name,
      area: areaOf(r.address),
      priceSymbol: priceTierSymbol(r.price_range),
      dishCount: (r.dishes ?? []).length,
    }))
    .sort(bySim)

  const trending = trendRes.error ? [] : (trendRes.data ?? []).map(toTrendingHit).sort(bySim)

  return { dishes, restaurants, trending }
}

/**
 * "On our list · visiting soon": viral places we plan to visit, same filters as the
 * dishes (null = no filter, for the broad board). A failure here must not take search
 * down — it degrades to an empty section.
 */
export async function fetchOnOurList(
  sb: SupabaseClient,
  city: string,
  f: ParsedQuery | null
): Promise<TrendingHit[]> {
  let query = sb
    .from('trending_dishes')
    .select(TRENDING_SELECT)
    .eq('cities.slug', city)
    .is('deleted_at', null)
    .is('visited_dish_id', null)
  if (f) query = withFilters(query, f, 'dish_name')

  const { data, error } = await query
    .order('buzz', { ascending: false })
    .order('rank', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(ON_OUR_LIST_LIMIT)

  if (error) {
    console.error('[search] on-our-list query failed:', error.message)
    return []
  }
  return (data ?? []).map(toTrendingHit)
}
```

- [ ] **Step 2: Create `lib/search/run.ts`**

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { parseQuery } from '@/lib/taxonomy'
import { classifyQuery } from './classify'
import { applyChips } from './present'
import { fetchBoard, fetchFuzzy, fetchMeal, fetchOnOurList, fetchSpecific } from './fetch'
import type { ChipParams, SearchResponse } from './types'

/**
 * The single entry point for search. Both the API route (hero dropdown) and the
 * /search page call this, so they can never disagree.
 *
 * Fallbacks (spec §2.3) — there is never a dead end:
 *   specific with no dishes -> retry as text -> still nothing -> empty + City's Best.
 * FUTURE (RAG): queries that end up `empty` are where AI search plugs in, returning
 * this same SearchResponse shape.
 */
export async function runSearch(
  sb: SupabaseClient,
  q: string,
  city: string,
  chips: ChipParams = {}
): Promise<SearchResponse> {
  const filters = applyChips(parseQuery(q), chips)
  const kind = classifyQuery(filters)

  if (kind === 'broad') {
    const [board, onOurList] = await Promise.all([fetchBoard(sb, city), fetchOnOurList(sb, city, null)])
    return { kind, filters, board, onOurList, restaurants: [] }
  }

  if (kind === 'meal') {
    const [groups, onOurList] = await Promise.all([fetchMeal(sb, city, filters), fetchOnOurList(sb, city, filters)])
    if (groups.length > 0) return { kind, filters, groups, onOurList, restaurants: [] }
    return { kind, filters, groups, onOurList, restaurants: [], empty: true, board: await fetchBoard(sb, city) }
  }

  if (kind === 'text') {
    const fuzzy = await fetchFuzzy(sb, city, filters.text || q)
    const base = { kind, filters, ranked: fuzzy.dishes, onOurList: fuzzy.trending, restaurants: fuzzy.restaurants }
    if (fuzzy.dishes.length > 0) return base
    return { ...base, empty: true, board: await fetchBoard(sb, city) }
  }

  // specific
  const [ranked, onOurList] = await Promise.all([
    fetchSpecific(sb, city, filters),
    fetchOnOurList(sb, city, filters),
  ])
  if (ranked.length > 0) return { kind, filters, ranked, onOurList, restaurants: [] }

  // Tags matched nothing rated — maybe the words are in a name ("cake" in "Cake Walk").
  const fuzzy = await fetchFuzzy(sb, city, q)
  const list = onOurList.length > 0 ? onOurList : fuzzy.trending
  if (fuzzy.dishes.length > 0) {
    return { kind: 'text', filters, ranked: fuzzy.dishes, onOurList: list, restaurants: fuzzy.restaurants }
  }
  return {
    kind, filters, ranked: [], onOurList: list, restaurants: fuzzy.restaurants,
    empty: true, board: await fetchBoard(sb, city),
  }
}
```

- [ ] **Step 3: Rewrite `app/api/search/route.ts`**

```ts
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
  } catch {
    // runSearch already logged the underlying error.
    return NextResponse.json({ error: 'search_failed' }, { status: 500 })
  }
}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: errors ONLY in `components/home/HomeClient.tsx` (it imports `SearchResults` from the old route). Anything else must be fixed now. HomeClient is fixed in Task 7.

- [ ] **Step 5: Exercise every kind against the real database**

Start the dev server with `preview_start` (add a `.claude/launch.json` entry `{"name":"next","runtimeExecutable":"npm","runtimeArgs":["run","dev"],"port":3000}` if none exists). Find a live city slug with `psql "$DATABASE_URL" -c "select slug from cities where status is distinct from 'coming_soon'"`, then in the browser pane run via `javascript_tool`:

```js
const city = '<slug>'
const qs = ['best cake', 'dinner', 'best food in town', 'brwnie', 'zzzz']
Object.fromEntries(await Promise.all(qs.map(async q => {
  const r = await (await fetch(`/api/search?q=${encodeURIComponent(q)}&city=${city}`)).json()
  return [q, { kind: r.kind, empty: !!r.empty,
    ranked: r.ranked?.map(d => `${d.name} ${d.score}`),
    groups: r.groups?.map(g => `${g.label}:${g.dishes.length}`),
    board: r.board?.map(b => `${b.label}=${b.dish.name}`) }]
})))
```

Expected:
- `best cake` → `kind: 'specific'`, brownies/cake/cheesecake/cookie sandwich, scores descending, unrated last, no ice cream/sundae/frappe.
- `dinner` → `kind: 'meal'` with groups (or `empty: true` + board if no dish is tagged dinner — check with `select name, meals from dishes where 'dinner' = any(meals)`).
- `best food in town` → `kind: 'broad'`, board entries each with a scored dish.
- `brwnie` → `kind: 'text'`, brownies ranked.
- `zzzz` → `empty: true`, board present.

- [ ] **Step 6: Commit**

```bash
git add lib/search/fetch.ts lib/search/run.ts app/api/search/route.ts
git commit -m "Answer each kind of search from the database, with fallbacks

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

(HomeClient is still broken for `tsc` at this commit; Task 7 fixes it. If the reviewer objects, squash Tasks 5 and 7 at the end.)

---

### Task 6: `/search` results page

**Files:**
- Create: `app/(public)/search/page.tsx`, `components/search/DishResultCard.tsx`, `components/search/FilterChips.tsx`, `components/search/OnOurList.tsx`
- Modify: `components/whatsnew/TrendingCard.tsx`

**Interfaces:**
- Consumes: `runSearch`, `headingFor`, `CHIPS`, `chipState`, `chipHref`, `parseQuery`, `CITY_PRIORITY`, `TrendingCard` / `TrendingEntry`, `QualityBadge`.
- Produces: route `/search?q=&city=&diet=&taste=&meal=`.

Before writing UI, invoke the `frontend-design:frontend-design` skill for visual direction, staying within the Spice Market palette and existing Tailwind tokens. The code below is the functional baseline; styling may be refined, structure may not.

- [ ] **Step 1: Add optional buzz to `TrendingCard`**

In `components/whatsnew/TrendingCard.tsx`, change the `TrendingEntry` type's intersection to:

```ts
> & { citySlug: string; buzz?: number }
```

and inside the `flex flex-wrap` row, immediately before the `🌱 NOT TASTED YET` span, add:

```tsx
          {entry.buzz ? (
            <span className="font-body text-xs" aria-label={`Buzz ${entry.buzz} of 3`}>
              {'🔥'.repeat(entry.buzz)}
            </span>
          ) : null}
```

- [ ] **Step 2: Create `components/search/DishResultCard.tsx`**

```tsx
import Link from 'next/link'
import QualityBadge from '@/components/home/QualityBadge'
import type { DishHit } from '@/lib/search/types'

export default function DishResultCard({
  dish,
  citySlug,
  position,
  eyebrow,
}: {
  dish: DishHit
  citySlug: string
  /** #1, #2 … on ranked lists only. */
  position?: number
  /** e.g. "Best Cakes & Bakes" on the City's Best board. */
  eyebrow?: string
}) {
  return (
    <Link
      href={`/${citySlug}/${dish.restaurantId}`}
      className="flex items-center gap-4 rounded-2xl border border-warm-200 bg-white p-4 hover:border-ember/50 transition-colors"
    >
      {position !== undefined && (
        <span className="font-barlow text-3xl font-bold text-ember w-10 text-center flex-shrink-0">#{position}</span>
      )}
      <div className="min-w-0 flex-1">
        {eyebrow && (
          <p className="font-anek text-[10px] font-bold uppercase tracking-[0.15em] text-ember m-0">{eyebrow}</p>
        )}
        <p className="font-anek text-[16px] font-semibold text-[#1c1611] truncate m-0">{dish.name}</p>
        <p className="font-anek text-[13px] text-sand-dark truncate m-0">
          {dish.restaurantName}
          {dish.area ? `, ${dish.area}` : ''} · {dish.priceSymbol}
        </p>
      </div>
      <div className="flex items-center gap-2.5 flex-shrink-0">
        {dish.score === null ? (
          <span className="font-anek text-[11px] text-[#a09a90] whitespace-nowrap">Not rated yet</span>
        ) : (
          <>
            <QualityBadge score={dish.score} isMustTry={dish.isMustTry} size="sm" dark={false} />
            <span className="font-barlow text-2xl font-bold text-[#1c1611]">{dish.score.toFixed(1)}</span>
          </>
        )}
      </div>
    </Link>
  )
}
```

- [ ] **Step 3: Create `components/search/FilterChips.tsx`**

```tsx
import Link from 'next/link'
import type { ParsedQuery } from '@/lib/taxonomy'
import { CHIPS, chipHref, chipState } from '@/lib/search/present'
import type { ChipParams } from '@/lib/search/types'

export default function FilterChips({
  q,
  city,
  typed,
  chips,
}: {
  q: string
  city: string
  /** Parsed from the typed words only — those chips show as on but aren't links. */
  typed: ParsedQuery
  chips: ChipParams
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {CHIPS.map((chip) => {
        const state = chipState(typed, chips, chip)
        const on = 'border-ember bg-ember text-white'
        const off = 'border-warm-200 text-charcoal hover:border-ember/60'
        const cls = `rounded-full border px-3.5 py-1.5 font-anek text-[13px] font-medium transition-colors`
        if (state === 'typed') {
          return <span key={chip.value} className={`${cls} ${on} opacity-80`}>{chip.label}</span>
        }
        return (
          <Link key={chip.value} href={chipHref(q, city, chips, chip)} className={`${cls} ${state === 'param' ? on : off}`}>
            {chip.label}
          </Link>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 4: Create `components/search/OnOurList.tsx`**

```tsx
import TrendingCard from '@/components/whatsnew/TrendingCard'
import type { TrendingHit } from '@/lib/search/types'

export default function OnOurList({ items, citySlug }: { items: TrendingHit[]; citySlug: string }) {
  if (items.length === 0) return null
  return (
    <section className="mt-10">
      <h2 className="font-anek text-xl font-bold text-charcoal m-0">On our list · visiting soon</h2>
      <p className="font-anek text-[13px] text-muted mt-1 mb-4">
        Places the city is talking about. We haven&apos;t tasted them yet, so they carry no score.
      </p>
      <div className="grid gap-3">
        {items.map((t) => (
          <TrendingCard
            key={t.id}
            entry={{
              id: t.id,
              dish_name: t.dishName,
              place_name: t.placeName,
              area: t.area,
              why: t.why,
              source_url: t.sourceUrl,
              photo_url: t.photoUrl,
              restaurant_id: t.restaurantId,
              citySlug,
              buzz: t.buzz,
            }}
          />
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 5: Create `app/(public)/search/page.tsx`**

```tsx
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { parseQuery } from '@/lib/taxonomy'
import { CITY_PRIORITY } from '@/lib/cities'
import { runSearch } from '@/lib/search/run'
import { headingFor } from '@/lib/search/present'
import type { ChipParams, SearchResponse } from '@/lib/search/types'
import DishResultCard from '@/components/search/DishResultCard'
import FilterChips from '@/components/search/FilterChips'
import OnOurList from '@/components/search/OnOurList'

type Params = { q?: string; city?: string; diet?: string; taste?: string; meal?: string }

export async function generateMetadata({ searchParams }: { searchParams: Params }) {
  const q = (searchParams.q ?? '').trim()
  return { title: q ? `${q} — Chakh` : 'Search — Chakh' }
}

export default async function SearchPage({ searchParams }: { searchParams: Params }) {
  const q = (searchParams.q ?? '').trim()
  const citySlug = searchParams.city ?? CITY_PRIORITY[0]
  const chips: ChipParams = { diet: searchParams.diet, taste: searchParams.taste, meal: searchParams.meal }

  const supabase = await createClient()
  const { data: city } = await supabase.from('cities').select('name, slug').eq('slug', citySlug).maybeSingle()
  if (!city) notFound()

  let res: SearchResponse | null = null
  try {
    res = await runSearch(supabase, q, city.slug, chips)
  } catch {
    // runSearch logged it; show the failure instead of a blank page.
  }

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      {res === null ? (
        <p className="font-anek text-sand-dark">Search is unavailable right now.</p>
      ) : (
        <>
          <h1 className="font-anek text-3xl sm:text-4xl font-bold text-charcoal mb-4">
            {headingFor(res, q, city.name)}
          </h1>
          <FilterChips q={q} city={city.slug} typed={parseQuery(q)} chips={chips} />
          <div className="mt-8">
            {res.empty ? <EmptyState res={res} citySlug={city.slug} cityName={city.name} /> : <Results res={res} citySlug={city.slug} />}
          </div>
        </>
      )}
    </main>
  )
}

function Results({ res, citySlug }: { res: SearchResponse; citySlug: string }) {
  const rated = (res.ranked ?? []).filter((d) => d.score !== null)
  const unrated = (res.ranked ?? []).filter((d) => d.score === null)
  const listOnTop = rated.length === 0

  return (
    <>
      {res.kind === 'broad' && (
        <div className="grid gap-3 sm:grid-cols-2">
          {res.board?.map((b) => (
            <DishResultCard key={b.category} dish={b.dish} citySlug={citySlug} eyebrow={b.label} />
          ))}
        </div>
      )}

      {res.kind === 'meal' &&
        res.groups?.map((g) => (
          <section key={g.key} className="mb-8">
            <h2 className="font-anek text-xl font-bold text-charcoal mb-3">{g.label}</h2>
            <div className="grid gap-3">
              {g.dishes.map((d) => <DishResultCard key={d.id} dish={d} citySlug={citySlug} />)}
            </div>
          </section>
        ))}

      {(res.kind === 'specific' || res.kind === 'text') && (
        <>
          {/* No rated answer: the places we plan to visit are the answer, so they lead. */}
          {listOnTop && <OnOurList items={res.onOurList} citySlug={citySlug} />}
          <div className="grid gap-3">
            {rated.map((d, i) => (
              <DishResultCard key={d.id} dish={d} citySlug={citySlug} position={res.kind === 'specific' ? i + 1 : undefined} />
            ))}
          </div>
          {unrated.length > 0 && (
            <>
              <p className="font-anek text-[11px] font-bold uppercase tracking-[0.15em] text-[#a09a90] mt-8 mb-3">Not rated yet</p>
              <div className="grid gap-3">
                {unrated.map((d) => <DishResultCard key={d.id} dish={d} citySlug={citySlug} />)}
              </div>
            </>
          )}
          {res.restaurants.length > 0 && (
            <>
              <p className="font-anek text-[11px] font-bold uppercase tracking-[0.15em] text-[#a09a90] mt-8 mb-3">Restaurants</p>
              <ul className="grid gap-2">
                {res.restaurants.map((r) => (
                  <li key={r.id}>
                    <Link href={`/${citySlug}/${r.id}`} className="font-anek text-[15px] font-semibold text-charcoal hover:text-ember">
                      {r.name}
                    </Link>
                    <span className="font-anek text-[13px] text-sand-dark">
                      {r.area ? ` · ${r.area}` : ''} · {r.dishCount} {r.dishCount === 1 ? 'dish' : 'dishes'}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
          {!listOnTop && <OnOurList items={res.onOurList} citySlug={citySlug} />}
        </>
      )}

      {res.kind !== 'specific' && res.kind !== 'text' && <OnOurList items={res.onOurList} citySlug={citySlug} />}
    </>
  )
}

function EmptyState({ res, citySlug, cityName }: { res: SearchResponse; citySlug: string; cityName: string }) {
  return (
    <>
      <OnOurList items={res.onOurList} citySlug={citySlug} />
      <p className="font-anek text-[15px] text-sand-dark mt-8">
        Nothing we&apos;ve rated matches yet. Here&apos;s the best of {cityName} instead.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 mt-4">
        {res.board?.map((b) => (
          <DishResultCard key={b.category} dish={b.dish} citySlug={citySlug} eyebrow={b.label} />
        ))}
      </div>
    </>
  )
}
```

- [ ] **Step 6: Verify in the browser**

With the dev server running, navigate the browser pane to each URL (replace `<slug>`), use `get_page_text` and check:

| URL | Expect |
|---|---|
| `/search?q=best+cake&city=<slug>` | heading "Best cake in …", #1 … numbered cards, scores descending |
| `/search?q=best+cake&city=<slug>&diet=veg` | Veg chip on; only veg dishes |
| `/search?q=dinner&city=<slug>` | "Dinner in …", group headings (or empty state if nothing tagged dinner) |
| `/search?q=best+food+in+town&city=<slug>` | "…'s Best", "Best …" eyebrows |
| `/search?q=brwnie&city=<slug>` | "Results for “brwnie”", brownies |
| `/search?q=zzzz&city=<slug>` | "Nothing we've rated matches yet" + board |
| `/search?city=nope` | 404 |

Also `read_console_messages` with `onlyErrors: true` → none; `resize_window` preset `mobile` + screenshot → no horizontal scroll; reset to `desktop`.

- [ ] **Step 7: Type-check and commit**

Run: `npx tsc --noEmit` — only HomeClient errors remain (fixed in Task 7).

```bash
git add "app/(public)/search" components/search components/whatsnew/TrendingCard.tsx
git commit -m "Add /search results page with ranked, grouped and City's Best layouts

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Hero dropdown → preview + "See all"

**Files:**
- Modify: `components/home/HomeClient.tsx` (import line 9; state ~line 37; search effect ~lines 157–194; `hasResults`/`handleSearch` ~lines 196–201; dropdown dishes block ~lines 307–340)

**Interfaces:**
- Consumes: `SearchResponse` from `@/lib/search/types`; `previewDishes`, `summaryLine` from `@/lib/search/present`.

- [ ] **Step 1: Swap the import and state**

Replace `import type { SearchResults } from '@/app/api/search/route'` with:

```ts
import type { SearchResponse } from '@/lib/search/types'
import { previewDishes, summaryLine } from '@/lib/search/present'
```

Replace the results state line with:

```ts
  const [results, setResults] = useState<SearchResponse | null>(null)
```

In the search `useEffect`, replace both `setResults({ dishes: [], restaurants: [] })` calls with `setResults(null)`.

- [ ] **Step 2: Derive the preview and send Enter to `/search`**

Replace the `hasResults` line and `handleSearch` with:

```ts
  const preview = results ? previewDishes(results) : []
  const previewRestaurants = results?.restaurants.slice(0, 3) ?? []
  const hasResults = preview.length > 0 || previewRestaurants.length > 0 || (results?.onOurList.length ?? 0) > 0
  const searchHref = `/search?q=${encodeURIComponent(query.trim())}&city=${encodeURIComponent(active.city.slug)}`

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    router.push(query.trim() ? searchHref : `/search?city=${encodeURIComponent(active.city.slug)}`)
  }
```

- [ ] **Step 3: Update the dropdown body**

In the dropdown, replace `results.dishes.length > 0` with `preview.length > 0`, `results.dishes.map(` with `preview.map(`, `results.restaurants.length > 0` with `previewRestaurants.length > 0`, and `results.restaurants.map(` with `previewRestaurants.map(`.

Directly after the `{searchFailed && (...)}` block, add the summary + see-all row:

```tsx
                {!searchFailed && results && hasResults && (
                  <Link
                    href={searchHref}
                    className="flex items-center justify-between px-5 py-2.5 bg-[#fdf6f2] font-anek text-[13px] text-ember font-semibold hover:bg-[#fbeee6] transition-colors"
                  >
                    <span>{summaryLine(results)}</span>
                    <span>See all →</span>
                  </Link>
                )}
```

And change the "Nothing matches" message to also offer the full page:

```tsx
                {!searchFailed && !searching && !hasResults && (
                  <Link href={searchHref} className="block px-5 py-3 font-anek text-[13.5px] text-sand-dark m-0 hover:text-ember">
                    Nothing rated matches &ldquo;{query.trim()}&rdquo; in {active.city.name} yet — see the city&apos;s best →
                  </Link>
                )}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0, no errors.

- [ ] **Step 5: Verify in the browser**

On `/`, type `best cake` in the hero input (use `computer` type action), wait ~1s, `read_page`: dropdown shows ≤5 dishes in score order and a "… dishes · See all →" row. Press Enter → URL is `/search?q=best%20cake&city=<slug>` and the ranked page renders. Type `zzzz` → the "see the city's best" link. Screenshot the dropdown as proof.

- [ ] **Step 6: Commit**

```bash
git add components/home/HomeClient.tsx
git commit -m "Hero search previews results and opens the full /search page

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: "On our list" end-to-end with a real entry + docs

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Get a real viral place from the user.** Ask for one place they genuinely plan to visit: dish name, place name, city, area, why it's buzzing, source URL, buzz 1–3, and its tags (category, diet, meals). Do NOT invent one — this is the live production database.

- [ ] **Step 2: Insert it** (values from Step 1):

```bash
psql "$DATABASE_URL" -c "insert into trending_dishes (dish_name, place_name, city_id, area, why, source_url, buzz, category, diet, meals)
values ('<dish>', '<place>', (select id from cities where slug='<slug>'), '<area>', '<why>', '<url>', <buzz>, '<category>', '<diet>', '{<meal>}')"
```

- [ ] **Step 3: Verify.** Search its category word (e.g. `best cake` if `category='baked'`) on `/search`: it appears under "On our list · visiting soon" with the right number of 🔥, below the rated dishes, with no score. Search its place name with a typo: it appears via fuzzy match. Also confirm it still shows on `/whats-new`.

- [ ] **Step 4: Update `CLAUDE.md`.** Under `## Architecture`, after the **AI Suggest** paragraph, add:

```markdown
**Search** — `lib/search/`. `parseQuery` (`lib/taxonomy.ts`) extracts tags; `classifyQuery` picks a kind: `specific` (ranked by `dishes.score`), `meal` (grouped Thali / by cuisine), `broad` (City's Best: top dish per category), `text` (typo-tolerant via the `search_fuzzy` SQL function, migration 008). `runSearch` is the single entry point, used by `/api/search` (hero dropdown) and the `/search` page. Viral entries from `trending_dishes` show separately as "On our list · visiting soon" (ordered by `buzz`), never ranked with rated dishes. Pure logic is unit tested: `npm test`. Design: `docs/superpowers/specs/2026-09-30-smart-search-design.md`.
```

And add `npm test           # Vitest unit tests (lib/**/*.test.ts)` to the Commands block.

- [ ] **Step 5: Final checks and commit**

Run: `npm test && npx tsc --noEmit && npm run build`
Expected: all pass.

```bash
git add CLAUDE.md
git commit -m "Document the search architecture

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
