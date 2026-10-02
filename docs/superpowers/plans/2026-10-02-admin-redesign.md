# Admin Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Chakh admin so every field search depends on (score + taxonomy tags) is editable, viral places ("On our list") have an admin, the admin gets the Spice Market "look C", and login gains clear errors, show/hide password and a self-service password reset.

**Architecture:**
- Pure logic lives in `lib/admin/*` and is unit tested: tag validation, dish status, score parsing, login error copy.
- Server actions in `app/actions/*` validate every write.
- Shared UI building blocks live in `components/admin/*`, and every admin page is rebuilt on them.
- The tag vocabulary comes only from `lib/taxonomy.ts`, so the admin and search can never disagree.

**Tech Stack:** Next.js 14 App Router, Supabase (`@supabase/ssr`), TypeScript, Tailwind, Vitest. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-02-admin-redesign-design.md`

## Global Constraints

- **Look C:**
  - sidebar `bg-ink` with `text-[#cdc2b8]` links; active link `bg-ink-card text-ember-light`; logo wordmark `text-ember-light`
  - workspace `bg-cream`, cards `bg-white border border-warm-200 rounded-2xl`
  - primary buttons `bg-ember text-white`; selected chips `bg-ember border-ember text-white`
  - fonts: `font-anek` for UI text, `font-barlow` for big numbers
- **Tags:** tag options come only from `lib/taxonomy.ts` (`DIETS`, `CATEGORY_TREE`, `CUISINES`, `TASTES`, `MEALS`). Never hard-code tag lists in components.
- **Untagged dishes:** saving an untagged dish is allowed. "Needs tags" means `isUntagged(dish)`, i.e. diet or category missing.
- **Score:** a number from 0 to 10 with 1 decimal place. A blank score means `null`.
- **Error handling:**
  - Every server action throws `Error(message)` on bad input or a DB error. UI shows the message and keeps the user's input.
  - Server-component query failures call `console.error('[admin] …', error.message)` and render an error EmptyState. They never render silently empty.
- **Credentials:** Claude never enters credentials, creates accounts or sets passwords. Signed-in pages are browser-verified only after the user signs in themselves in the browser pane.
- **Commands:**
  - Do not run `npm run lint`: there is no ESLint config, so it starts an interactive setup.
  - Verify with `npm test`, `npx tsc --noEmit` and `npm run build`.
- **Commits:** every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Supabase clients:** in server components and actions, use `import { createClient } from '@/lib/supabase/server'` and `await createClient()`. In client components, use `@/lib/supabase/client`.

## File Map

| File | Status | Responsibility |
|---|---|---|
| `lib/admin/dishTags.ts` (+test) | create | `DishTags`, `EMPTY_TAGS`, `validateTags`, `tagLabel`, `CATEGORY_GROUPS` |
| `lib/admin/dishStatus.ts` (+test) | create | `dishStatus` |
| `lib/admin/score.ts` (+test) | create | `parseScore` |
| `lib/admin/authMessages.ts` (+test) | create | `loginErrorMessage`, `loginNotice` |
| `lib/admin/types.ts` | create | `AdminDish`, `AdminTrending`, `CityOption` |
| `lib/admin/city.ts` (+test) | create | `pickCity` |
| `types/database.ts` | modify | `Dish` gains score, tags, `deleted_at` |
| `app/actions/dishes.ts` | modify | `createDish`, `updateDish(id, patch)` |
| `app/actions/trending.ts` | modify | buzz + tag validation |
| `components/admin/ui.tsx` | create | `Button`, `Field`, `Input`, `Textarea`, `Select`, `Chip`, `StatusBadge`, `EmptyState` |
| `components/admin/TagPicker.tsx` | create | chip rows from the taxonomy |
| `components/admin/SidePanel.tsx` | create | slide-over panel |
| `components/admin/Toast.tsx` | create | `ToastProvider`, `useToast` |
| `components/admin/CityTabs.tsx` | create | `?city=` switcher |
| `components/admin/PasswordInput.tsx` | create | input with show/hide |
| `components/admin/AdminShell.tsx` | create | sidebar + workspace + mobile menu |
| `components/admin/DishPanel.tsx` | create | create/edit dish panel incl. photo upload |
| `components/admin/DishList.tsx` | create | tabs + filter + rows + DishPanel wiring |
| `components/admin/TrendingPanel.tsx`, `TrendingList.tsx` | create | On our list admin |
| `app/admin/layout.tsx` | modify | use AdminShell |
| `app/admin/AdminNav.tsx`, `app/admin/restaurants/[id]/AddDishForm.tsx`, `app/admin/restaurants/[id]/DishActions.tsx` | delete | replaced |
| `app/admin/login/page.tsx` | rewrite | new login |
| `app/admin/forgot-password/page.tsx`, `app/admin/reset-password/page.tsx`, `app/auth/callback/route.ts` | create | password reset flow |
| `middleware.ts` | modify | public `/admin/forgot-password` |
| `app/admin/page.tsx` | rewrite | dashboard |
| `app/admin/dishes/page.tsx` | create | Dishes page |
| `app/admin/trending/page.tsx` | create | On our list page |
| `app/admin/restaurants/page.tsx` | create | restaurants list |
| `app/admin/restaurants/[id]/page.tsx`, `RestaurantActions.tsx`, `ReviewActions.tsx`, `app/admin/restaurants/new/page.tsx`, `app/admin/dishes/[id]/review/page.tsx` | restyle | look C |
| `CLAUDE.md` | modify | admin + reset setup notes |

---

### Task 1: Pure admin logic (tags, status, score, login copy, city)

**Files:**
- Create: `lib/admin/dishTags.ts`, `lib/admin/dishStatus.ts`, `lib/admin/score.ts`, `lib/admin/authMessages.ts`, `lib/admin/city.ts`, `lib/admin/types.ts`
- Tests: `lib/admin/dishTags.test.ts`, `lib/admin/dishStatus.test.ts`, `lib/admin/score.test.ts`, `lib/admin/authMessages.test.ts`, `lib/admin/city.test.ts`

**Interfaces:**
- Consumes:
  - from `@/lib/taxonomy`: `DIETS`, `CUISINES`, `TASTES`, `MEALS`, `CATEGORY_TREE`, `CATEGORY_LEAVES`, `labelFor`, `isUntagged`, and the types `Diet`, `Cuisine`, `Taste`, `Meal`, `CategoryLeaf`, `CategoryParent`
  - `BOARD_LABELS` from `@/lib/search/rank`
  - `CITY_PRIORITY` from `@/lib/cities`
- Produces (every later task uses these exact names):
  - `type DishTags = { diet: Diet | null; category: CategoryLeaf | null; cuisine: Cuisine | null; tastes: Taste[]; meals: Meal[] }`
  - `EMPTY_TAGS: DishTags`
  - `validateTags(input: Record<string, unknown>): Partial<DishTags>`: validates only the keys present
  - `tagLabel(dim: 'diet' | 'category' | 'cuisine' | 'taste' | 'meal', value: string): string`
  - `CATEGORY_GROUPS: { parent: CategoryParent; label: string; leaves: CategoryLeaf[] }[]`
  - `type DishStatus = 'deleted' | 'needs_tags' | 'needs_score' | 'scored'`
  - `dishStatus(d: { score: number | null; diet: string | null; category: string | null; deleted_at: string | null }): DishStatus`
  - `parseScore(raw: string): number | null`
  - `loginErrorMessage(err: { message?: string } | null | undefined): string`
  - `loginNotice(params: { reset?: string; error?: string }): { tone: 'info' | 'error'; text: string } | null`
  - `pickCity(slugs: string[], requested: string | undefined): string | null`
  - types `AdminDish`, `AdminTrending`, `CityOption` (below)

- [ ] **Step 1: Write the failing tests**

`lib/admin/dishTags.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { validateTags, tagLabel, EMPTY_TAGS, CATEGORY_GROUPS } from './dishTags'

describe('validateTags', () => {
  it('passes valid values through and only returns keys that were given', () => {
    expect(validateTags({ diet: 'veg', tastes: ['sweet', 'rich'] })).toEqual({ diet: 'veg', tastes: ['sweet', 'rich'] })
  })
  it('accepts null for single-value dimensions', () => {
    expect(validateTags({ diet: null, category: null, cuisine: null })).toEqual({ diet: null, category: null, cuisine: null })
  })
  it('dedupes multi-value dimensions', () => {
    expect(validateTags({ meals: ['dinner', 'dinner', 'lunch'] })).toEqual({ meals: ['dinner', 'lunch'] })
  })
  it.each([
    [{ diet: 'carnivore' }, 'Unknown diet: carnivore'],
    [{ category: 'soup' }, 'Unknown category: soup'],
    [{ cuisine: 'thai' }, 'Unknown cuisine: thai'],
    [{ tastes: ['umami'] }, 'Unknown taste: umami'],
    [{ meals: ['midnight'] }, 'Unknown meal: midnight'],
    [{ tastes: 'sweet' }, 'tastes must be a list'],
  ])('rejects %j', (input, message) => {
    expect(() => validateTags(input)).toThrow(message)
  })
  it('EMPTY_TAGS is fully empty', () => {
    expect(EMPTY_TAGS).toEqual({ diet: null, category: null, cuisine: null, tastes: [], meals: [] })
  })
})

describe('tagLabel', () => {
  it('uses board labels for categories and labelFor otherwise', () => {
    expect(tagLabel('category', 'baked')).toBe('Cakes & Bakes')
    expect(tagLabel('diet', 'non_veg')).toBe('Non Veg')
    expect(tagLabel('cuisine', 'south_indian')).toBe('South Indian')
  })
})

describe('CATEGORY_GROUPS', () => {
  it('groups every leaf once, in Mains/Snacks/Desserts/Drinks order', () => {
    expect(CATEGORY_GROUPS.map((g) => g.label)).toEqual(['Mains', 'Snacks', 'Desserts', 'Drinks'])
    expect(CATEGORY_GROUPS.flatMap((g) => g.leaves)).toHaveLength(16)
  })
})
```

`lib/admin/dishStatus.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { dishStatus } from './dishStatus'

const d = (o: Partial<{ score: number | null; diet: string | null; category: string | null; deleted_at: string | null }>) =>
  ({ score: null, diet: 'veg', category: 'baked', deleted_at: null, ...o })

describe('dishStatus', () => {
  it('deleted wins over everything', () => expect(dishStatus(d({ deleted_at: '2026-01-01', diet: null }))).toBe('deleted'))
  it('missing diet or category is needs_tags, even when scored', () => {
    expect(dishStatus(d({ diet: null, score: 8 }))).toBe('needs_tags')
    expect(dishStatus(d({ category: null }))).toBe('needs_tags')
  })
  it('tagged but unscored is needs_score', () => expect(dishStatus(d({}))).toBe('needs_score'))
  it('tagged and scored is scored (0 counts as a score)', () => expect(dishStatus(d({ score: 0 }))).toBe('scored'))
})
```

`lib/admin/score.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { parseScore } from './score'

describe('parseScore', () => {
  it('blank is null', () => {
    expect(parseScore('')).toBeNull()
    expect(parseScore('   ')).toBeNull()
  })
  it('parses and rounds to one decimal', () => {
    expect(parseScore('8')).toBe(8)
    expect(parseScore('8.46')).toBe(8.5)
    expect(parseScore('0')).toBe(0)
    expect(parseScore('10')).toBe(10)
  })
  it.each(['-1', '10.1', 'abc', '1e3'])('rejects %s', (raw) => {
    expect(() => parseScore(raw)).toThrow('Score must be between 0 and 10')
  })
})
```

`lib/admin/authMessages.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { loginErrorMessage, loginNotice } from './authMessages'

describe('loginErrorMessage', () => {
  it('explains wrong credentials and the Directus mix-up', () => {
    const m = loginErrorMessage({ message: 'Invalid login credentials' })
    expect(m).toContain("don't match a Chakh admin account")
    expect(m).toContain('Directus')
  })
  it('explains unconfirmed accounts', () => {
    expect(loginErrorMessage({ message: 'Email not confirmed' })).toContain("hasn't been confirmed")
  })
  it('explains network failures', () => {
    expect(loginErrorMessage({ message: 'Failed to fetch' })).toContain("Can't reach the login server")
  })
  it('falls back to the raw message, or a generic one', () => {
    expect(loginErrorMessage({ message: 'Rate limit exceeded' })).toBe('Rate limit exceeded')
    expect(loginErrorMessage(null)).toBe('Something went wrong. Please try again.')
  })
})

describe('loginNotice', () => {
  it('maps query params to notices', () => {
    expect(loginNotice({ reset: 'sent' })).toEqual({ tone: 'info', text: 'Check your inbox for a reset link.' })
    expect(loginNotice({ error: 'link' })?.tone).toBe('error')
    expect(loginNotice({})).toBeNull()
  })
})
```

`lib/admin/city.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { pickCity } from './city'

describe('pickCity', () => {
  it('honours a valid requested slug', () => expect(pickCity(['ahmedabad', 'surat'], 'ahmedabad')).toBe('ahmedabad'))
  it('falls back to the priority city, then the first', () => {
    expect(pickCity(['ahmedabad', 'surat'], 'nope')).toBe('surat')
    expect(pickCity(['pune'], undefined)).toBe('pune')
  })
  it('returns null with no cities', () => expect(pickCity([], undefined)).toBeNull())
})
```

- [ ] **Step 2: Run the tests and see them fail**

Run: `npm test`
Expected: FAIL. The new test files can't resolve `./dishTags`, `./dishStatus`, `./score`, `./authMessages` or `./city`.

- [ ] **Step 3: Implement**

`lib/admin/dishTags.ts`:

```ts
import {
  CATEGORY_LEAVES, CATEGORY_TREE, CUISINES, DIETS, MEALS, TASTES, labelFor,
  type CategoryLeaf, type CategoryParent, type Cuisine, type Diet, type Meal, type Taste,
} from '@/lib/taxonomy'
import { BOARD_LABELS } from '@/lib/search/rank'

/** The search-facing tags on a dish (and on a viral entry). Vocabulary: lib/taxonomy.ts. */
export type DishTags = {
  diet: Diet | null
  category: CategoryLeaf | null
  cuisine: Cuisine | null
  tastes: Taste[]
  meals: Meal[]
}

export const EMPTY_TAGS: DishTags = { diet: null, category: null, cuisine: null, tastes: [], meals: [] }

function single<T extends string>(dim: string, vocab: readonly T[], v: unknown): T | null {
  if (v === null || v === undefined || v === '') return null
  if (typeof v !== 'string' || !(vocab as readonly string[]).includes(v)) throw new Error(`Unknown ${dim}: ${String(v)}`)
  return v as T
}

function multi<T extends string>(dim: string, key: string, vocab: readonly T[], v: unknown): T[] {
  if (!Array.isArray(v)) throw new Error(`${key} must be a list`)
  for (const x of v) {
    if (typeof x !== 'string' || !(vocab as readonly string[]).includes(x)) throw new Error(`Unknown ${dim}: ${String(x)}`)
  }
  return Array.from(new Set(v as T[]))
}

/**
 * Server-side guard for every tag write. Only the keys present are validated and
 * returned, so a partial update never blanks tags it didn't mention.
 */
export function validateTags(input: Record<string, unknown>): Partial<DishTags> {
  const out: Partial<DishTags> = {}
  if ('diet' in input) out.diet = single('diet', DIETS, input.diet)
  if ('category' in input) out.category = single('category', CATEGORY_LEAVES, input.category)
  if ('cuisine' in input) out.cuisine = single('cuisine', CUISINES, input.cuisine)
  if ('tastes' in input) out.tastes = multi('taste', 'tastes', TASTES, input.tastes)
  if ('meals' in input) out.meals = multi('meal', 'meals', MEALS, input.meals)
  return out
}

export function tagLabel(dim: 'diet' | 'category' | 'cuisine' | 'taste' | 'meal', value: string): string {
  if (dim === 'category' && value in BOARD_LABELS) return BOARD_LABELS[value as CategoryLeaf]
  return labelFor(value)
}

const GROUP_ORDER: { parent: CategoryParent; label: string }[] = [
  { parent: 'main', label: 'Mains' },
  { parent: 'snack', label: 'Snacks' },
  { parent: 'dessert', label: 'Desserts' },
  { parent: 'beverage', label: 'Drinks' },
]

export const CATEGORY_GROUPS = GROUP_ORDER.map((g) => ({
  ...g,
  leaves: [...(CATEGORY_TREE[g.parent] as readonly CategoryLeaf[])],
}))
```

`lib/admin/dishStatus.ts`:

```ts
import { isUntagged } from '@/lib/taxonomy'

export type DishStatus = 'deleted' | 'needs_tags' | 'needs_score' | 'scored'

/** Precedence: deleted → needs_tags → needs_score → scored. */
export function dishStatus(d: {
  score: number | null
  diet: string | null
  category: string | null
  deleted_at: string | null
}): DishStatus {
  if (d.deleted_at) return 'deleted'
  if (isUntagged(d)) return 'needs_tags'
  if (d.score === null) return 'needs_score'
  return 'scored'
}
```

`lib/admin/score.ts`:

```ts
/** "" → null (not scored). Otherwise 0–10, rounded to one decimal. */
export function parseScore(raw: string): number | null {
  const t = raw.trim()
  if (t === '') return null
  if (!/^\d+(\.\d+)?$/.test(t)) throw new Error('Score must be between 0 and 10')
  const n = Math.round(Number(t) * 10) / 10
  if (n < 0 || n > 10) throw new Error('Score must be between 0 and 10')
  return n
}
```

`lib/admin/authMessages.ts`:

```ts
/** Supabase's auth errors are terse; these say what actually went wrong and what to do. */
export function loginErrorMessage(err: { message?: string } | null | undefined): string {
  const m = err?.message ?? ''
  if (!m) return 'Something went wrong. Please try again.'
  if (/invalid login credentials/i.test(m)) {
    return "That email and password don't match a Chakh admin account. Your Directus login is separate and won't work here. Forgot your password?"
  }
  if (/email not confirmed/i.test(m)) {
    return "This account hasn't been confirmed yet. Ask the admin to confirm it in Supabase → Authentication → Users."
  }
  if (/failed to fetch|network/i.test(m)) {
    return "Can't reach the login server. Check your connection and try again."
  }
  return m
}

export function loginNotice(params: { reset?: string; error?: string }): { tone: 'info' | 'error'; text: string } | null {
  if (params.reset === 'sent') return { tone: 'info', text: 'Check your inbox for a reset link.' }
  if (params.error === 'link') {
    return { tone: 'error', text: 'That reset link has expired or was already used. Request a new one.' }
  }
  return null
}
```

`lib/admin/city.ts`:

```ts
import { CITY_PRIORITY } from '@/lib/cities'

/** The requested city if it exists, else the home-priority city, else the first. */
export function pickCity(slugs: string[], requested: string | undefined): string | null {
  if (requested && slugs.includes(requested)) return requested
  return CITY_PRIORITY.find((s) => slugs.includes(s)) ?? slugs[0] ?? null
}
```

`lib/admin/types.ts`:

```ts
import type { DishTags } from './dishTags'

export type CityOption = { id: string; name: string; slug: string }

export type AdminDish = DishTags & {
  id: string
  name: string
  description: string | null
  photo_url: string | null
  is_must_try: boolean
  score: number | null
  deleted_at: string | null
  restaurant_id: string
  restaurant_name: string
}

export type AdminTrending = DishTags & {
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
  buzz: number
  deleted_at: string | null
}
```

- [ ] **Step 4: Run the tests**

Run: `npm test`
Expected: all pass. That's the 61 existing tests plus the new ones.

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add lib/admin
git commit -m "Add admin logic: tag validation, dish status, score parsing, login copy

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Server actions + Dish type

**Files:**
- Modify: `app/actions/dishes.ts`, `app/actions/trending.ts`, `types/database.ts`, `app/admin/restaurants/[id]/DishActions.tsx` (call-site only)

**Interfaces:**
- Consumes: `validateTags`, `EMPTY_TAGS`, `DishTags` (Task 1).
- Produces:
  - `type DishInput = { restaurant_id: string; name: string; description: string | null; is_must_try: boolean; score: number | null; photo_url: string | null } & DishTags`
  - `createDish(input: DishInput): Promise<{ id: string }>`
  - `type DishPatch = Partial<Omit<DishInput, 'restaurant_id'>>`
  - `updateDish(id: string, patch: DishPatch): Promise<void>`
  - `softDeleteDish(id: string)` and `restoreDish(id: string)`. The `restaurantId` argument is dropped.
  - `TrendingInput` gains `buzz: number` and `DishTags`. `createTrending`, `updateTrending`, `softDeleteTrending`, `restoreTrending` and `markTrendingVisited` keep their names.

- [ ] **Step 1: Rewrite `app/actions/dishes.ts`**

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { EMPTY_TAGS, validateTags, type DishTags } from '@/lib/admin/dishTags'

export type DishInput = {
  restaurant_id: string
  name: string
  description: string | null
  is_must_try: boolean
  /** 0–10, one decimal. null means "not scored yet" — the dish stays out of rankings. */
  score: number | null
  photo_url: string | null
} & DishTags

export type DishPatch = Partial<Omit<DishInput, 'restaurant_id'>>

function checkScore(score: number | null | undefined) {
  if (score === null || score === undefined) return
  if (Number.isNaN(score) || score < 0 || score > 10) throw new Error('Score must be between 0 and 10')
}

function checkName(name: string | undefined) {
  if (name !== undefined && name.trim() === '') throw new Error('Dish name is required')
}

async function revalidateDish(restaurantId: string | null) {
  revalidatePath('/admin')
  revalidatePath('/admin/dishes')
  if (restaurantId) revalidatePath(`/admin/restaurants/${restaurantId}`)
  revalidatePath('/')
}

export async function createDish(input: DishInput): Promise<{ id: string }> {
  checkName(input.name)
  checkScore(input.score)
  if (!input.restaurant_id) throw new Error('Pick a restaurant')
  const tags = { ...EMPTY_TAGS, ...validateTags(input) }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('dishes')
    .insert({
      restaurant_id: input.restaurant_id,
      name: input.name.trim(),
      description: input.description || null,
      is_must_try: input.is_must_try,
      score: input.score,
      photo_url: input.photo_url,
      ...tags,
    })
    .select('id')
    .single()
  if (error) throw new Error(error.message)

  await revalidateDish(input.restaurant_id)
  return { id: data.id }
}

export async function updateDish(id: string, patch: DishPatch): Promise<void> {
  checkName(patch.name)
  checkScore(patch.score)
  const { diet, category, cuisine, tastes, meals, ...rest } = patch
  const tagInput = Object.fromEntries(
    Object.entries({ diet, category, cuisine, tastes, meals }).filter(([, v]) => v !== undefined)
  )
  const update = {
    ...rest,
    ...(rest.name !== undefined ? { name: rest.name.trim() } : {}),
    ...validateTags(tagInput),
  }

  const supabase = await createClient()
  const { data, error } = await supabase.from('dishes').update(update).eq('id', id).select('restaurant_id').single()
  if (error) throw new Error(error.message)

  await revalidateDish(data.restaurant_id)
}

export async function softDeleteDish(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('dishes')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .select('restaurant_id')
    .single()
  if (error) throw new Error(error.message)
  await revalidateDish(data.restaurant_id)
}

export async function restoreDish(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('dishes')
    .update({ deleted_at: null })
    .eq('id', id)
    .select('restaurant_id')
    .single()
  if (error) throw new Error(error.message)
  await revalidateDish(data.restaurant_id)
}
```

Before replacing the file, read the old `softDeleteDish` and `restoreDish` and keep any extra behaviour they had, such as additional revalidated paths.

- [ ] **Step 2: Fix the call sites in `app/admin/restaurants/[id]/DishActions.tsx`**

This file is deleted in Task 6. For now it only needs to compile.
- `updateDish(dish.id, dish.restaurantId, {...})` becomes `updateDish(dish.id, {...})`
- `softDeleteDish(dish.id, dish.restaurantId)` becomes `softDeleteDish(dish.id)`
- `restoreDish(dish.id, dish.restaurantId)` becomes `restoreDish(dish.id)`

Run `grep -rn "updateDish\|softDeleteDish\|restoreDish" app components` and fix every other caller the same way.

- [ ] **Step 3: Extend `app/actions/trending.ts`**

Change `TrendingInput` to:

```ts
export type TrendingInput = {
  dish_name: string
  place_name: string
  city_id: string
  restaurant_id: string | null
  area: string | null
  why: string
  source_url: string | null
  photo_url: string | null
  rank: number
  /** 1–3, shown as 🔥. Orders "On our list". */
  buzz: number
} & DishTags
```

Then make these changes:

1. Add the imports:
   ```ts
   import { EMPTY_TAGS, validateTags, type DishTags } from '@/lib/admin/dishTags'
   ```
2. Add this function above `createTrending`:
   ```ts
   function checkTrending(data: Partial<TrendingInput>) {
     if (data.dish_name !== undefined && !data.dish_name.trim()) throw new Error('Dish name is required')
     if (data.place_name !== undefined && !data.place_name.trim()) throw new Error('Place name is required')
     if (data.why !== undefined && !data.why.trim()) throw new Error("Say why it's buzzing")
     if (data.buzz !== undefined && ![1, 2, 3].includes(data.buzz)) throw new Error('Buzz must be 1, 2 or 3')
     if (data.source_url && !/^https?:\/\//.test(data.source_url)) throw new Error('Source link must start with http')
   }
   ```
3. In `createTrending`:
   - call `checkTrending(data)` first
   - insert `{ ...data, ...EMPTY_TAGS, ...validateTags(data) }`
4. In `updateTrending`:
   - call `checkTrending(data)` first
   - update with `{ ...data, ...validateTags(data) }`
5. In `revalidate()`, add `revalidatePath('/admin')` and `revalidatePath('/search')`.

- [ ] **Step 4: Update the `Dish` type in `types/database.ts`**

```ts
export type Dish = {
  id: string
  restaurant_id: string
  name: string
  description: string | null
  photo_url: string | null
  is_must_try: boolean
  /** 0–10, hand-set. null = not scored yet. */
  score: number | null
  diet: string | null
  category: string | null
  cuisine: string | null
  tastes: string[]
  meals: string[]
  deleted_at: string | null
  created_at: string
}
```

- [ ] **Step 5: Verify and commit**

Run: `npx tsc --noEmit`
Expected: exit 0. Fix any caller that broke because of the new `Dish` fields or the dropped arguments.

Run: `npm test`
Expected: all pass.

```bash
git add app/actions/dishes.ts app/actions/trending.ts types/database.ts app/admin
git commit -m "Validate dish and viral-entry tags and score in server actions

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Admin UI building blocks

**Files:**
- Create: `components/admin/ui.tsx`, `components/admin/TagPicker.tsx`, `components/admin/SidePanel.tsx`, `components/admin/Toast.tsx`, `components/admin/CityTabs.tsx`, `components/admin/PasswordInput.tsx`

**Interfaces:**
- Consumes: `DishTags`, `CATEGORY_GROUPS`, `tagLabel` (Task 1); `DIETS`, `CUISINES`, `TASTES`, `MEALS` (`@/lib/taxonomy`); `DishStatus` (Task 1); `CityOption` (Task 1).
- Produces:
  - from `ui.tsx`: `Button`, `Field`, `Input`, `Textarea`, `Select`, `Chip`, `StatusBadge`, `EmptyState`
  - `TagPicker` (default export)
  - `SidePanel` (default export)
  - `ToastProvider` and `useToast` (named)
  - `CityTabs` (default export)
  - `PasswordInput` (default export)

  The props are the ones shown in the code below.

- [ ] **Step 1: Create `components/admin/ui.tsx`**

```tsx
'use client'

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import type { DishStatus } from '@/lib/admin/dishStatus'

const VARIANTS = {
  primary: 'bg-ember text-white hover:bg-[#c43e23] disabled:bg-warm-200 disabled:text-muted',
  secondary: 'bg-white text-charcoal border border-warm-200 hover:border-ember/60',
  danger: 'bg-white text-spice border border-spice/40 hover:bg-spice hover:text-white',
  ghost: 'text-muted hover:text-charcoal',
} as const

export function Button({
  variant = 'primary',
  loading = false,
  className = '',
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof VARIANTS; loading?: boolean }) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 font-anek text-[14px] font-semibold transition-colors disabled:cursor-not-allowed ${VARIANTS[variant]} ${className}`}
    >
      {loading && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />}
      {children}
    </button>
  )
}

