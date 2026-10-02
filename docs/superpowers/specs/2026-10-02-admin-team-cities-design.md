# Admin Team & Cities — Design

**Date:** 2026-10-02
**Status:** Approved (the user asked for it to be built without per-section sign-off)
**Builds on:** `docs/superpowers/specs/2026-10-02-admin-redesign-design.md` (look C, `components/admin/*`, AdminShell)

## Problems

1. **Visit logs can fail.** `reviews.tester_id` must reference a `testers` row, but nothing creates that row: there is no trigger and no UI. "Log a visit" fails for any account without a tester profile.
2. **Accounts are managed outside the admin.** Adding a teammate means using the Supabase dashboard, and the admin has no team view.
3. **Cities can't be managed in the admin.** There's no way to add a city or switch it between live and coming soon. This was one of the reasons to keep Directus.

## Cities: `/admin/cities`

**Data.** The `cities` table has `id`, `name`, `slug` (unique), and `status` ∈ {`active`, `coming_soon`} (migration 002).

**List.** Each row shows:
- name and slug
- a status badge: **Live** for `active`, **Coming soon** for `coming_soon`
- restaurant count (restaurants not soft-deleted)
- dish count (dishes not soft-deleted, at restaurants not soft-deleted)

**Panel.** A `SidePanel`, shared by Add city and Edit city:
- **Name** (required, trimmed).
- **Slug.** Auto-filled from the name with `slugify` until the user edits the slug by hand. It must match `^[a-z0-9]+(?:-[a-z0-9]+)*$`.
- **Status.** A two-option toggle.

**Delete.** Only allowed when the city has 0 restaurants, counting soft-deleted ones too, because they still hold the FK. Otherwise the button is disabled with the hint "Move or delete its restaurants first". The server action enforces this rule as well.

**Revalidation.** `/`, `/admin/cities`, `/whats-new`.

## Team: `/admin/team`

**Tester profile, created automatically.** `ensureTester()` runs in `app/admin/layout.tsx` for every signed-in user.
- If the user has no `testers` row, it inserts one with the service-role client:
  - `name = defaultTesterName(email)`: the part of the email before `@`, with `.`, `_` and `-` turned into spaces and each word title-cased. For example, `vivek.adam@x` becomes "Vivek Adam".
  - `role` is `admin` when no admin exists yet, otherwise `tester`.
- It returns `{ id, name, role }`.

**Page layout.**
- **"You" card:** your name, editable through the `updateMyName` action; your role; your email.
- **Team list:** one row per tester.
  - name, email, role badge
  - last sign-in ("Never" when invited but not yet signed in)
  - state: **Active**, **Invited** (`last_sign_in_at` is null), or **Removed** (banned)
  - Emails, last sign-in and ban state come from `auth.admin.listUsers()` with the service-role client, server-side only.
- **Admin-only controls.** These are hidden for testers, and the server checks the role on every call.
  - **Invite by email.** `auth.admin.inviteUserByEmail(email, { redirectTo: ${origin}/admin/reset-password })`, then insert `testers { id, name: defaultTesterName(email), role: 'tester' }`. If the user already exists, show the error "That email already has an account".
  - **Role toggle.** Tester ⇄ Admin. The app refuses to demote the last admin.
  - **Remove access.** `auth.admin.updateUserById(id, { ban_duration: '876000h' })`. **Never delete the user:** `reviews` cascade-delete with the user. Removing your own access is refused.
  - **Restore access.** `ban_duration: 'none'`.

**Landing from an invite.** An admin-generated invite can't use PKCE, so Supabase redirects with a `#access_token…&type=invite` hash.
- `/admin/reset-password` needs a session, so the middleware redirects to `/admin/login`. The browser keeps the hash across the redirect.
- The root `RecoveryRedirect` reads `type` from `window.location.hash` *before* creating the client, using the pure helper `authLinkType(hash)`.
- When the client fires `SIGNED_IN` or `PASSWORD_RECOVERY` after a link of type `invite` or `recovery`, it calls `router.replace('/admin/reset-password?welcome=1')` for an invite, or `/admin/reset-password` for a recovery.
- With `?welcome=1`, the reset page reads **"Welcome to Chakh — set your password"**.
- Supabase's Redirect URLs allow-list must include `…/admin/reset-password`. Document this in CLAUDE.md.

**Origin for `redirectTo`.** Built from the request headers (`x-forwarded-proto` / `host`), so it works in local dev and on Vercel.

## Data and security

- **Migration `010_admin_cities_team.sql`** (the user applies it):
  - `cities`: INSERT, UPDATE and DELETE policies for `authenticated`. Today only SELECT exists.
  - `testers`: an UPDATE policy "own row" (`id = auth.uid()`) so users can rename themselves.
  - Role changes and inserts for other people go through the service-role client only.
- **`lib/supabase/admin.ts`:** `createAdminClient()` built with `SUPABASE_SERVICE_ROLE_KEY`. It imports `server-only` and is never used in client components.
- **Every team action:**
  1. Reads the caller with the cookie client (`auth.getUser()`).
  2. Loads the caller's `testers.role`.
  3. Throws `Error('Only admins can manage the team')` unless the role is admin. `updateMyName` is the exception.

## Pure logic (unit tested)

- `lib/admin/city.ts`: `slugify(name)`, `validateCity({ name, slug, status })`, and the existing `pickCity`.
- `lib/admin/team.ts`: `defaultTesterName(email)`, `isValidEmail(email)`, `memberState({ last_sign_in_at, banned_until })` → `'active' | 'invited' | 'removed'`, and `canDemote(adminCount)`.
- `lib/admin/authMessages.ts`: `authLinkType(hash)` → `'invite' | 'recovery' | 'signup' | 'magiclink' | null`.

## Navigation

Add to the AdminShell NAV, after Restaurants:
- Cities (`/admin/cities`, 🏙)
- Team (`/admin/team`, 👥)

## Out of scope

- Per-role restrictions on content editing. Every tester can still edit everything, as today.
- Deleting users.
- Reassigning restaurants to another city.
- Dropping Directus.
