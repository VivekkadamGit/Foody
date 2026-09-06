# Advanced Search

**Date:** 2026-09-06
**Status:** Approved
**Branch:** `advance-search`

## Goal

Make search the front door of Chakh. Two user intents must work:

1. **Dish intent** — type "pani puri", pick it from the dropdown, land on a page listing every restaurant in the city that serves it, ranked by score.
2. **Flavor intent** — type "spicy" and get spicy food, without knowing any dish or restaurant name.

## Current state

There is no search backend. The hero box filters an in-memory array already loaded on the homepage, then routes to `/[city]?q=…` — and the city page ignores `q` entirely, reading only `cuisine` and `price`. This is a build from scratch, not a fix.

## Decision: stay on Postgres

Rejected moving to NoSQL.

- Postgres provides full-text search (`tsvector` + GIN) and fuzzy matching (`pg_trgm`), both available on Supabase.
- The data is deeply relational (city → restaurant → dish → review) and every result needs a score computed from joined reviews. NoSQL makes that harder, not easier.
- Volume is ~64 dishes. This is not a scale problem.
- If Postgres FTS is outgrown, the answer is a dedicated search index (Meilisearch/Typesense), still not NoSQL.

## Schema — migration `003_canonical_dishes.sql`

The blocker: `dishes` rows are per-restaurant. "Pani Puri" at ten restaurants is ten unrelated rows joined only by free text. Dish-intent search needs one canonical dish that many restaurants point at.

```sql
CREATE TABLE canonical_dishes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  slug        text UNIQUE NOT NULL,
  description text,
  photo_url   text,
  aliases     text[] DEFAULT '{}',
  flavors     text[] DEFAULT '{}',
  created_at  timestamptz DEFAULT now(),
  deleted_at  timestamptz DEFAULT NULL
);

ALTER TABLE dishes
  ADD COLUMN canonical_dish_id uuid REFERENCES canonical_dishes(id) ON DELETE SET NULL;
```

**Fixed flavor vocabulary**, enforced at the database:

```sql
ALTER TABLE canonical_dishes ADD CONSTRAINT valid_flavors
  CHECK (flavors <@ ARRAY['spicy','sweet','tangy','savoury',
                          'crispy','creamy','fried','light']::text[]);
```

**`aliases` is the load-bearing column.** Trigram similarity cannot get from "golgappa" to "Pani Puri" — the strings share almost no characters. Regional synonyms are the real search problem in Indian food, and only an explicit alias list solves them.

### Indexes

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_canonical_dishes_name_trgm ON canonical_dishes USING gin (name gin_trgm_ops);
CREATE INDEX idx_restaurants_name_trgm      ON restaurants      USING gin (name gin_trgm_ops);
CREATE INDEX idx_canonical_dishes_flavors   ON canonical_dishes USING gin (flavors);
CREATE INDEX idx_dishes_canonical           ON dishes (canonical_dish_id);
```

The trigram indexes make `ILIKE '%x%'` index-accelerated today and make typo tolerance a drop-in upgrade later.

### Seed and backfill

The migration seeds canonical dishes for known dishes, then links existing rows by exact name match:

```sql
UPDATE dishes d SET canonical_dish_id = c.id
FROM canonical_dishes c
WHERE lower(trim(d.name)) = lower(c.name)
  AND d.canonical_dish_id IS NULL;
