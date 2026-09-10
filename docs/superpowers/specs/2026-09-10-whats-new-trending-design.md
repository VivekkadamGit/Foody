# What's New — with a "Trending Right Now" column

**Date:** 2026-09-10
**Status:** Approved
**Branch:** `advance-search`

## Goal

A `/whats-new` page with two columns:

1. **Freshly tasted** — dishes we visited and scored most recently.
2. **Trending Right Now** — food that is viral in the city that **we have not visited yet**.

The second column is the point of the feature. It is also the risky one: every other
surface on Chakh refuses to show food we haven't eaten. `app/page.tsx` would rather
render "Nothing to serve yet" than a dish we can't vouch for. Trending only works if it
is unmistakably a *different kind of thing* from a score — not a weaker version of one.

## Current state

There is no What's New page. Routes today are `/`, `/[city]`, `/[city]/[restaurant]`,
`/suggest`, plus `/admin/*`. Nothing in the database tracks buzz, virality, or intent to visit.

Since migration 005, `dishes.score` is the authoritative 0–10 number set by hand, and
`reviews` is a visit log (`visit_date` + taste notes) that no longer drives the score.
That split is what makes this feature cheap: "freshly tasted" is just the newest
`visit_date`, and "not yet tasted" is a row that has no dish at all.

## Decision: a separate table, not a flag on `dishes`

Rejected adding `is_trending` to `dishes`.

- A trending place is usually **not in our database**. Flagging a dish would mean
  creating a fake `restaurants` row and a fake `dishes` row for a place we have never
  been to. Those rows would then be reachable by search, city listings and the AI
  suggest context — exactly the leak we are trying to prevent.
- A separate table cannot accidentally acquire a score. There is no `score` column to set.
- Soft delete, RLS and the query patterns all follow existing conventions, so the
  isolation costs nothing in complexity.

## Schema — migration `006_trending_dishes.sql`

```sql
CREATE TABLE trending_dishes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dish_name       text NOT NULL,
  place_name      text NOT NULL,
  city_id         uuid NOT NULL REFERENCES cities(id),
  restaurant_id   uuid REFERENCES restaurants(id),
  area            text,
  why             text NOT NULL,
  source_url      text,
  photo_url       text,
  visited_dish_id uuid REFERENCES dishes(id),
  rank            int NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz DEFAULT NULL
);
```

- `dish_name` / `place_name` are free text because the place usually isn't ours yet.
- `restaurant_id` is **optional** — set only when we already have that restaurant, so the
  card can link to a real page instead of dead-ending.
- `why` is required. An entry with no stated reason is a rumour, not a signal.
- `source_url` is the receipt: where we saw it. Rendered as "Seen on —".
- `visited_dish_id` drives the lifecycle below.
- `rank` allows manual ordering; ties break on `created_at DESC`.

Index, matching the only query the public page makes:

```sql
CREATE INDEX idx_trending_live ON trending_dishes (city_id, rank, created_at DESC)
  WHERE deleted_at IS NULL AND visited_dish_id IS NULL;
```

RLS follows migration 004's pattern: `anon, authenticated` may `SELECT`; only
`authenticated` may write.

## Lifecycle — the column cleans itself

An entry is live in Trending while `visited_dish_id IS NULL`.

When we actually go and review that dish, admin sets `visited_dish_id` to the real dish.
The entry immediately **leaves** the Trending column, and Freshly Tasted can mark that
card as one the city told us about:

> *You told us about this one. We went. **7.2.***

This is what keeps Trending from becoming a graveyard of stale hype, and it turns the
column into a promise the site is visibly keeping.

## Page — `app/(public)/whats-new/page.tsx`

Server component. Two queries, run in parallel:

**Freshly tasted.** `dishes` where `score IS NOT NULL` and `deleted_at IS NULL`, joined
through `restaurants → cities`, selecting `reviews(visit_date)`. Sorted in JS by the most
recent `visit_date`, falling back to `dishes.created_at` when a scored dish has no visit
logged. (Sorting in JS is fine at ~64 dishes; if this grows, it becomes a view.)

**Trending.** `trending_dishes` where `deleted_at IS NULL AND visited_dish_id IS NULL`,
ordered by `rank`, then newest.

Both queries fetch **all** matching rows and the page groups them **by city** before
handing them to the client, capping each city at 12 freshly-tasted cards. Fetching a
global top 12 and filtering client-side would empty the column the moment someone picks
a city that isn't in that 12 — the cap has to be applied per city, not across all of them.

Both queries log their errors rather than swallowing them, per the rule established in
`app/page.tsx` — a silent failure there once put invented scores on production.

### No sample-data fallback

In production, a failed or empty query renders an honest empty state. This page must never
invent a trending dish; that would be the same class of bug the "Nothing to serve yet"
branch exists to prevent.

## Components

`WhatsNewClient.tsx` owns city-chip state and filters both columns together — one chip row,
two columns, so the page always reads as a single city's news. The chip selected on load is
the first active city in the existing `CITY_PRIORITY` order (Surat), reusing the constant
from `app/page.tsx`. This page does **not** ask for geolocation; the homepage already does,
and a second permission prompt for a browsing page isn't worth it. Layout is
`grid lg:grid-cols-2 gap-10`, stacking on mobile with Freshly Tasted first.

- `components/whatsnew/FreshlyTastedCard.tsx` — score, quality badge, links to the restaurant page.
- `components/whatsnew/TrendingCard.tsx` — **no score, no quality badge, ever.**

### The trust rule

`TrendingCard` must not render a number that could be mistaken for a verdict. It is
visually distinct from a tasted card (lighter, unfilled treatment), and the column header
states plainly that we haven't eaten these yet:

> **Trending Right Now** — We haven't tasted these. No score, no badge. Just what the city won't shut up about.

Every card carries its "Seen on —" source link, so a reader can judge the buzz themselves.

## Admin

`app/admin/trending/page.tsx` — list plus add form, following the existing
`app/actions/` + `*Actions.tsx` + `useTransition` pattern.

`app/actions/trending.ts` exports `create`, `update`, `softDelete` and `markVisited`.
Each calls `revalidatePath('/whats-new')`. `markVisited` takes a `dish_id` and is how an
entry graduates out of the column. Photo upload reuses the `dish-photos` bucket exactly as
`AddDishForm.tsx` does.

## Navigation and empty states

`Navbar.tsx` gains a "What's New" link.

- Trending empty → "Nothing's blowing up right now." Not an empty grid.
- Freshly tasted empty → the honest "nothing to serve yet" voice already used on the homepage.

## Verification

The repo has no test framework, so verification is:

- `npm run lint` and `npm run build` both clean.
- Migration 006 applied via psql against the session pooler `DATABASE_URL`.
- The real page driven in the browser preview with seeded rows: both columns render, city
  chips filter both, a `markVisited` call removes the entry from Trending.

## Out of scope

- Automatic virality detection (search-signal or external APIs). Entries are curated by hand.
- Any surfacing of trending entries in search, city listings, or the AI suggest context.
  Trending lives on this page only.
