# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Next.js app
npm run dev        # Start dev server at localhost:3000
npm run build      # Production build
npm run lint       # ESLint
npm test           # Vitest unit tests (lib/**/*.test.ts)

# Directus CMS
cd cms && npm start       # Start Directus at localhost:8055
cd cms && npm run bootstrap  # First-time setup (creates DB system tables + admin user)

# Database migrations
export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"
psql "$DATABASE_URL" -f supabase/migrations/<file>.sql
```

## Architecture

Two independent services sharing one Supabase Postgres database:

1. **Next.js app** (`/`) — public-facing site + custom admin panel
2. **Directus CMS** (`/cms`) — team content management UI for 3-4 person team

### Next.js App Structure

**Public routes** live under `app/(public)/` — these are the visitor-facing pages. All public Supabase queries must include `.is('deleted_at', null)` to filter soft-deleted content.

**Admin routes** live under `app/admin/` — protected by `middleware.ts`, which redirects signed-out users to `/admin/login` (`/admin/forgot-password` is also public). Auth is Supabase email/password. Pages: Dashboard (`/admin`, "Needs attention"), Dishes (`/admin/dishes` — side-panel editing of score + search tags, Save & next), On our list (`/admin/trending` — viral places, buzz, tags, mark visited), Restaurants (`/admin/restaurants`), Cities (`/admin/cities` — Live/Coming soon; delete only when a city has no restaurants, the database refuses (restaurants.city_id is ON DELETE RESTRICT since migration 010)), Team (`/admin/team` — tester profiles are auto-created on sign-in; admins invite by email, change roles, and remove access by banning, never deleting, since reviews cascade with the user). Turn off public sign-ups (Authentication → Sign In / Providers → Email) — invites still work, and with sign-ups on anyone with the anon key could create an account. UI building blocks are in `components/admin/`; tag options come only from `lib/taxonomy.ts`, validated server-side by `lib/admin/dishTags.ts`. The custom admin coexists with Directus — both point at the same DB, but logins are separate.

**Server Actions** in `app/actions/` handle all admin mutations (update, softDelete, restore) and call `revalidatePath` to refresh the page. Client components (`*Actions.tsx`) call these server actions via `useTransition`.

**AI Suggest** — `app/api/suggest/route.ts` fetches all reviewed dishes from Supabase, builds a context string, and calls Gemini 1.5 Flash to return a single best-match dish recommendation.

**Search** — `lib/search/`. `parseQuery` (`lib/taxonomy.ts`) extracts tags; `classifyQuery` picks a kind: `specific` (ranked by `dishes.score`), `meal` (grouped Thali / by cuisine), `broad` (City's Best: top dish per category), `text` (typo-tolerant via the `search_fuzzy` SQL function, migration 008). `runSearch` is the single entry point, used by `/api/search` (hero dropdown) and the `/search` page. Viral entries from `trending_dishes` show separately as "On our list · visiting soon" (ordered by `buzz`), never ranked with rated dishes. Pure logic is unit tested: `npm test`. Design: `docs/superpowers/specs/2026-09-30-smart-search-design.md`. Viral entries only match tag/meal searches once their category/meals/diet tags are set (e.g. in Directus).

### Supabase Client Pattern

- Server components / Server Actions: `import { createClient } from '@/lib/supabase/server'` — uses cookies for auth
- Client components: `import { createClient } from '@/lib/supabase/client'` — browser client
- API routes that need elevated access: `createClient(URL, SERVICE_ROLE_KEY)` directly

### Database Schema

Five tables in `public` schema: `cities → restaurants → dishes → reviews`, plus `testers` (extends `auth.users`).

**Soft delete** — `restaurants`, `dishes`, `reviews` all have `deleted_at timestamptz DEFAULT NULL`. Active records have `NULL`; deleted records have a timestamp. Always filter with `.is('deleted_at', null)` on public pages.

Migrations live in `supabase/migrations/` as numbered SQL files. Run them manually via psql against the Supabase session pooler:
`postgresql://postgres.uftgjzfmlyvkniegawms:***@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres`

The direct DB host (`db.uftgjzfmlyvkniegawms.supabase.co`) is IPv6-only and won't resolve on a standard IPv4 network — always use the session pooler URL stored as `DATABASE_URL` in `.env.local`.

### Directus CMS (`/cms`)

Directus auto-discovers the existing Postgres schema. After running a DB migration, restart Directus (`cd cms && npm start`) to pick up schema changes (Directus 11 has no reload button). Directus creates its own `directus_*` system tables alongside the Chakh tables — do not modify these.

## Deployment

The Next.js app deploys to **Vercel** (Hobby free plan). Each branch gets a preview deployment automatically. Production is the `master` branch.

## Admin password reset (one-time Supabase setup)

`/admin/forgot-password` emails a Supabase reset link that lands on `/auth/callback`, then `/admin/reset-password`. Supabase only redirects to allow-listed URLs: in the Supabase dashboard → **Authentication → URL Configuration → Redirect URLs**, add `http://localhost:3000/auth/callback` and `https://<your-vercel-domain>/auth/callback`. If reset links fail on Vercel preview deployments, add a wildcard entry such as `https://*-<your-project>.vercel.app/**`. New admin accounts are created in **Authentication → Users → Add user** (tick Auto Confirm). Add `…/admin/reset-password` to the same Redirect URLs list — team invites land there. Supabase's built-in email only delivers to your Supabase org members (a few per hour) — configure custom SMTP (Authentication → Emails) before inviting teammates.

Migration `009_trending_admin_read.sql` must be applied for the On our list Delete/Restore to work.

Migration `010_admin_cities_team.sql` must be applied for the Cities page to save and for testers to rename themselves.

## Image Storage (Supabase Storage)

Dish photos are stored in **Supabase Storage**, in the public `dish-photos` bucket
created by migration `004_dish_photos_bucket.sql`. Uploading before that bucket
existed was what produced "Bucket not found".

Upload pattern (see `app/admin/restaurants/[id]/AddDishForm.tsx`):
```ts
const supabase = createClient()
await supabase.storage.from('dish-photos').upload(path, file)
const { data: { publicUrl } } = supabase.storage.from('dish-photos').getPublicUrl(path)
// save publicUrl to dishes.photo_url
```

- `dishes.photo_url` — stores the public Supabase Storage URL
- `restaurants.cover_image_url` — column exists, but nothing uploads to it yet

Public pages read the URL directly with a standard `<img>` tag — the bucket is
public, so no signed URLs are needed. Writes are restricted to authenticated
testers by RLS policy.

> Earlier revisions of this file described Vercel Blob (`@vercel/blob`,
> `BLOB_READ_WRITE_TOKEN`). No code uses it and the token is not configured —
> Supabase Storage is the actual implementation.

## Planned Features

### Search & Discovery
- Search bar on homepage (Supabase full-text search on restaurant name, cuisine_type, dish names)
- Filterable city/restaurant listings by cuisine type, price range, rating

### Trust & Depth (public pages)
- Taste notes displayed prominently on dish/restaurant pages
- Must-try badges surfaced on restaurant and city listing pages
- Richer review cards with rating breakdown

## Environment Variables

Required in `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — public anon key
- `SUPABASE_SERVICE_ROLE_KEY` — secret key (server-only, used in API routes)
- `GEMINI_API_KEY` — Google Gemini API key for AI suggest feature
- `DATABASE_URL` — Supabase session pooler connection string (for running migrations)

Image uploads use Supabase Storage and need no extra token beyond the keys above.

Directus reads from `cms/.env` — see that file for its required variables.
