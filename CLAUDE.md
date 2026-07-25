# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Next.js app
npm run dev        # Start dev server at localhost:3000
npm run build      # Production build
npm run lint       # ESLint

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

**Admin routes** live under `app/admin/` — protected by `middleware.ts` which redirects unauthenticated users to `/admin/login`. Auth is Supabase email/password. The custom admin coexists with Directus — both point at the same DB.

**Server Actions** in `app/actions/` handle all admin mutations (update, softDelete, restore) and call `revalidatePath` to refresh the page. Client components (`*Actions.tsx`) call these server actions via `useTransition`.

**AI Suggest** — `app/api/suggest/route.ts` fetches all reviewed dishes from Supabase, builds a context string, and calls Gemini 1.5 Flash to return a single best-match dish recommendation.

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

Directus auto-discovers the existing Postgres schema. After running a DB migration, go to **Settings → Data Model → Reload** in the Directus UI to pick up schema changes. Directus creates its own `directus_*` system tables alongside the Foody tables — do not modify these.

## Deployment

The Next.js app deploys to **Vercel** (Hobby free plan). Each branch gets a preview deployment automatically. Production is the `master` branch.

## Image Storage (Vercel Blob)

Images (restaurant covers, dish photos) are stored in **Vercel Blob** via the `@vercel/blob` package. Free Hobby plan: 500 MB storage + 1 GB transfer/month.

Upload pattern (Server Actions only):
```ts
import { put } from '@vercel/blob'
const blob = await put(filename, file, { access: 'public' })
// save blob.url to cover_image_url or photo_url in Supabase
```

- `restaurants.cover_image_url` — already exists, stores Vercel Blob URL
- `dishes.photo_url` — added via migration `002_dish_photo_url.sql`

Public pages read the URL directly with a standard `<img>` tag — no signed URLs needed.

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
- `BLOB_READ_WRITE_TOKEN` — Vercel Blob token (from Vercel project dashboard → Storage tab)

Directus reads from `cms/.env` — see that file for its required variables.