export function Field({ label, hint, error, htmlFor, children }: {
  label: string
  hint?: string
  error?: string
  htmlFor?: string
  children: ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block font-anek text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
        {label}
      </label>
      {children}
      {error ? (
        <p className="font-anek text-[13px] text-spice">{error}</p>
      ) : hint ? (
        <p className="font-anek text-[12.5px] text-muted">{hint}</p>
      ) : null}
    </div>
  )
}

const CONTROL =
  'w-full rounded-lg border border-warm-200 bg-cream px-3.5 py-2.5 font-anek text-[15px] text-charcoal placeholder:text-muted/70 focus:border-ember focus:outline-none focus:ring-2 focus:ring-ember/20'

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${CONTROL} ${props.className ?? ''}`} />
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${CONTROL} resize-none ${props.className ?? ''}`} />
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${CONTROL} ${props.className ?? ''}`} />
}

export function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 font-anek text-[13px] font-medium transition-colors ${
        selected ? 'border-ember bg-ember text-white' : 'border-warm-200 bg-white text-charcoal hover:border-ember/60'
      }`}
    >
      {children}
    </button>
  )
}

const BADGE: Record<DishStatus, { cls: string; text: string }> = {
  needs_tags: { cls: 'bg-[#fdf0ea] text-spice-dark border-[#f2c9bb]', text: 'Needs tags' },
  needs_score: { cls: 'bg-[#fff6e6] text-[#8a5a12] border-[#f1d9a8]', text: 'Needs score' },
  scored: { cls: 'bg-[#eaf7f0] text-[#1f7a52] border-[#bfe6d2]', text: 'Scored' },
  deleted: { cls: 'bg-warm-100 text-muted border-warm-200', text: 'Deleted' },
}