```

Unmatched rows are linked by hand in Directus.

## Search backend

`GET /api/search?q=pani&city=surat` → `{ dishes, flavors, restaurants }`

Matching rules:

| Kind | Matches on | Links to |
|---|---|---|
| Dish | `canonical_dishes.name` ILIKE, or any entry in `aliases` | `/[city]/dish/[slug]` |
| Flavor | the static 8-item vocabulary, matched in TypeScript | `/[city]/flavor/[flavor]` |
| Restaurant | `restaurants.name` ILIKE, scoped to city | `/[city]/[restaurant]` |

Dish and restaurant results are scoped to the active city, and dishes are limited to those with at least one linked `dishes` row in that city — never suggest a dish nobody in town serves.

**No SQL RPC function; ILIKE + aliases rather than `pg_trgm` similarity.** Two reasons: aliases beat fuzzy matching for this domain, and the Supabase instance is unreachable from the development sandbox, so a stored function would ship untested. ILIKE keeps the logic in TypeScript where it can be verified.

## Pages

### `/[city]/dish/[slug]` — dish results

"Top Pani Puri in Surat". Every restaurant serving the canonical dish, ranked by score descending. Reuses `scoreOutOf10`, `avgRating`, `priceTierSymbol` from `lib/dishScore.ts` and the `QualityBadge` component.

No route conflict: the existing `[restaurant]` segment matches a single path segment, so `/surat/dish/pani-puri` resolves to the new route.

The rich detail page (photos, tasting notes, visit history) is explicitly out of scope.

### `/[city]/flavor/[flavor]` — flavor results

Lists **dishes** carrying that flavor, each row showing its best restaurant — a deliberate deviation from the literal "restaurants which sell spicy food". It answers the same question, stays dish-first like the rest of the app, and avoids flattening a restaurant serving both spicy chaat and sweet ghari into one vague label.

### Hero search dropdown

Grouped sections — DISHES, FLAVORS, RESTAURANTS — replacing the current in-memory filter in `components/home/HomeClient.tsx`. Debounced, calling `/api/search`. Selecting a result navigates; it does not filter in place.

## Managing canonical dishes

**Use Directus; do not build admin UI.** Directus auto-discovers the schema, so after the migration a Settings → Data Model → Reload gives a full editor for `canonical_dishes` plus the dish → canonical dropdown at no build cost.

## Components

| File | Purpose |
|---|---|
| `supabase/migrations/003_canonical_dishes.sql` | Schema, constraint, indexes, seed, backfill |
| `lib/flavors.ts` | The 8-item vocabulary and label helpers |
| `lib/search.ts` | Query builders and result types, shared by API route and pages |
| `app/api/search/route.ts` | The search endpoint |
| `components/search/SearchBox.tsx` | Debounced input + grouped dropdown |
| `app/(public)/[city]/dish/[slug]/page.tsx` | Dish results |
| `app/(public)/[city]/flavor/[flavor]/page.tsx` | Flavor results |

## Error handling

- Unknown dish slug, restaurant, or flavor → `notFound()`.
- Locked city (`status = 'coming_soon'`) → existing coming-soon page, consistent with `/[city]`.
- Empty query → no dropdown, no request fired.
- Search API failure → dropdown shows an inline "search unavailable" line; the page never crashes.
- All queries filter `deleted_at IS NULL`, per project convention.

## Verification and known gap

Verified here: type-check, clean production build, and browser verification of the dropdown, dish page, and flavor page.

**Not verified here:** the Supabase project is unreachable from this sandbox (DNS does not resolve for the REST host; the session pooler returns "tenant not found" for the project ref). The migration and all real-data queries are therefore unrun. To keep the UI verifiable, `/api/search` falls back to a small static dataset when the database is unreachable — mirroring the existing `FALLBACK_BUNDLES` pattern in `app/page.tsx`.

There is no test runner in this repo, so verification is build + browser, consistent with prior work on this project. `lib/search.ts` and `lib/flavors.ts` are pure and can take unit tests if a runner is added later.

## Owner actions

1. Confirm Supabase connectivity from a machine that can reach the project.
2. Run migration `002_city_status.sql` — still outstanding from the previous branch.
3. Run migration `003_canonical_dishes.sql`.
4. Reload the Directus data model and link any dishes the backfill missed.

## Out of scope

- Rich dish detail page (photos, tasting notes, visit history).
- Typo/fuzzy tolerance via `pg_trgm` similarity — indexes are laid down for it, enable once the DB is reachable.
- Cross-city search; search stays scoped to the active city.
- Custom admin CRUD for canonical dishes.