export function StatusBadge({ status }: { status: DishStatus }) {
  const b = BADGE[status]
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-0.5 font-anek text-[11.5px] font-semibold ${b.cls}`}>
      {b.text}
    </span>
  )
}

export function EmptyState({ icon = '🍽️', text, action }: { icon?: string; text: string; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-warm-200 bg-white/60 px-6 py-12 text-center">
      <div className="text-3xl" aria-hidden>{icon}</div>
      <p className="mt-2 font-anek text-[15px] text-muted">{text}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
```

- [ ] **Step 2: Create `components/admin/TagPicker.tsx`**

```tsx
'use client'

import { CUISINES, DIETS, MEALS, TASTES } from '@/lib/taxonomy'
import { CATEGORY_GROUPS, tagLabel, type DishTags } from '@/lib/admin/dishTags'
import { Chip } from './ui'

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 font-anek text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
        {label}
        {hint && <span className="ml-1.5 font-medium normal-case tracking-normal text-muted/80">· {hint}</span>}
      </p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  )
}

function toggle<T>(list: T[], v: T): T[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v]
}

/** Every option comes from lib/taxonomy.ts, so the admin can only write tags search understands. */
export default function TagPicker({ value, onChange }: { value: DishTags; onChange: (next: DishTags) => void }) {
  const set = (patch: Partial<DishTags>) => onChange({ ...value, ...patch })

  return (
    <div className="space-y-5">
      <Row label="Diet" hint="needed for search">
        {DIETS.map((d) => (
          <Chip key={d} selected={value.diet === d} onClick={() => set({ diet: value.diet === d ? null : d })}>
            {tagLabel('diet', d)}
          </Chip>
        ))}
      </Row>

      <div>
        <p className="mb-2 font-anek text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
          Category<span className="ml-1.5 font-medium normal-case tracking-normal text-muted/80">· needed for search</span>
        </p>
        <div className="space-y-2.5">
          {CATEGORY_GROUPS.map((g) => (
            <div key={g.parent} className="flex flex-wrap items-center gap-1.5">
              <span className="w-[68px] font-anek text-[12px] text-muted">{g.label}</span>
              {g.leaves.map((leaf) => (
                <Chip key={leaf} selected={value.category === leaf} onClick={() => set({ category: value.category === leaf ? null : leaf })}>
                  {tagLabel('category', leaf)}
                </Chip>
              ))}
            </div>
          ))}
        </div>
      </div>

      <Row label="Cuisine" hint="optional">
        {CUISINES.map((c) => (
          <Chip key={c} selected={value.cuisine === c} onClick={() => set({ cuisine: value.cuisine === c ? null : c })}>
            {tagLabel('cuisine', c)}
          </Chip>
        ))}
      </Row>

      <Row label="Taste" hint="pick any">
        {TASTES.map((t) => (
          <Chip key={t} selected={value.tastes.includes(t)} onClick={() => set({ tastes: toggle(value.tastes, t) })}>
            {tagLabel('taste', t)}
          </Chip>
        ))}
      </Row>

      <Row label="Meal" hint="pick any">
        {MEALS.map((m) => (
          <Chip key={m} selected={value.meals.includes(m)} onClick={() => set({ meals: toggle(value.meals, m) })}>
            {tagLabel('meal', m)}
          </Chip>
        ))}
      </Row>
    </div>
  )
}
```

- [ ] **Step 3: Create `components/admin/SidePanel.tsx`**

```tsx
'use client'

import { useEffect, type ReactNode } from 'react'

/**
 * Right-hand slide-over; full screen below md. Esc/✕/backdrop call onClose — the
 * caller decides whether unsaved changes need a confirm().
 */
export default function SidePanel({
  open,
  title,
  subtitle,
  onClose,
  footer,
  children,
}: {
  open: boolean
  title: string
  subtitle?: string
  onClose: () => void
  footer?: ReactNode
  children: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} />
      <aside className="absolute inset-y-0 right-0 flex w-full flex-col bg-white shadow-2xl md:w-[480px] animate-[slidein_.18s_ease-out]">
        <header className="flex items-start justify-between gap-3 border-b border-warm-100 px-6 py-5">
          <div className="min-w-0">
            <h2 className="truncate font-anek text-xl font-bold text-charcoal">{title}</h2>
            {subtitle && <p className="truncate font-anek text-[13.5px] text-muted">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-muted hover:bg-warm-100 hover:text-charcoal">
            ✕
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && <footer className="border-t border-warm-100 bg-cream/60 px-6 py-4">{footer}</footer>}
      </aside>
    </div>
  )
}
```

Add the keyframes to `app/globals.css`, at the end:

```css
@keyframes slidein { from { transform: translateX(24px); opacity: 0 } to { transform: none; opacity: 1 } }
```

- [ ] **Step 4: Create `components/admin/Toast.tsx`**

```tsx
'use client'

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

const ToastContext = createContext<(text: string) => void>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [text, setText] = useState<string | null>(null)
  const toast = useCallback((t: string) => {
    setText(t)
    window.setTimeout(() => setText((cur) => (cur === t ? null : cur)), 2500)
  }, [])
  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed bottom-5 right-5 z-[60]">
        {text && (
          <div className="rounded-xl bg-ink px-4 py-3 font-anek text-[14px] font-medium text-[#fdf9f4] shadow-xl">✓ {text}</div>
        )}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
```

- [ ] **Step 5: Create `components/admin/CityTabs.tsx`**

```tsx
import Link from 'next/link'
import type { CityOption } from '@/lib/admin/types'

/** Server-renderable city switcher. Keeps every other query param, replaces `city`. */
export default function CityTabs({
  cities,
  current,
  basePath,
  params = {},
}: {
  cities: CityOption[]
  current: string
  basePath: string
  params?: Record<string, string | undefined>
}) {
  if (cities.length < 2) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      {cities.map((c) => {
        const qs = new URLSearchParams()
        for (const [k, v] of Object.entries(params)) if (v && k !== 'city') qs.set(k, v)
        qs.set('city', c.slug)
        const on = c.slug === current
        return (
          <Link
            key={c.slug}
            href={`${basePath}?${qs.toString()}`}
            aria-current={on ? 'page' : undefined}
            className={`rounded-full border px-3.5 py-1.5 font-anek text-[13px] font-medium ${
              on ? 'border-charcoal bg-charcoal text-white' : 'border-warm-200 bg-white text-charcoal hover:border-charcoal/40'
            }`}
          >
            {c.name}
          </Link>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 6: Create `components/admin/PasswordInput.tsx`**

```tsx
'use client'

import { useState, type InputHTMLAttributes } from 'react'
import { Input } from './ui'

export default function PasswordInput(props: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const [shown, setShown] = useState(false)
  return (
    <div className="relative">
      <Input {...props} type={shown ? 'text' : 'password'} className="pr-11" />
      <button
        type="button"
        onClick={() => setShown((s) => !s)}
        aria-pressed={shown}
        aria-label={shown ? 'Hide password' : 'Show password'}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted hover:text-charcoal"
      >
        {shown ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 5.1A9.7 9.7 0 0112 5c5 0 9 4.5 10 7-.4 1-1.2 2.3-2.4 3.5M6.1 6.1C4 7.5 2.6 9.6 2 12c1 2.5 5 7 10 7 1.6 0 3.1-.4 4.4-1.1" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M2 12c1-2.5 5-7 10-7s9 4.5 10 7c-1 2.5-5 7-10 7S3 14.5 2 12z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  )
}
```

- [ ] **Step 7: Verify and commit**

Run: `npx tsc --noEmit`
Expected: exit 0.

```bash
git add components/admin app/globals.css
git commit -m "Add admin building blocks: buttons, fields, tag picker, side panel, toast

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Login, forgot password, reset password, auth callback

**Files:**
- Rewrite: `app/admin/login/page.tsx`
- Create: `app/admin/login/LoginForm.tsx`, `components/admin/AuthLayout.tsx`, `app/admin/forgot-password/page.tsx`, `app/admin/reset-password/page.tsx`, `app/auth/callback/route.ts`
- Modify: `middleware.ts`

**Interfaces:**
- Consumes: `loginErrorMessage` and `loginNotice` (Task 1); `Button`, `Field`, `Input` and `PasswordInput` (Task 3).
- Produces: the routes `/admin/login`, `/admin/forgot-password`, `/admin/reset-password` and `/auth/callback`.

- [ ] **Step 1: Create `components/admin/AuthLayout.tsx`**

This is the split screen: an ink brand panel on large screens and a cream form side.

```tsx
import type { ReactNode } from 'react'

const WORDS = ['Thali', 'Biryani', 'Dosa', 'Brownie', 'Pav Bhaji', 'Shawarma', 'Chaat', 'Filter Coffee']

export default function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-cream">
      <section className="relative hidden w-[44%] overflow-hidden bg-ink lg:block">
        <div className="absolute inset-0" aria-hidden>
          {WORDS.map((w, i) => (
            <span
              key={w}
              className="absolute font-anek font-bold text-white/[0.06]"
              style={{ top: `${8 + i * 11}%`, left: `${(i * 37) % 70}%`, fontSize: `${36 + (i % 3) * 18}px` }}
            >
              {w}
            </span>
          ))}
        </div>
        <div className="relative flex h-full flex-col justify-between p-12">
          <div className="flex items-baseline">
            <span className="font-anek text-4xl font-extrabold tracking-tight text-ember-light">chakh</span>
            <span className="ml-1 h-2 w-2 rounded-full bg-ember" />
          </div>
          <div>
            <p className="font-anek text-[34px] font-bold leading-tight text-[#fdf9f4]">The honest food guide —<br />back office.</p>
            <p className="mt-3 font-anek text-[15px] text-sand">Score dishes, tag them for search, and keep the city&apos;s list honest.</p>
          </div>
        </div>
      </section>

      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-[400px]">
          <div className="mb-8 flex items-baseline lg:hidden">
            <span className="font-anek text-3xl font-extrabold tracking-tight text-ember">chakh</span>
            <span className="ml-1 h-2 w-2 rounded-full bg-ember" />
          </div>
          <h1 className="font-anek text-[28px] font-bold text-charcoal">{title}</h1>
          <p className="mb-7 mt-1 font-anek text-[15px] text-muted">{subtitle}</p>
          {children}
        </div>
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Rewrite the login page**

`app/admin/login/page.tsx` is a server wrapper that reads the query params:

```tsx
import AuthLayout from '@/components/admin/AuthLayout'
import { loginNotice } from '@/lib/admin/authMessages'
import LoginForm from './LoginForm'

export const metadata = { title: 'Sign in — Chakh admin' }

export default function AdminLoginPage({ searchParams }: { searchParams: { reset?: string; error?: string } }) {
  return (
    <AuthLayout title="Welcome back" subtitle="Sign in with your Chakh admin account.">
      <LoginForm notice={loginNotice(searchParams)} />
    </AuthLayout>
  )
}
```

`app/admin/login/LoginForm.tsx`:

```tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { loginErrorMessage } from '@/lib/admin/authMessages'
import { Button, Field, Input } from '@/components/admin/ui'
import PasswordInput from '@/components/admin/PasswordInput'

export default function LoginForm({ notice }: { notice: { tone: 'info' | 'error'; text: string } | null }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const { error } = await createClient().auth.signInWithPassword({ email: email.trim(), password })
      if (error) {
        setError(loginErrorMessage(error))
        setLoading(false)
        return
      }
      router.push('/admin')
      router.refresh()
    } catch (err) {
      setError(loginErrorMessage(err as Error))
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {notice && (
        <p role="status" className={`rounded-lg border px-4 py-3 font-anek text-[14px] ${
          notice.tone === 'error' ? 'border-[#f2c9bb] bg-[#fdf0ea] text-spice-dark' : 'border-[#bfe6d2] bg-[#eaf7f0] text-[#1f7a52]'
        }`}>
          {notice.text}
        </p>
      )}
      <Field label="Email" htmlFor="email">
        <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field label="Password" htmlFor="password">
        <PasswordInput id="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <div className="flex justify-end">
        <Link href="/admin/forgot-password" className="font-anek text-[14px] font-medium text-ember hover:underline">
          Forgot password?
        </Link>
      </div>
      {error && <p role="alert" className="rounded-lg bg-[#fdf0ea] px-4 py-3 font-anek text-[14px] text-spice-dark">{error}</p>}
      <Button type="submit" loading={loading} disabled={!email || !password} className="w-full py-3">
        {loading ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  )
}
```

- [ ] **Step 3: Create `app/admin/forgot-password/page.tsx`**

```tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import AuthLayout from '@/components/admin/AuthLayout'
import { Button, Field, Input } from '@/components/admin/ui'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await createClient().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/admin/reset-password`,
    })
    setLoading(false)
    // Never reveal whether the account exists: same message either way, except for
    // errors that are clearly not about the account (rate limits, network).
    if (error && !/not found|user/i.test(error.message)) {
      setError(error.message)
      return
    }
    setSent(true)
  }

  return (
    <AuthLayout title="Reset your password" subtitle="We'll email you a link to choose a new one.">
      {sent ? (
        <div className="space-y-5">
          <p role="status" className="rounded-lg border border-[#bfe6d2] bg-[#eaf7f0] px-4 py-3 font-anek text-[14.5px] text-[#1f7a52]">
            If an account exists for {email.trim()}, a reset link is on its way. Check your inbox (and spam).
          </p>
          <Link href="/admin/login" className="font-anek text-[14px] font-medium text-ember hover:underline">← Back to sign in</Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <Field label="Email" htmlFor="email">
            <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          {error && <p role="alert" className="rounded-lg bg-[#fdf0ea] px-4 py-3 font-anek text-[14px] text-spice-dark">{error}</p>}
          <Button type="submit" loading={loading} disabled={!email} className="w-full py-3">Send reset link</Button>
          <Link href="/admin/login" className="block text-center font-anek text-[14px] font-medium text-muted hover:text-charcoal">
            ← Back to sign in
          </Link>
        </form>
      )}
    </AuthLayout>
  )
}
```

- [ ] **Step 4: Create `app/auth/callback/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Lands the emailed password-reset link: swaps the one-time ?code= for a session
 * (cookies), then continues to `next`. Only /admin/* destinations are allowed, so the
 * link can't be turned into an open redirect.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const nextParam = url.searchParams.get('next') ?? '/admin'
  const next = nextParam.startsWith('/admin/') || nextParam === '/admin' ? nextParam : '/admin'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(new URL(next, url.origin))
    console.error('[auth] code exchange failed:', error.message)
  }
  return NextResponse.redirect(new URL('/admin/login?error=link', url.origin))
}
```

- [ ] **Step 5: Create `app/admin/reset-password/page.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AuthLayout from '@/components/admin/AuthLayout'
import { Button, Field } from '@/components/admin/ui'
import PasswordInput from '@/components/admin/PasswordInput'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 8) return setError('Use at least 8 characters.')
    if (password !== confirm) return setError("The two passwords don't match.")
    setLoading(true)
    const { error } = await createClient().auth.updateUser({ password })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    router.push('/admin?password=updated')
    router.refresh()
  }

  return (
    <AuthLayout title="Choose a new password" subtitle="You'll use it to sign in to the Chakh admin.">
      <form onSubmit={handleSubmit} className="space-y-5">
        <Field label="New password" htmlFor="pw" hint="At least 8 characters.">
          <PasswordInput id="pw" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Field label="Confirm password" htmlFor="pw2">
          <PasswordInput id="pw2" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </Field>
        {error && <p role="alert" className="rounded-lg bg-[#fdf0ea] px-4 py-3 font-anek text-[14px] text-spice-dark">{error}</p>}
        <Button type="submit" loading={loading} className="w-full py-3">Save password</Button>
      </form>
    </AuthLayout>
  )
}
```

`/admin/reset-password` is not public. The recovery session from `/auth/callback` signs the user in, so the middleware lets them through. Without a session, they go to login.

- [ ] **Step 6: Update the logic in `middleware.ts`**

Replace the `isLoginPage` block with:

```ts
  const path = request.nextUrl.pathname
  // Reachable signed-out. reset-password is NOT here: it needs the recovery session.
  const isPublic = path === '/admin/login' || path === '/admin/forgot-password'

  // Protect all /admin routes except the public auth pages
  if (path.startsWith('/admin') && !isPublic && !user) {
    return NextResponse.redirect(new URL('/admin/login', request.url))
  }

  // Already signed in? The login and forgot forms have nothing to offer.
  if (isPublic && user) {
    return NextResponse.redirect(new URL('/admin', request.url))
  }
```

- [ ] **Step 7: Verify**

Run: `npx tsc --noEmit`
Expected: exit 0.

**Controller-only browser check** (no credentials are entered):
- `/admin/login` renders the split layout at desktop width and the form only at 375px, with no horizontal scroll.
- The eye button toggles the password field's `type`.
- "Forgot password?" goes to `/admin/forgot-password`.
- `/admin/login?error=link` shows the expired-link notice.
- `/auth/callback` with no code redirects to `/admin/login?error=link`.
- `/admin/reset-password` while signed out redirects to `/admin/login`.

- [ ] **Step 8: Commit**

```bash
git add app/admin/login app/admin/forgot-password app/admin/reset-password app/auth components/admin/AuthLayout.tsx middleware.ts
git commit -m "Redesign admin login; add forgot and reset password flow

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: AdminShell + dashboard

**Files:**
- Create: `components/admin/AdminShell.tsx`
- Modify: `app/admin/layout.tsx`
- Rewrite: `app/admin/page.tsx`
- Delete: `app/admin/AdminNav.tsx`

**Interfaces:**
- Consumes: `ToastProvider`, `useToast`, `Button` and `EmptyState` (Task 3); `dishStatus` (Task 1); `isUntagged` (`@/lib/taxonomy`).
- Produces: the `AdminShell` layout used by every signed-in admin page. `?password=updated` on `/admin` shows a toast.

- [ ] **Step 1: Create `components/admin/AdminShell.tsx`**

```tsx
'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ToastProvider } from './Toast'

const NAV = [
  { href: '/admin', label: 'Dashboard', icon: '◧' },
  { href: '/admin/dishes', label: 'Dishes', icon: '🍽' },
  { href: '/admin/trending', label: 'On our list', icon: '🔥' },
  { href: '/admin/restaurants', label: 'Restaurants', icon: '🏪' },
]

function isActive(path: string, href: string) {
  return href === '/admin' ? path === '/admin' : path.startsWith(href)
}

export default function AdminShell({ email, children }: { email: string | null; children: ReactNode }) {
  const path = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)

  async function signOut() {
    await createClient().auth.signOut()
    router.push('/admin/login')
    router.refresh()
  }

  const sidebar = (
    <nav className="flex h-full flex-col bg-ink px-4 py-6 text-[#cdc2b8]">
      <Link href="/admin" className="mb-8 flex items-baseline px-2" onClick={() => setOpen(false)}>
        <span className="font-anek text-[26px] font-extrabold tracking-tight text-ember-light">chakh</span>
        <span className="ml-1 h-1.5 w-1.5 rounded-full bg-ember" />
        <span className="ml-2 font-anek text-[11px] font-bold uppercase tracking-[0.18em] text-sand">admin</span>
      </Link>
      <ul className="space-y-1">
        {NAV.map((n) => {
          const on = isActive(path, n.href)
          return (
            <li key={n.href}>
              <Link
                href={n.href}
                onClick={() => setOpen(false)}
                aria-current={on ? 'page' : undefined}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 font-anek text-[15px] font-medium transition-colors ${
                  on ? 'bg-ink-card text-ember-light' : 'hover:bg-ink-light hover:text-[#fdf9f4]'
                }`}
              >
                <span className="w-5 text-center" aria-hidden>{n.icon}</span>
                {n.label}
              </Link>
            </li>
          )
        })}
      </ul>
      <div className="mt-auto space-y-1 border-t border-white/[0.08] pt-4">
        <Link href="/" target="_blank" className="block rounded-lg px-3 py-2 font-anek text-[14px] hover:text-[#fdf9f4]">View site ↗</Link>
        {email && <p className="truncate px-3 font-anek text-[12px] text-sand-darker" title={email}>{email}</p>}
        <button type="button" onClick={signOut} className="w-full rounded-lg px-3 py-2 text-left font-anek text-[14px] hover:text-ember-light">
          Sign out
        </button>
      </div>
    </nav>
  )

  return (
    <ToastProvider>
      <div className="min-h-screen bg-cream md:flex">
        <aside className="sticky top-0 hidden h-screen w-[232px] shrink-0 md:block">{sidebar}</aside>

        <div className="flex items-center justify-between bg-ink px-4 py-3 md:hidden">
          <span className="font-anek text-xl font-extrabold text-ember-light">chakh <span className="text-[11px] uppercase tracking-[0.18em] text-sand">admin</span></span>
          <button type="button" onClick={() => setOpen(true)} aria-label="Open menu" className="rounded-lg px-2 py-1 text-[22px] text-[#fdf9f4]">☰</button>
        </div>
        {open && (
          <div className="fixed inset-0 z-50 md:hidden">
            <div className="absolute inset-0 bg-ink/50" onClick={() => setOpen(false)} />
            <div className="absolute inset-y-0 left-0 w-[260px]">{sidebar}</div>
          </div>
        )}

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 sm:py-8">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </ToastProvider>
  )
}
```

- [ ] **Step 2: Rewrite `app/admin/layout.tsx`**

```tsx
import AdminShell from '@/components/admin/AdminShell'
import { createClient } from '@/lib/supabase/server'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Signed out — login / forgot / reset render standalone, full screen.
  if (!user) return <>{children}</>

  return <AdminShell email={user.email ?? null}>{children}</AdminShell>
}
```

The reset-password page renders while signed in, inside the shell. That is acceptable, because the spec only requires that it works. Delete `app/admin/AdminNav.tsx`.

- [ ] **Step 3: Rewrite `app/admin/page.tsx` (the dashboard)**

```tsx
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { isUntagged } from '@/lib/taxonomy'
import { EmptyState } from '@/components/admin/ui'
import PasswordToast from './PasswordToast'

export default async function AdminDashboard({ searchParams }: { searchParams: { password?: string } }) {
  const supabase = await createClient()

  const [restaurantsRes, dishesRes, trendingRes, reviewsRes] = await Promise.all([
    supabase.from('restaurants').select('id, name, created_at, cities!inner(name)').is('deleted_at', null).order('created_at', { ascending: false }),
    supabase.from('dishes').select('id, score, diet, category').is('deleted_at', null),
    supabase.from('trending_dishes').select('id, diet, category').is('deleted_at', null).is('visited_dish_id', null),
    supabase
      .from('reviews')
      .select('id, rating, taste_notes, visit_date, testers(name), dishes(name, restaurants!inner(name))')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  const failed = [restaurantsRes, dishesRes, trendingRes, reviewsRes].find((r) => r.error)
  if (failed?.error) {
    console.error('[admin] dashboard query failed:', failed.error.message)
    return <EmptyState icon="⚠️" text="Couldn't load the dashboard — refresh to retry." />
  }

  const dishes = dishesRes.data ?? []
  const scored = dishes.filter((d: any) => d.score !== null).length
  const needsScore = dishes.length - scored
  const needsTags = dishes.filter((d: any) => isUntagged(d)).length
  const trending = trendingRes.data ?? []
  const trendingNeedsTags = trending.filter((t: any) => isUntagged(t)).length
  const restaurants = restaurantsRes.data ?? []

  const stats = [
    { label: 'Restaurants', value: String(restaurants.length), href: '/admin/restaurants' },
    { label: 'Dishes', value: String(dishes.length), href: '/admin/dishes' },
    { label: 'Scored', value: `${scored} / ${dishes.length}`, href: '/admin/dishes?tab=needs_score' },
    { label: 'On our list', value: String(trending.length), href: '/admin/trending' },
  ]

  const todo = [
    { n: needsScore, text: `${needsScore} ${needsScore === 1 ? 'dish needs' : 'dishes need'} a score`, href: '/admin/dishes?tab=needs_score' },
    { n: needsTags, text: `${needsTags} ${needsTags === 1 ? 'dish needs' : 'dishes need'} tags`, href: '/admin/dishes?tab=needs_tags' },
    { n: trendingNeedsTags, text: `${trendingNeedsTags} ${trendingNeedsTags === 1 ? 'place' : 'places'} on our list ${trendingNeedsTags === 1 ? 'needs' : 'need'} tags`, href: '/admin/trending' },
  ].filter((t) => t.n > 0)

  return (
    <div className="space-y-8">
      {searchParams.password === 'updated' && <PasswordToast />}
      <header>
        <h1 className="font-anek text-3xl font-bold text-charcoal">Dashboard</h1>
        <p className="font-anek text-[15px] text-muted">What&apos;s in Chakh, and what still needs you.</p>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="rounded-2xl border border-warm-200 bg-white p-5 transition-colors hover:border-ember/50">
            <p className="font-anek text-[11px] font-bold uppercase tracking-[0.14em] text-muted">{s.label}</p>
            <p className="mt-1 font-barlow text-4xl font-bold text-charcoal">{s.value}</p>
          </Link>
        ))}
      </section>

      <section className="rounded-2xl border border-warm-200 bg-white p-6">
        <h2 className="font-anek text-lg font-bold text-charcoal">Needs attention</h2>
        {todo.length === 0 ? (
          <p className="mt-2 font-anek text-[15px] text-[#1f7a52]">✓ All caught up.</p>
        ) : (
          <ul className="mt-3 divide-y divide-warm-100">
            {todo.map((t) => (
              <li key={t.href + t.text}>
                <Link href={t.href} className="flex items-center justify-between py-3 font-anek text-[15px] text-charcoal hover:text-ember">
                  <span><span className="mr-2 inline-block h-2 w-2 rounded-full bg-ember align-middle" />{t.text}</span>
                  <span aria-hidden>→</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-warm-200 bg-white p-6">
          <h2 className="mb-3 font-anek text-lg font-bold text-charcoal">Recent visits</h2>
          {(reviewsRes.data ?? []).length === 0 ? (
            <p className="font-anek text-[14px] text-muted">No visits logged yet.</p>
          ) : (
            <ul className="divide-y divide-warm-100">
              {(reviewsRes.data ?? []).map((r: any) => (
                <li key={r.id} className="py-3">
                  <p className="font-anek text-[15px] font-semibold text-charcoal">{r.dishes?.name}</p>
                  <p className="font-anek text-[13px] text-muted">
                    {r.dishes?.restaurants?.name} · {r.testers?.name ?? 'Tester'} · {r.visit_date}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="rounded-2xl border border-warm-200 bg-white p-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-anek text-lg font-bold text-charcoal">Recent restaurants</h2>
            <Link href="/admin/restaurants/new" className="font-anek text-[14px] font-semibold text-ember hover:underline">+ Add</Link>
          </div>
          <ul className="divide-y divide-warm-100">
            {restaurants.slice(0, 6).map((r: any) => (
              <li key={r.id}>
                <Link href={`/admin/restaurants/${r.id}`} className="flex items-center justify-between py-3 font-anek text-[15px] text-charcoal hover:text-ember">
                  <span>{r.name}</span>
                  <span className="text-[13px] text-muted">{r.cities?.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
```

Create `app/admin/PasswordToast.tsx`:

```tsx
'use client'

import { useEffect } from 'react'
import { useToast } from '@/components/admin/Toast'

export default function PasswordToast() {
  const toast = useToast()
  useEffect(() => { toast('Password updated') }, [toast])
  return null
}
```

If the `reviews` select fails because `reviews.deleted_at` doesn't exist, check migration 001: it adds `deleted_at` to reviews. Keep the filter.

- [ ] **Step 4: Verify and commit**

Run `npx tsc --noEmit` (expect exit 0) and `npm run build` (expect success).

```bash
git add components/admin/AdminShell.tsx app/admin/layout.tsx app/admin/page.tsx app/admin/PasswordToast.tsx
git rm app/admin/AdminNav.tsx
git commit -m "Add admin shell with sidebar and a needs-attention dashboard

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Dishes page + DishPanel

**Files:**
- Create: `components/admin/DishPanel.tsx`, `components/admin/DishList.tsx`, `app/admin/dishes/page.tsx`

**Interfaces:**
- Consumes:
  - Task 1: `AdminDish`, `CityOption`, `DishTags`, `EMPTY_TAGS`, `dishStatus`, `parseScore`, `pickCity`
  - Task 2: `createDish`, `updateDish`, `softDeleteDish`, `restoreDish`
  - Task 3: `SidePanel`, `TagPicker`, `Button`, `Field`, `Input`, `Textarea`, `Select`, `StatusBadge`, `EmptyState`, `useToast`, `CityTabs`
- Produces:
  - `DishPanel` props: `{ dish: AdminDish | null; restaurants: { id: string; name: string }[]; presetRestaurantId?: string; open: boolean; onClose: () => void; onSaved: (id: string) => void; onSaveNext?: () => void }`
  - `DishList` props: `{ dishes: AdminDish[]; restaurants: { id: string; name: string }[]; presetRestaurantId?: string; initialTab?: string; showTabs?: boolean }`
  - Task 7 reuses both components on the restaurant page.

- [ ] **Step 1: Create `components/admin/DishPanel.tsx`**

```tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { createDish, restoreDish, softDeleteDish, updateDish } from '@/app/actions/dishes'
import { EMPTY_TAGS, type DishTags } from '@/lib/admin/dishTags'
import { parseScore } from '@/lib/admin/score'
import type { AdminDish } from '@/lib/admin/types'
import SidePanel from './SidePanel'
import TagPicker from './TagPicker'
import { Button, Field, Input, Select, Textarea } from './ui'
import { useToast } from './Toast'

type Form = {
  restaurant_id: string
  name: string
  description: string
  score: string
  is_must_try: boolean
  photo_url: string | null
  tags: DishTags
}

function formFrom(dish: AdminDish | null, presetRestaurantId?: string): Form {
  if (!dish) return { restaurant_id: presetRestaurantId ?? '', name: '', description: '', score: '', is_must_try: false, photo_url: null, tags: EMPTY_TAGS }
  return {
    restaurant_id: dish.restaurant_id,
    name: dish.name,
    description: dish.description ?? '',
    score: dish.score === null ? '' : String(dish.score),
    is_must_try: dish.is_must_try,
    photo_url: dish.photo_url,
    tags: { diet: dish.diet, category: dish.category, cuisine: dish.cuisine, tastes: dish.tastes, meals: dish.meals },
  }
}

export default function DishPanel({
  dish, restaurants, presetRestaurantId, open, onClose, onSaved, onSaveNext,
}: {
  dish: AdminDish | null
  restaurants: { id: string; name: string }[]
  presetRestaurantId?: string
  open: boolean
  onClose: () => void
  onSaved: (id: string) => void
  onSaveNext?: () => void
}) {
  const router = useRouter()
  const toast = useToast()
  const initial = useMemo(() => formFrom(dish, presetRestaurantId), [dish, presetRestaurantId])
  const [form, setForm] = useState<Form>(initial)
  const [photo, setPhoto] = useState<File | null>(null)
  const [busy, setBusy] = useState<null | 'save' | 'next' | 'delete'>(null)
  const [error, setError] = useState('')

  useEffect(() => { setForm(initial); setPhoto(null); setError('') }, [initial])

  const dirty = photo !== null || JSON.stringify(form) !== JSON.stringify(initial)
  const isNew = dish === null

  function close() {
    if (dirty && !window.confirm('Discard your unsaved changes?')) return
    onClose()
  }

  async function uploadPhoto(restaurantId: string): Promise<string | null> {
    if (!photo) return form.photo_url
    const supabase = createClient()
    const ext = photo.name.split('.').pop()
    const path = `dishes/${restaurantId}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('dish-photos').upload(path, photo)
    if (error) throw new Error(`Photo upload failed: ${error.message}`)
    return supabase.storage.from('dish-photos').getPublicUrl(path).data.publicUrl
  }

  async function save(mode: 'save' | 'next') {
    setBusy(mode)
    setError('')
    try {
      const score = parseScore(form.score)
      if (!form.restaurant_id) throw new Error('Pick a restaurant')
      const photo_url = await uploadPhoto(form.restaurant_id)
      const fields = {
        name: form.name,
        description: form.description.trim() || null,
        is_must_try: form.is_must_try,
        score,
        photo_url,
        ...form.tags,
      }
      const id = isNew
        ? (await createDish({ restaurant_id: form.restaurant_id, ...fields })).id
        : (await updateDish(dish.id, fields), dish.id)
      toast('Saved')
      router.refresh()
      onSaved(id)
      if (mode === 'next' && onSaveNext) onSaveNext()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(null)
    }
  }

  async function toggleDeleted() {
    if (!dish) return
    if (!dish.deleted_at && !window.confirm(`Delete "${dish.name}"? You can restore it from the Deleted tab.`)) return
    setBusy('delete')
    try {
      await (dish.deleted_at ? restoreDish(dish.id) : softDeleteDish(dish.id))
      toast(dish.deleted_at ? 'Restored' : 'Deleted')
      router.refresh()
      onClose()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const restaurantName = restaurants.find((r) => r.id === form.restaurant_id)?.name

  return (
    <SidePanel
      open={open}
      onClose={close}
      title={isNew ? 'Add a dish' : form.name || 'Untitled dish'}
      subtitle={restaurantName}
      footer={
        <div className="space-y-3">
          {error && <p role="alert" className="font-anek text-[13.5px] text-spice">{error}</p>}
          <div className="flex items-center gap-2">
            {!isNew && (
              <Button variant="danger" type="button" loading={busy === 'delete'} onClick={toggleDeleted}>
                {dish.deleted_at ? 'Restore' : 'Delete'}
              </Button>
            )}
            <div className="ml-auto flex gap-2">
              <Button variant="secondary" type="button" loading={busy === 'save'} disabled={busy !== null} onClick={() => save('save')}>Save</Button>
              {onSaveNext && (
                <Button type="button" loading={busy === 'next'} disabled={busy !== null} onClick={() => save('next')}>Save &amp; next →</Button>
              )}
            </div>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        {isNew && !presetRestaurantId && (
          <Field label="Restaurant" htmlFor="restaurant">
            <Select id="restaurant" value={form.restaurant_id} onChange={(e) => setForm({ ...form, restaurant_id: e.target.value })}>
              <option value="">Choose a restaurant…</option>
              {restaurants.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </Select>
          </Field>
        )}
        <Field label="Dish name" htmlFor="name">
          <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <div className="grid grid-cols-[1fr_auto] items-end gap-4">
          <Field label="Score" htmlFor="score" hint="0–10. Blank keeps it out of rankings.">
            <Input id="score" inputMode="decimal" placeholder="e.g. 8.5" value={form.score} onChange={(e) => setForm({ ...form, score: e.target.value })} />
          </Field>
          <label className="mb-7 flex cursor-pointer items-center gap-2 font-anek text-[14px] text-charcoal">
            <input type="checkbox" className="h-4 w-4 accent-[#d9482b]" checked={form.is_must_try} onChange={(e) => setForm({ ...form, is_must_try: e.target.checked })} />
            🏅 Must try
          </label>
        </div>
        <Field label="Description" htmlFor="desc">
          <Textarea id="desc" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Field>
        <Field label="Photo" htmlFor="photo">
          <div className="flex items-center gap-3">
            {(photo || form.photo_url) && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo ? URL.createObjectURL(photo) : form.photo_url!} alt="" className="h-16 w-16 rounded-lg object-cover" />
            )}
            <input id="photo" type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
              className="min-w-0 flex-1 font-anek text-[13px] text-muted file:mr-3 file:rounded-full file:border-0 file:bg-warm-100 file:px-3 file:py-1.5 file:font-semibold file:text-charcoal" />
            {(photo || form.photo_url) && (
              <button type="button" className="font-anek text-[13px] text-muted hover:text-spice" onClick={() => { setPhoto(null); setForm({ ...form, photo_url: null }) }}>
                Remove
              </button>
            )}
          </div>
        </Field>
        <div className="border-t border-warm-100 pt-5">
          <TagPicker value={form.tags} onChange={(tags) => setForm({ ...form, tags })} />
        </div>
      </div>
    </SidePanel>
  )
}
```

- [ ] **Step 2: Create `components/admin/DishList.tsx`**

```tsx
'use client'

import { useMemo, useState } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { dishStatus } from '@/lib/admin/dishStatus'
import type { AdminDish } from '@/lib/admin/types'
import DishPanel from './DishPanel'
import { Button, EmptyState, Input, StatusBadge } from './ui'
import { useToast } from './Toast'

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'needs_score', label: 'Needs score' },
  { key: 'needs_tags', label: 'Needs tags' },
  { key: 'deleted', label: 'Deleted' },
] as const
type TabKey = (typeof TABS)[number]['key']

function inTab(d: AdminDish, tab: TabKey): boolean {
  if (tab === 'deleted') return d.deleted_at !== null
  if (d.deleted_at) return false
  if (tab === 'needs_score') return d.score === null
  if (tab === 'needs_tags') return dishStatus(d) === 'needs_tags'
  return true
}

export default function DishList({
  dishes, restaurants, presetRestaurantId, initialTab = 'all', showTabs = true,
}: {
  dishes: AdminDish[]
  restaurants: { id: string; name: string }[]
  presetRestaurantId?: string
  initialTab?: string
  showTabs?: boolean
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const tab: TabKey = (TABS.some((t) => t.key === initialTab) ? initialTab : 'all') as TabKey
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState<string | 'new' | null>(null)

  const counts = useMemo(
    () => Object.fromEntries(TABS.map((t) => [t.key, dishes.filter((d) => inTab(d, t.key)).length])) as Record<TabKey, number>,
    [dishes]
  )
  const visible = dishes
    .filter((d) => inTab(d, tab))
    .filter((d) => d.name.toLowerCase().includes(query.trim().toLowerCase()))

  const current = openId && openId !== 'new' ? dishes.find((d) => d.id === openId) ?? null : null

  function setTab(key: TabKey) {
    const qs = new URLSearchParams(params.toString())
    qs.set('tab', key)
    router.replace(`${pathname}?${qs.toString()}`, { scroll: false })
  }

  // `visible` is the list as it was when the panel opened (the refresh after saving
  // lands later), so "next" is simply the following row.
  function openNext() {
    const idx = visible.findIndex((d) => d.id === openId)
    const next = visible[idx + 1]
    if (next) setOpenId(next.id)
    else {
      setOpenId(null)
      toast('That was the last one')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {showTabs && TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            aria-current={tab === t.key ? 'page' : undefined}
            className={`rounded-full border px-3.5 py-1.5 font-anek text-[13.5px] font-medium ${
              tab === t.key ? 'border-charcoal bg-charcoal text-white' : 'border-warm-200 bg-white text-charcoal hover:border-charcoal/40'
            }`}
          >
            {t.label}
            <span className={`ml-1.5 rounded-full px-1.5 text-[11px] ${t.key !== 'all' && t.key !== 'deleted' && counts[t.key] > 0 ? 'bg-ember text-white' : 'text-muted'}`}>
              {counts[t.key]}
            </span>
          </button>
        ))}
        <div className="ml-auto flex w-full gap-2 sm:w-auto">
          <Input placeholder="Filter by name…" value={query} onChange={(e) => setQuery(e.target.value)} className="sm:w-56" aria-label="Filter dishes by name" />
          <Button type="button" onClick={() => setOpenId('new')} className="whitespace-nowrap">+ Add dish</Button>
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState icon={tab === 'all' ? '🍽️' : '✓'} text={tab === 'all' ? 'No dishes yet.' : 'Nothing here — all caught up.'} />
      ) : (
        <ul className="overflow-hidden rounded-2xl border border-warm-200 bg-white">
          {visible.map((d) => (
            <li key={d.id} className="border-t border-warm-100 first:border-t-0">
              <button
                type="button"
                onClick={() => setOpenId(d.id)}
                className={`flex w-full min-w-0 items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-[#fdf6f2] ${openId === d.id ? 'bg-[#fdf0ea]' : ''}`}
              >
                {d.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={d.photo_url} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover" />
                ) : (
                  <div className="h-11 w-11 shrink-0 rounded-lg" style={{ background: 'repeating-linear-gradient(135deg,#ece7dd 0 7px,#e2dcd1 7px 14px)' }} />
                )}
                <div className="min-w-0 flex-1">
                  <p className={`truncate font-anek text-[15.5px] font-semibold ${d.deleted_at ? 'text-muted line-through' : 'text-charcoal'}`}>{d.name}</p>
                  <p className="truncate font-anek text-[13px] text-muted">{d.restaurant_name}</p>
                </div>
                <StatusBadge status={dishStatus(d)} />
                <span className="w-10 text-right font-barlow text-xl font-bold text-charcoal">{d.score === null ? '—' : d.score.toFixed(1)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <DishPanel
        open={openId !== null}
        dish={current}
        restaurants={restaurants}
        presetRestaurantId={presetRestaurantId}
        onClose={() => setOpenId(null)}
        // A new dish isn't in `dishes` until the refresh lands, so close rather than
        // re-open it as a blank form.
        onSaved={() => { if (openId === 'new') setOpenId(null) }}
        onSaveNext={openId === 'new' ? undefined : openNext}
      />
    </div>
  )
}
```

- [ ] **Step 3: Create `app/admin/dishes/page.tsx`**

```tsx
import { createClient } from '@/lib/supabase/server'
import { pickCity } from '@/lib/admin/city'
import type { AdminDish, CityOption } from '@/lib/admin/types'
import CityTabs from '@/components/admin/CityTabs'
import DishList from '@/components/admin/DishList'
import { EmptyState } from '@/components/admin/ui'

export const metadata = { title: 'Dishes — Chakh admin' }

export default async function AdminDishesPage({ searchParams }: { searchParams: { city?: string; tab?: string } }) {
  const supabase = await createClient()
  const { data: cities, error: citiesError } = await supabase.from('cities').select('id, name, slug').order('name')
  if (citiesError) {
    console.error('[admin] cities query failed:', citiesError.message)
    return <EmptyState icon="⚠️" text="Couldn't load cities — refresh to retry." />
  }
  const city = pickCity((cities ?? []).map((c) => c.slug), searchParams.city)
  if (!city) return <EmptyState text="Add a city first." />

  const [dishesRes, restaurantsRes] = await Promise.all([
    supabase
      .from('dishes')
      .select('id, name, description, photo_url, is_must_try, score, diet, category, cuisine, tastes, meals, deleted_at, restaurant_id, restaurants!inner(name, deleted_at, cities!inner(slug))')
      .eq('restaurants.cities.slug', city)
      .is('restaurants.deleted_at', null)
      .order('name'),
    supabase.from('restaurants').select('id, name, cities!inner(slug)').eq('cities.slug', city).is('deleted_at', null).order('name'),
  ])
  if (dishesRes.error || restaurantsRes.error) {
    console.error('[admin] dishes query failed:', dishesRes.error?.message ?? restaurantsRes.error?.message)
    return <EmptyState icon="⚠️" text="Couldn't load dishes — refresh to retry." />
  }

  const dishes: AdminDish[] = (dishesRes.data ?? []).map((d: any) => ({
    id: d.id,
    name: d.name,
    description: d.description,
    photo_url: d.photo_url,
    is_must_try: !!d.is_must_try,
    score: d.score === null ? null : Number(d.score),
    deleted_at: d.deleted_at,
    restaurant_id: d.restaurant_id,
    restaurant_name: d.restaurants.name,
    diet: d.diet,
    category: d.category,
    cuisine: d.cuisine,
    tastes: d.tastes ?? [],
    meals: d.meals ?? [],
  }))

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-anek text-3xl font-bold text-charcoal">Dishes</h1>
          <p className="font-anek text-[15px] text-muted">Score and tag every dish so search can find it.</p>
        </div>
        <CityTabs cities={cities as CityOption[]} current={city} basePath="/admin/dishes" params={{ tab: searchParams.tab }} />
      </header>
      <DishList
        key={city}
        dishes={dishes}
        restaurants={(restaurantsRes.data ?? []).map((r: any) => ({ id: r.id, name: r.name }))}
        initialTab={searchParams.tab}
      />
    </div>
  )
}
```

`DishList` uses `useSearchParams`. If `npm run build` complains about a missing Suspense boundary, wrap `<DishList …/>` in `<Suspense>` from `react`.

- [ ] **Step 4: Verify and commit**

Run `npx tsc --noEmit` (expect exit 0) and `npm run build` (expect success).

```bash
git add components/admin/DishPanel.tsx components/admin/DishList.tsx app/admin/dishes/page.tsx
git commit -m "Add Dishes admin page with side-panel editing, tags and Save & next

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Restaurants list + restyled restaurant pages

**Files:**
- Create: `app/admin/restaurants/page.tsx`
- Modify: `app/admin/restaurants/[id]/page.tsx`, `app/admin/restaurants/[id]/RestaurantActions.tsx`, `app/admin/restaurants/[id]/ReviewActions.tsx`, `app/admin/restaurants/new/page.tsx`, `app/admin/dishes/[id]/review/page.tsx`
- Delete: `app/admin/restaurants/[id]/AddDishForm.tsx`, `app/admin/restaurants/[id]/DishActions.tsx`

**Interfaces:**
- Consumes: `DishList` and `AdminDish` (Task 6); `CityTabs`, `Button`, `Field`, `Input`, `Textarea`, `Select`, `Chip` and `EmptyState` (Task 3); `pickCity` and `CityOption` (Task 1).

- [ ] **Step 1: Create `app/admin/restaurants/page.tsx`**

```tsx
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { pickCity } from '@/lib/admin/city'
import { priceTierSymbol } from '@/lib/dishScore'
import type { CityOption } from '@/lib/admin/types'
import CityTabs from '@/components/admin/CityTabs'
import { EmptyState } from '@/components/admin/ui'

export const metadata = { title: 'Restaurants — Chakh admin' }

export default async function AdminRestaurantsPage({ searchParams }: { searchParams: { city?: string; deleted?: string } }) {
  const supabase = await createClient()
  const { data: cities, error: cErr } = await supabase.from('cities').select('id, name, slug').order('name')
  if (cErr) {
    console.error('[admin] cities query failed:', cErr.message)
    return <EmptyState icon="⚠️" text="Couldn't load cities — refresh to retry." />
  }
  const city = pickCity((cities ?? []).map((c) => c.slug), searchParams.city)
  if (!city) return <EmptyState text="Add a city first." />
  const showDeleted = searchParams.deleted === '1'

  const { data, error } = await supabase
    .from('restaurants')
    .select('id, name, address, price_range, deleted_at, cities!inner(slug), dishes(id, deleted_at)')
    .eq('cities.slug', city)
    .order('name')
  if (error) {
    console.error('[admin] restaurants query failed:', error.message)
    return <EmptyState icon="⚠️" text="Couldn't load restaurants — refresh to retry." />
  }
  const rows = (data ?? []).filter((r: any) => showDeleted || !r.deleted_at)

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-anek text-3xl font-bold text-charcoal">Restaurants</h1>
          <p className="font-anek text-[15px] text-muted">Places we&apos;ve been. Open one to edit it and its dishes.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <CityTabs cities={cities as CityOption[]} current={city} basePath="/admin/restaurants" params={{ deleted: searchParams.deleted }} />
          <Link href="/admin/restaurants/new" className="rounded-lg bg-ember px-4 py-2.5 font-anek text-[14px] font-semibold text-white">+ Add restaurant</Link>
        </div>
      </header>
      <Link
        href={`/admin/restaurants?city=${city}${showDeleted ? '' : '&deleted=1'}`}
        className="inline-block font-anek text-[13.5px] text-muted hover:text-charcoal"
      >
        {showDeleted ? 'Hide deleted' : 'Show deleted'}
      </Link>
      {rows.length === 0 ? (
        <EmptyState icon="🏪" text="No restaurants in this city yet." />
      ) : (
        <ul className="overflow-hidden rounded-2xl border border-warm-200 bg-white">
          {rows.map((r: any) => {
            const live = (r.dishes ?? []).filter((d: any) => !d.deleted_at).length
            return (
              <li key={r.id} className="border-t border-warm-100 first:border-t-0">
                <Link href={`/admin/restaurants/${r.id}`} className="flex min-w-0 items-center gap-4 px-4 py-3.5 hover:bg-[#fdf6f2]">
                  <div className="min-w-0 flex-1">
                    <p className={`truncate font-anek text-[15.5px] font-semibold ${r.deleted_at ? 'text-muted line-through' : 'text-charcoal'}`}>{r.name}</p>
                    <p className="truncate font-anek text-[13px] text-muted">{r.address?.split(',')[0]}</p>
                  </div>
                  <span className="font-anek text-[13px] text-muted">{live} {live === 1 ? 'dish' : 'dishes'}</span>
                  <span className="w-10 text-right font-anek text-[14px] text-charcoal">{priceTierSymbol(r.price_range)}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Rewrite the dish section of `app/admin/restaurants/[id]/page.tsx`**

1. Keep the restaurant query. Add `score, diet, category, cuisine, tastes, meals` to the dishes it selects: `dishes(*, reviews(*, testers(name)))` already includes them via `*`.
2. Header:
   - "← Restaurants" links to `/admin/restaurants?city=<slug>`
   - the h1 is `font-anek text-3xl font-bold text-charcoal`
   - the address is `text-muted`
   - "View public page ↗" uses `text-ember`
3. Keep `<RestaurantActions …/>` as it is (it's restyled in Step 3).
4. Replace the whole two-column "Add a Dish" / "Dishes" block with a single section:
   - `<h2>` "Dishes"
   - `<DishList dishes={adminDishes} restaurants={[{ id: restaurant.id, name: restaurant.name }]} presetRestaurantId={restaurant.id} showTabs={false} />`
   - build `adminDishes: AdminDish[]` from `restaurant.dishes`, using the same mapping as Task 6 Step 3, with `restaurant_name: restaurant.name`
   - wrap `DishList` in `<Suspense>`
5. Below it, add a section **"Visits"**. List each dish that has reviews, with that dish's `ReviewActions`, and keep the "+ Log a visit" link to `/admin/dishes/${dish.id}/review` for non-deleted dishes.
6. Delete `AddDishForm.tsx` and `DishActions.tsx` and remove their imports.

- [ ] **Step 3: Restyle `RestaurantActions.tsx`, `ReviewActions.tsx`, `restaurants/new/page.tsx` and `dishes/[id]/review/page.tsx`**

Don't change their logic. Only swap the markup for the building blocks:

| Old pattern | New |
|---|---|
| `<input className="w-full border border-gray-200 rounded-xl …">` | `<Input …>` (same props) |
| `<textarea …>` | `<Textarea …>` |
| `<select …>` | `<Select …>` |
| `<label className="block text-sm font-medium text-gray-700 mb-1">X</label>` + control | `<Field label="X">control</Field>` |
| orange submit/save buttons | `<Button>` (primary) |
| delete buttons | `<Button variant="danger">` |
| cancel/secondary buttons | `<Button variant="secondary">` |
| cuisine toggle pills (`bg-orange-500` when on) | `<Chip selected={…} onClick={…}>` |
| cards `bg-white rounded-2xl border border-gray-200 shadow-sm p-5` | `rounded-2xl border border-warm-200 bg-white p-6` |
| `text-gray-500` / `text-gray-400` | `text-muted` |
| `text-orange-600` links | `text-ember` |
| page `<h1 className="text-2xl font-bold …">` | `font-anek text-3xl font-bold text-charcoal` |
| error text `text-red-500` | `text-spice` |

`restaurants/new/page.tsx` and `dishes/[id]/review/page.tsx` are client components, so import from `@/components/admin/ui`. Keep the Google Places autocomplete logic exactly as it is.

- [ ] **Step 4: Verify and commit**

Run `grep -rn "AddDishForm\|DishActions\|AdminNav" app components`. Expected: no matches.

Run `npx tsc --noEmit` (expect exit 0) and `npm run build` (expect success).

```bash
git add app/admin
git commit -m "Restaurants list and restyled restaurant, new-restaurant and visit pages

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: On our list admin

**Files:**
- Create: `components/admin/TrendingPanel.tsx`, `components/admin/TrendingList.tsx`, `app/admin/trending/page.tsx`

**Interfaces:**
- Consumes:
  - Task 1: `AdminTrending`, `CityOption`, `DishTags`, `EMPTY_TAGS`, `pickCity`, and `isUntagged` (`@/lib/taxonomy`)
  - Task 2: `createTrending`, `updateTrending`, `softDeleteTrending`, `restoreTrending`, `markTrendingVisited`, `TrendingInput`
  - Task 3: `SidePanel`, `TagPicker`, the `ui` blocks, `useToast`, `CityTabs`
- Produces: the `/admin/trending` route.

- [ ] **Step 1: Create `components/admin/TrendingPanel.tsx`**

The panel follows the same structure as `DishPanel` (Task 6 Step 1): form state, the dirty check with `confirm()`, an error line above the footer, and `toast('Saved')` plus `router.refresh()` after a save.

```tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  createTrending, markTrendingVisited, restoreTrending, softDeleteTrending, updateTrending,
} from '@/app/actions/trending'
import { EMPTY_TAGS, type DishTags } from '@/lib/admin/dishTags'
import type { AdminTrending } from '@/lib/admin/types'
import SidePanel from './SidePanel'
import TagPicker from './TagPicker'
import { Button, Field, Input, Select, Textarea } from './ui'
import { useToast } from './Toast'

type Form = {
  dish_name: string; place_name: string; area: string; why: string; source_url: string
  restaurant_id: string; rank: string; buzz: number; photo_url: string | null; tags: DishTags
}

function formFrom(t: AdminTrending | null): Form {
  if (!t) return { dish_name: '', place_name: '', area: '', why: '', source_url: '', restaurant_id: '', rank: '0', buzz: 1, photo_url: null, tags: EMPTY_TAGS }
  return {
    dish_name: t.dish_name, place_name: t.place_name, area: t.area ?? '', why: t.why, source_url: t.source_url ?? '',
    restaurant_id: t.restaurant_id ?? '', rank: String(t.rank), buzz: t.buzz, photo_url: t.photo_url,
    tags: { diet: t.diet, category: t.category, cuisine: t.cuisine, tastes: t.tastes, meals: t.meals },
  }
}

export default function TrendingPanel({
  entry, cityId, restaurants, dishes, open, onClose,
}: {
  entry: AdminTrending | null
  cityId: string
  restaurants: { id: string; name: string }[]
  dishes: { id: string; name: string; restaurant_name: string }[]
  open: boolean
  onClose: () => void
}) {
  const router = useRouter()
  const toast = useToast()
  const initial = useMemo(() => formFrom(entry), [entry])
  const [form, setForm] = useState<Form>(initial)
  const [photo, setPhoto] = useState<File | null>(null)
  const [visitDish, setVisitDish] = useState('')
  const [busy, setBusy] = useState<null | 'save' | 'delete' | 'visit'>(null)
  const [error, setError] = useState('')

  useEffect(() => { setForm(initial); setPhoto(null); setVisitDish(''); setError('') }, [initial])

  const dirty = photo !== null || JSON.stringify(form) !== JSON.stringify(initial)
  const isNew = entry === null

  function close() {
    if (dirty && !window.confirm('Discard your unsaved changes?')) return
    onClose()
  }

  async function run(kind: 'save' | 'delete' | 'visit', fn: () => Promise<void>, done: string) {
    setBusy(kind); setError('')
    try { await fn(); toast(done); router.refresh(); onClose() }
    catch (err) { setError((err as Error).message) }
    finally { setBusy(null) }
  }

  async function save() {
    await run('save', async () => {
      let photo_url = form.photo_url
      if (photo) {
        const supabase = createClient()
        const path = `trending/${cityId}/${Date.now()}.${photo.name.split('.').pop()}`
        const { error } = await supabase.storage.from('dish-photos').upload(path, photo)
        if (error) throw new Error(`Photo upload failed: ${error.message}`)
        photo_url = supabase.storage.from('dish-photos').getPublicUrl(path).data.publicUrl
      }
      const rank = Number(form.rank)
      if (!Number.isInteger(rank)) throw new Error('Rank must be a whole number')
      const data = {
        dish_name: form.dish_name.trim(), place_name: form.place_name.trim(), city_id: cityId,
        restaurant_id: form.restaurant_id || null, area: form.area.trim() || null, why: form.why.trim(),
        source_url: form.source_url.trim() || null, photo_url, rank, buzz: form.buzz, ...form.tags,
      }
      if (isNew) await createTrending(data)
      else await updateTrending(entry.id, data)
    }, 'Saved')
  }

  return (
    <SidePanel
      open={open}
      onClose={close}
      title={isNew ? 'Add a place' : `${form.dish_name} @ ${form.place_name}`}
      subtitle="On our list · never scored"
      footer={
        <div className="space-y-3">
          {error && <p role="alert" className="font-anek text-[13.5px] text-spice">{error}</p>}
          {!isNew && !entry.visited_dish_id && !entry.deleted_at && (
            <div className="flex gap-2">
              <Select aria-label="Dish we reviewed" value={visitDish} onChange={(e) => setVisitDish(e.target.value)}>
                <option value="">We visited — pick the dish we reviewed…</option>
                {dishes.map((d) => <option key={d.id} value={d.id}>{d.name} · {d.restaurant_name}</option>)}
              </Select>
              <Button variant="secondary" type="button" disabled={!visitDish || busy !== null} loading={busy === 'visit'}
                onClick={() => run('visit', () => markTrendingVisited(entry.id, visitDish), 'Marked visited')}>
                Mark visited
              </Button>
            </div>
          )}
          <div className="flex items-center gap-2">
            {!isNew && (
              <Button variant="danger" type="button" loading={busy === 'delete'}
                onClick={() => {
                  if (!entry.deleted_at && !window.confirm('Remove this place from the list?')) return
                  run('delete', () => (entry.deleted_at ? restoreTrending(entry.id) : softDeleteTrending(entry.id)), entry.deleted_at ? 'Restored' : 'Deleted')
                }}>
                {entry.deleted_at ? 'Restore' : 'Delete'}
              </Button>
            )}
            <Button className="ml-auto" type="button" loading={busy === 'save'} disabled={busy !== null} onClick={save}>Save</Button>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Dish" htmlFor="t-dish"><Input id="t-dish" value={form.dish_name} onChange={(e) => setForm({ ...form, dish_name: e.target.value })} /></Field>
          <Field label="Place" htmlFor="t-place"><Input id="t-place" value={form.place_name} onChange={(e) => setForm({ ...form, place_name: e.target.value })} /></Field>
        </div>
        <Field label="Area" htmlFor="t-area"><Input id="t-area" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} /></Field>
        <Field label="Why it's buzzing" htmlFor="t-why" hint="Shown on the card. Required.">
          <Textarea id="t-why" rows={2} value={form.why} onChange={(e) => setForm({ ...form, why: e.target.value })} />
        </Field>
        <Field label="Buzz">
          <div className="inline-flex overflow-hidden rounded-lg border border-warm-200" role="radiogroup" aria-label="Buzz">
            {[1, 2, 3].map((n) => (
              <button key={n} type="button" role="radio" aria-checked={form.buzz === n} onClick={() => setForm({ ...form, buzz: n })}
                className={`px-4 py-2 font-anek text-[15px] ${form.buzz === n ? 'bg-ember text-white' : 'bg-white hover:bg-warm-100'}`}>
                {'🔥'.repeat(n)}
              </button>
            ))}
          </div>
        </Field>
        <div className="grid grid-cols-[1fr_96px] gap-3">
          <Field label="Seen on (link)" htmlFor="t-src"><Input id="t-src" placeholder="https://…" value={form.source_url} onChange={(e) => setForm({ ...form, source_url: e.target.value })} /></Field>
          <Field label="Rank" htmlFor="t-rank" hint="Lower first"><Input id="t-rank" inputMode="numeric" value={form.rank} onChange={(e) => setForm({ ...form, rank: e.target.value })} /></Field>
        </div>
        <Field label="We have this restaurant" htmlFor="t-rest" hint="Optional — links the card to our page.">
          <Select id="t-rest" value={form.restaurant_id} onChange={(e) => setForm({ ...form, restaurant_id: e.target.value })}>
            <option value="">Not yet</option>
            {restaurants.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </Select>
        </Field>
        <Field label="Photo" htmlFor="t-photo">
          <input id="t-photo" type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
            className="w-full font-anek text-[13px] text-muted file:mr-3 file:rounded-full file:border-0 file:bg-warm-100 file:px-3 file:py-1.5 file:font-semibold file:text-charcoal" />
        </Field>
        <div className="border-t border-warm-100 pt-5">
          <TagPicker value={form.tags} onChange={(tags) => setForm({ ...form, tags })} />
        </div>
      </div>
    </SidePanel>
  )
}
```

- [ ] **Step 2: Create `components/admin/TrendingList.tsx`**

It is laid out like `DishList`, with these differences:
- **Tabs:** `live` (`!deleted_at && !visited_dish_id`), `visited` (`visited_dish_id !== null && !deleted_at`) and `deleted`. Each shows its count, and they are driven by `?tab=` exactly as in DishList's `setTab`.
- **Header button:** "+ Add place". There's no name filter.
- **Each row** is a button that opens `TrendingPanel`, showing:
  - `🔥`.repeat(buzz) in a `w-14` cell
  - dish name (semibold, truncate) with `{place_name}{area ? ' · ' + area : ''}` (muted)
  - a `StatusBadge status="needs_tags"` when `isUntagged(t)`
  - `#{rank}` (muted)
- **Empty states:**
  - live: `EmptyState icon="🔥" text="Nothing on the list. Add a place the city is talking about."`
  - other tabs: `"Nothing here."`

Props:

```ts
{
  entries: AdminTrending[]
  cityId: string
  restaurants: { id: string; name: string }[]
  dishes: { id: string; name: string; restaurant_name: string }[]
  initialTab?: string
}
```

It passes `entry`, `cityId`, `restaurants`, `dishes`, `open` and `onClose` to `TrendingPanel`.

- [ ] **Step 3: Create `app/admin/trending/page.tsx`**

Follow `app/admin/dishes/page.tsx` (Task 6 Step 3): cities, then `pickCity`, then queries, with error EmptyStates. The queries:

```ts
supabase.from('trending_dishes')
  .select('id, dish_name, place_name, city_id, restaurant_id, area, why, source_url, photo_url, visited_dish_id, rank, buzz, deleted_at, diet, category, cuisine, tastes, meals')
  .eq('city_id', cityRow.id)
  .order('buzz', { ascending: false }).order('rank').order('created_at', { ascending: false })
supabase.from('restaurants').select('id, name').eq('city_id', cityRow.id).is('deleted_at', null).order('name')
supabase.from('dishes').select('id, name, restaurants!inner(name, city_id)').eq('restaurants.city_id', cityRow.id).is('deleted_at', null).order('name')
```

`cityRow` is the city object whose slug equals the picked city. Map the rows to `AdminTrending`, using `tastes ?? []` and `meals ?? []`. The header:
- title "On our list"
- subtitle "Places we plan to visit — shown on search and What's New, never scored."
- `CityTabs` with `basePath="/admin/trending"` and `params={{ tab }}`

The body is `<Suspense><TrendingList key={city} … initialTab={searchParams.tab} /></Suspense>`.

- [ ] **Step 4: Verify and commit**

Run `npx tsc --noEmit` (expect exit 0) and `npm run build` (expect success).

```bash
git add components/admin/TrendingPanel.tsx components/admin/TrendingList.tsx app/admin/trending
git commit -m "Add On our list admin: buzz, tags, and mark visited

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Docs + final checks

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update `CLAUDE.md`**

1. In `## Architecture`, replace the **Admin routes** paragraph with:

```markdown
**Admin routes** live under `app/admin/` — protected by `middleware.ts`, which redirects signed-out users to `/admin/login` (`/admin/forgot-password` is also public). Auth is Supabase email/password. Pages: Dashboard (`/admin`, "Needs attention"), Dishes (`/admin/dishes` — side-panel editing of score + search tags, Save & next), On our list (`/admin/trending` — viral places, buzz, tags, mark visited), Restaurants (`/admin/restaurants`). UI building blocks are in `components/admin/`; tag options come only from `lib/taxonomy.ts`, validated server-side by `lib/admin/dishTags.ts`. The custom admin coexists with Directus — both point at the same DB, but logins are separate.
```

2. Add a new section after `## Deployment`:

```markdown
## Admin password reset (one-time Supabase setup)

`/admin/forgot-password` emails a Supabase reset link that lands on `/auth/callback`, then `/admin/reset-password`. Supabase only redirects to allow-listed URLs: in the Supabase dashboard → **Authentication → URL Configuration → Redirect URLs**, add `http://localhost:3000/auth/callback` and `https://<your-vercel-domain>/auth/callback`. New admin accounts are created in **Authentication → Users → Add user** (tick Auto Confirm).
```

- [ ] **Step 2: Final checks**

Run: `npm test && npx tsc --noEmit && npm run build`
Expected: all pass. The build output lists `/admin/dishes`, `/admin/trending`, `/admin/restaurants`, `/admin/forgot-password`, `/admin/reset-password` and `/auth/callback`.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "Document the admin and the password reset setup

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
