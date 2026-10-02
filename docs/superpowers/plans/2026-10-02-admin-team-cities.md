# Admin Team & Cities Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Cities page and a small Team page to the Chakh admin. The Team page auto-creates tester profiles, lets admins invite teammates, change roles and remove access. Invite links land on "set your password".

**Architecture:**
- Pure helpers in `lib/admin/` (unit tested).
- A server-only service-role Supabase client (`lib/supabase/admin.ts`) for user administration.
- Server actions `app/actions/cities.ts` and `app/actions/team.ts`.
- Two new admin pages built on the existing `components/admin/*` blocks.
- Migration 010 adds the RLS write policies these need.

**Tech Stack:** Next.js 14 App Router, Supabase (`@supabase/ssr`, `@supabase/supabase-js` admin API), TypeScript, Tailwind, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-02-admin-team-cities-design.md`

## Global Constraints

**Cities**
- `status` values are exactly `active` (shown as "Live") and `coming_soon` (shown as "Coming soon").
- Slugs must match `^[a-z0-9]+(?:-[a-z0-9]+)*$`.
- `restaurants.city_id` is `ON DELETE CASCADE`. **A city may only be deleted when it has 0 restaurants, soft-deleted ones included.** Enforce this in the server action, not only in the UI.

**Team**
- **Never delete auth users.** Reviews cascade with the user. "Remove access" = `ban_duration: '876000h'`, and "Restore" = `ban_duration: 'none'`.
- Team-management actions (invite, role, remove/restore) throw `Error('Only admins can manage the team')` unless the caller's `testers.role === 'admin'`. `updateMyName` is open to any signed-in user.
- Never demote the last admin. Never remove your own access.

**Service-role client**
- `SUPABASE_SERVICE_ROLE_KEY` is used only in `lib/supabase/admin.ts`, which starts with `import 'server-only'`.
- It must never be imported from a `'use client'` file.

**Look and error handling**
- Look C styling: cream workspace, white cards `rounded-2xl border border-warm-200`, `bg-ember` primary buttons, `font-anek`. Use `components/admin/ui.tsx`, `SidePanel` and `useToast`.
- Server actions throw `Error(message)`. The UI shows the message and keeps the input.
- Server-component query failures call `console.error('[admin] …')` and render `<EmptyState icon="⚠️" text="Couldn't load … — refresh to retry." />`.

**Rules for implementers**
- Do NOT run `npm run build`, because a dev server shares `.next`.
- Do NOT run `npm run lint`, because there is no ESLint config.
- Do NOT run psql.
- Verify with `npm test` and `npx tsc --noEmit`.

**Credentials**
- Claude never enters credentials, creates accounts directly, or sets passwords. Inviting happens through the app UI, used by the user.

**Commits**
- Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

### Task 1: Pure helpers

**Files:**
- Modify: `lib/admin/city.ts`, `lib/admin/authMessages.ts`
- Create: `lib/admin/team.ts`
- Tests: `lib/admin/city.test.ts` (extend), `lib/admin/team.test.ts`, `lib/admin/authMessages.test.ts` (extend)

**Interfaces:**
- Produces:
  - `CITY_STATUSES = ['active', 'coming_soon'] as const`
  - `type CityStatus`
  - `slugify(name: string): string`
  - `validateCity(input: { name: unknown; slug: unknown; status: unknown }): { name: string; slug: string; status: CityStatus }`. It throws `Error` with these messages: `'City name is required'`, `'Slug can only use lowercase letters, numbers and single dashes'`, `'Unknown status: x'`.
  - `defaultTesterName(email: string): string`
  - `isValidEmail(email: string): boolean`
  - `type MemberState = 'active' | 'invited' | 'removed'`
  - `memberState(u: { last_sign_in_at: string | null; banned_until?: string | null }, now?: Date): MemberState`
  - `canDemote(adminCount: number): boolean`
  - `authLinkType(hash: string): 'invite' | 'recovery' | 'signup' | 'magiclink' | null`

- [ ] **Step 1: Write the failing tests**

Append to `lib/admin/city.test.ts`:

```ts
import { slugify, validateCity } from './city'

describe('slugify', () => {
  it.each([
    ['Surat', 'surat'],
    ['  New Delhi ', 'new-delhi'],
    ['Navi Mumbai (West)', 'navi-mumbai-west'],
    ['Pune--Camp', 'pune-camp'],
    ['Bengaluru!', 'bengaluru'],
  ])('%s -> %s', (name, slug) => expect(slugify(name)).toBe(slug))
})

describe('validateCity', () => {
  it('trims and accepts valid input', () => {
    expect(validateCity({ name: ' Indore ', slug: 'indore', status: 'coming_soon' })).toEqual({ name: 'Indore', slug: 'indore', status: 'coming_soon' })
  })
  it.each([
    [{ name: ' ', slug: 'x', status: 'active' }, 'City name is required'],
    [{ name: 'X', slug: 'Bad Slug', status: 'active' }, 'Slug can only use lowercase letters, numbers and single dashes'],
    [{ name: 'X', slug: 'a--b', status: 'active' }, 'Slug can only use lowercase letters, numbers and single dashes'],
    [{ name: 'X', slug: 'x', status: 'live' }, 'Unknown status: live'],
  ])('rejects %j', (input, msg) => expect(() => validateCity(input)).toThrow(msg))
})
```

Also add `slugify, validateCity` to the existing import line at the top of that file instead of a second import, if one exists.

`lib/admin/team.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { canDemote, defaultTesterName, isValidEmail, memberState } from './team'

describe('defaultTesterName', () => {
  it.each([
    ['vivek.adam@gmail.com', 'Vivek Adam'],
    ['priya_s-k@x.in', 'Priya S K'],
    ['RAHUL@x.com', 'Rahul'],
    ['@x.com', 'Tester'],
  ])('%s -> %s', (email, name) => expect(defaultTesterName(email)).toBe(name))
})

describe('isValidEmail', () => {
  it('accepts normal addresses and rejects junk', () => {
    expect(isValidEmail('a@b.co')).toBe(true)
    expect(isValidEmail(' a@b.co ')).toBe(true)
    expect(isValidEmail('a@b')).toBe(false)
    expect(isValidEmail('nope')).toBe(false)
  })
})

describe('memberState', () => {
  const now = new Date('2026-10-02T00:00:00Z')
  it('removed when banned into the future', () => {
    expect(memberState({ last_sign_in_at: '2026-01-01', banned_until: '2126-01-01T00:00:00Z' }, now)).toBe('removed')
  })
  it('invited when never signed in', () => {
    expect(memberState({ last_sign_in_at: null }, now)).toBe('invited')
  })
  it('active otherwise, including an expired ban', () => {
    expect(memberState({ last_sign_in_at: '2026-09-01', banned_until: '2026-01-01T00:00:00Z' }, now)).toBe('active')
  })
})

describe('canDemote', () => {
  it('never leaves zero admins', () => {
    expect(canDemote(1)).toBe(false)
    expect(canDemote(2)).toBe(true)
  })
})
```

Append to `lib/admin/authMessages.test.ts`:

```ts
import { authLinkType } from './authMessages'

describe('authLinkType', () => {
  it('reads the type from an auth redirect hash', () => {
    expect(authLinkType('#access_token=a&refresh_token=b&type=invite')).toBe('invite')
    expect(authLinkType('#type=recovery&access_token=a')).toBe('recovery')
    expect(authLinkType('')).toBeNull()
    expect(authLinkType('#section-2')).toBeNull()
    expect(authLinkType('#type=weird')).toBeNull()
  })
})
```

Merge the imports into each file's existing import lines.

- [ ] **Step 2: Run the tests and confirm they fail**

Run `npm test`. Expected: FAIL. The new exports are missing.

- [ ] **Step 3: Implement**

Append to `lib/admin/city.ts`:

```ts
export const CITY_STATUSES = ['active', 'coming_soon'] as const
export type CityStatus = (typeof CITY_STATUSES)[number]

/** "Navi Mumbai (West)" → "navi-mumbai-west". */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function validateCity(input: { name: unknown; slug: unknown; status: unknown }): {
  name: string
  slug: string
  status: CityStatus
} {
  const name = typeof input.name === 'string' ? input.name.trim() : ''
  if (!name) throw new Error('City name is required')
  const slug = typeof input.slug === 'string' ? input.slug.trim() : ''
  if (!SLUG.test(slug)) throw new Error('Slug can only use lowercase letters, numbers and single dashes')
  if (!(CITY_STATUSES as readonly unknown[]).includes(input.status)) throw new Error(`Unknown status: ${String(input.status)}`)
  return { name, slug, status: input.status as CityStatus }
}
```

Create `lib/admin/team.ts`:

```ts
/** "vivek.adam@gmail.com" → "Vivek Adam". Editable later; this only seeds the profile. */
export function defaultTesterName(email: string): string {
  const local = email.split('@')[0] ?? ''
  const words = local.split(/[._-]+/).filter(Boolean)
  if (words.length === 0) return 'Tester'
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

export type MemberState = 'active' | 'invited' | 'removed'

export function memberState(
  u: { last_sign_in_at: string | null; banned_until?: string | null },
  now: Date = new Date()
): MemberState {
  if (u.banned_until && new Date(u.banned_until) > now) return 'removed'
  if (!u.last_sign_in_at) return 'invited'
  return 'active'
}

/** A team must always keep at least one admin. */
export function canDemote(adminCount: number): boolean {
  return adminCount > 1
}
```

Append to `lib/admin/authMessages.ts`:

```ts
const LINK_TYPES = ['invite', 'recovery', 'signup', 'magiclink'] as const

/** Reads `type=` from a Supabase auth redirect hash (#access_token=…&type=invite). */
export function authLinkType(hash: string): (typeof LINK_TYPES)[number] | null {
  const t = new URLSearchParams(hash.replace(/^#/, '')).get('type')
  return (LINK_TYPES as readonly string[]).includes(t ?? '') ? (t as (typeof LINK_TYPES)[number]) : null
}
```

- [ ] **Step 4: Run the tests and type check**

Run `npm test` and `npx tsc --noEmit`. Expected: all pass, exit code 0.

- [ ] **Step 5: Commit**

```bash
git add lib/admin
git commit -m "Add city, team and auth-link helpers for the team and cities admin

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Migration, service-role client, tester profiles, server actions

**Files:**
- Create: `supabase/migrations/010_admin_cities_team.sql`, `lib/supabase/admin.ts`, `lib/admin/currentTester.ts`, `app/actions/cities.ts`, `app/actions/team.ts`
- Modify: `app/admin/layout.tsx`

**Interfaces:**
- Consumes: `validateCity`, `defaultTesterName`, `isValidEmail` and `canDemote` (Task 1).
- Produces:
  - `createAdminClient()`, from `@/lib/supabase/admin`
  - `ensureTester(user: { id: string; email?: string | null }): Promise<{ id: string; name: string; role: 'tester' | 'admin' }>`, from `@/lib/admin/currentTester`
  - from `app/actions/cities.ts`:
    - `createCity(input: { name: string; slug: string; status: string }): Promise<void>`
    - `updateCity(id: string, input: { name: string; slug: string; status: string }): Promise<void>`
    - `deleteCity(id: string): Promise<void>`
  - from `app/actions/team.ts`:
    - `updateMyName(name: string): Promise<void>`
    - `inviteTeammate(email: string): Promise<void>`
    - `setRole(userId: string, role: 'tester' | 'admin'): Promise<void>`
    - `removeAccess(userId: string): Promise<void>`
    - `restoreAccess(userId: string): Promise<void>`

- [ ] **Step 1: Create `supabase/migrations/010_admin_cities_team.sql`**

```sql
-- Migration 010: admin can manage cities; testers can rename themselves
--
-- Cities only had a public SELECT policy, so the new /admin/cities page could not write.
-- Testers could insert their own profile but never edit it. Role changes and profiles
-- for other people go through the server-side service-role client, not these policies.

DROP POLICY IF EXISTS "Testers can insert cities" ON cities;
CREATE POLICY "Testers can insert cities" ON cities
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Testers can update cities" ON cities;
CREATE POLICY "Testers can update cities" ON cities
  FOR UPDATE TO authenticated USING (true);

-- Deleting a city cascades to its restaurants (restaurants.city_id ON DELETE CASCADE).
-- The server action refuses unless the city has no restaurants at all.
DROP POLICY IF EXISTS "Testers can delete cities" ON cities;
CREATE POLICY "Testers can delete cities" ON cities
  FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "Testers can update their own profile" ON testers;
CREATE POLICY "Testers can update their own profile" ON testers
  FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
```

Do NOT run it. The user applies migrations.

- [ ] **Step 2: Create `lib/supabase/admin.ts`**

```ts
import 'server-only'
import { createClient } from '@supabase/supabase-js'

/**
 * Service-role client: bypasses RLS and can administer auth users. Server-only —
 * the import above makes any client-component import a build error.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
```

- [ ] **Step 3: Create `lib/admin/currentTester.ts`**

```ts
import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { defaultTesterName } from './team'

export type TesterProfile = { id: string; name: string; role: 'tester' | 'admin' }

/**
 * Every review needs a testers row (reviews.tester_id is NOT NULL), but nothing used to
 * create one. Called on every signed-in admin request: returns the profile, creating it
 * on first sign-in. The first profile ever created while no admin exists becomes admin.
 */
export async function ensureTester(user: { id: string; email?: string | null }): Promise<TesterProfile> {
  const admin = createAdminClient()
  const { data: existing, error } = await admin.from('testers').select('id, name, role').eq('id', user.id).maybeSingle()
  if (error) throw new Error(error.message)
  if (existing) return existing as TesterProfile

  const { count, error: countError } = await admin
    .from('testers')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'admin')
  if (countError) throw new Error(countError.message)

  const profile: TesterProfile = {
    id: user.id,
    name: defaultTesterName(user.email ?? ''),
    role: (count ?? 0) === 0 ? 'admin' : 'tester',
  }
  // upsert, not insert: two concurrent first requests must not fail on the primary key.
  const { error: insertError } = await admin.from('testers').upsert(profile, { onConflict: 'id', ignoreDuplicates: true })
  if (insertError) throw new Error(insertError.message)
  return profile
}
```

- [ ] **Step 4: Call it in `app/admin/layout.tsx`**

Replace the signed-in branch with:

```tsx
  // Make sure this account has a tester profile — visit logs can't be saved without one.
  try {
    await ensureTester({ id: user.id, email: user.email })
  } catch (err) {
    console.error('[admin] could not ensure tester profile:', (err as Error).message)
  }

  return <AdminShell email={user.email ?? null}>{children}</AdminShell>
```

Add `import { ensureTester } from '@/lib/admin/currentTester'`. A failure is logged and does not block the admin.

- [ ] **Step 5: Create `app/actions/cities.ts`**

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { validateCity } from '@/lib/admin/city'

function revalidateCities() {
  revalidatePath('/')
  revalidatePath('/admin/cities')
  revalidatePath('/whats-new')
}

function friendly(message: string): string {
  if (/duplicate key|cities_slug_key/i.test(message)) return 'Another city already uses that slug'
  return message
}

export async function createCity(input: { name: string; slug: string; status: string }) {
  const city = validateCity(input)
  const supabase = await createClient()
  const { error } = await supabase.from('cities').insert(city)
  if (error) throw new Error(friendly(error.message))
  revalidateCities()
}

export async function updateCity(id: string, input: { name: string; slug: string; status: string }) {
  const city = validateCity(input)
  const supabase = await createClient()
  const { error } = await supabase.from('cities').update(city).eq('id', id)
  if (error) throw new Error(friendly(error.message))
  revalidateCities()
}

/** restaurants.city_id is ON DELETE CASCADE — refuse unless there is nothing to cascade. */
export async function deleteCity(id: string) {
  const supabase = await createClient()
  const { count, error: countError } = await supabase
    .from('restaurants')
    .select('id', { count: 'exact', head: true })
    .eq('city_id', id)
  if (countError) throw new Error(countError.message)
  if ((count ?? 0) > 0) throw new Error('This city still has restaurants (including deleted ones). Move or delete them first.')

  const { error } = await supabase.from('cities').delete().eq('id', id)
  if (error) {
    if (/foreign key/i.test(error.message)) throw new Error('This city is still used by an On our list entry. Remove those first.')
    throw new Error(error.message)
  }
  revalidateCities()
}
```

The count query must include soft-deleted restaurants, so it deliberately has no `deleted_at` filter.

- [ ] **Step 6: Create `app/actions/team.ts`**

```ts
'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canDemote, defaultTesterName, isValidEmail } from '@/lib/admin/team'

async function caller() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not signed in')
  return user
}

async function requireAdmin() {
  const user = await caller()
  const { data, error } = await createAdminClient().from('testers').select('role').eq('id', user.id).maybeSingle()
  if (error) throw new Error(error.message)
  if (data?.role !== 'admin') throw new Error('Only admins can manage the team')
  return user
}

function origin(): string {
  const h = headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  return `${proto}://${host}`
}

export async function updateMyName(name: string) {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Name is required')
  if (trimmed.length > 60) throw new Error('Keep the name under 60 characters')
  const user = await caller()
  const supabase = await createClient()
  const { error } = await supabase.from('testers').update({ name: trimmed }).eq('id', user.id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/team')
}

export async function inviteTeammate(email: string) {
  await requireAdmin()
  const clean = email.trim().toLowerCase()
  if (!isValidEmail(clean)) throw new Error('Enter a valid email address')

  const admin = createAdminClient()
  const { data, error } = await admin.auth.admin.inviteUserByEmail(clean, {
    redirectTo: `${origin()}/admin/reset-password`,
  })
  if (error) {
    if (/already (been )?registered|already exists/i.test(error.message)) throw new Error('That email already has an account')
    throw new Error(error.message)
  }
  const { error: profileError } = await admin
    .from('testers')
    .upsert({ id: data.user.id, name: defaultTesterName(clean), role: 'tester' }, { onConflict: 'id', ignoreDuplicates: true })
  if (profileError) throw new Error(profileError.message)
  revalidatePath('/admin/team')
}

export async function setRole(userId: string, role: 'tester' | 'admin') {
  await requireAdmin()
  if (role !== 'tester' && role !== 'admin') throw new Error('Unknown role')
  const admin = createAdminClient()
  if (role === 'tester') {
    const { count, error } = await admin.from('testers').select('id', { count: 'exact', head: true }).eq('role', 'admin')
    if (error) throw new Error(error.message)
    if (!canDemote(count ?? 0)) throw new Error('The team needs at least one admin')
  }
  const { error } = await admin.from('testers').update({ role }).eq('id', userId)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/team')
}

/** Ban, never delete: deleting an auth user cascades away their reviews. */
export async function removeAccess(userId: string) {
  const me = await requireAdmin()
  if (me.id === userId) throw new Error("You can't remove your own access")
  const { error } = await createAdminClient().auth.admin.updateUserById(userId, { ban_duration: '876000h' })
  if (error) throw new Error(error.message)
  revalidatePath('/admin/team')
}

export async function restoreAccess(userId: string) {
  await requireAdmin()
  const { error } = await createAdminClient().auth.admin.updateUserById(userId, { ban_duration: 'none' })
  if (error) throw new Error(error.message)
  revalidatePath('/admin/team')
}
```

Note that `headers()` is synchronous in Next 14.2.

- [ ] **Step 7: Verify and commit**

Run `npx tsc --noEmit` (expect exit 0) and `npm test` (expect pass).

Run `grep -rln "lib/supabase/admin" app components | xargs grep -l "'use client'"`. Expected: no output.

```bash
git add supabase/migrations/010_admin_cities_team.sql lib/supabase/admin.ts lib/admin/currentTester.ts app/actions/cities.ts app/actions/team.ts app/admin/layout.tsx
git commit -m "Auto-create tester profiles; add city and team server actions

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Cities page

**Files:**
- Create: `app/admin/cities/page.tsx`, `components/admin/CityList.tsx`
- Modify: `components/admin/AdminShell.tsx` (NAV)

**Interfaces:**
- Consumes:
  - `createCity`, `updateCity`, `deleteCity` (Task 2)
  - `slugify`, `CityStatus` (Task 1)
  - `SidePanel`, `Button`, `Field`, `Input`, `EmptyState`, `useToast`
- Produces: `type AdminCity = { id: string; name: string; slug: string; status: 'active' | 'coming_soon'; restaurants: number; liveRestaurants: number; dishes: number }`, exported from `components/admin/CityList.tsx`.

- [ ] **Step 1: Add both new nav entries in `components/admin/AdminShell.tsx`**

Add these after Restaurants:

```ts
  { href: '/admin/cities', label: 'Cities', icon: '🏙' },
  { href: '/admin/team', label: 'Team', icon: '👥' },
```

The Team page arrives in Task 4. Until then the link 404s, which is acceptable inside this branch.

- [ ] **Step 2: Create `components/admin/CityList.tsx`**

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createCity, deleteCity, updateCity } from '@/app/actions/cities'
import { slugify, type CityStatus } from '@/lib/admin/city'
import SidePanel from './SidePanel'
import { Button, EmptyState, Field, Input } from './ui'
import { useToast } from './Toast'

export type AdminCity = {
  id: string
  name: string
  slug: string
  status: CityStatus
  /** All restaurants, soft-deleted included — this is what blocks a delete. */
  restaurants: number
  liveRestaurants: number
  dishes: number
}

type Form = { name: string; slug: string; status: CityStatus; slugTouched: boolean }

const STATUS_LABEL: Record<CityStatus, string> = { active: 'Live', coming_soon: 'Coming soon' }

export default function CityList({ cities }: { cities: AdminCity[] }) {
  const router = useRouter()
  const toast = useToast()
  const [openId, setOpenId] = useState<string | 'new' | null>(null)
  const current = openId && openId !== 'new' ? cities.find((c) => c.id === openId) ?? null : null
  const lastCity = useRef<AdminCity | null>(null)
  if (current) lastCity.current = current
  else if (openId === 'new') lastCity.current = null
  const shown = openId === 'new' ? null : current ?? (openId === null ? lastCity.current : null)

  const [form, setForm] = useState<Form>({ name: '', slug: '', status: 'active', slugTouched: false })
  const [busy, setBusy] = useState<null | 'save' | 'delete'>(null)
  const [error, setError] = useState('')

  const resetKey = openId === null ? null : openId
  const shownRef = useRef(shown)
  shownRef.current = shown
  useEffect(() => {
    if (resetKey === null) return
    const c = shownRef.current
    setForm(c ? { name: c.name, slug: c.slug, status: c.status, slugTouched: true } : { name: '', slug: '', status: 'active', slugTouched: false })
    setError('')
  }, [resetKey])

  const initial = shown ? { name: shown.name, slug: shown.slug, status: shown.status } : { name: '', slug: '', status: 'active' as CityStatus }
  const dirty = form.name !== initial.name || form.slug !== initial.slug || form.status !== initial.status

  function close() {
    if (dirty && !window.confirm('Discard your unsaved changes?')) return
    setOpenId(null)
  }

  async function save() {
    setBusy('save'); setError('')
    try {
      const input = { name: form.name, slug: form.slug, status: form.status }
      if (openId === 'new') await createCity(input)
      else if (shown) await updateCity(shown.id, input)
      toast('Saved')
      router.refresh()
      setOpenId(null)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(null)
    }
  }

  async function remove() {
    if (!shown || !window.confirm(`Delete ${shown.name}? This can't be undone.`)) return
    setBusy('delete'); setError('')
    try {
      await deleteCity(shown.id)
      toast('Deleted')
      router.refresh()
      setOpenId(null)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button type="button" onClick={() => setOpenId('new')}>+ Add city</Button>
      </div>

      {cities.length === 0 ? (
        <EmptyState icon="🏙" text="No cities yet." />
      ) : (
        <ul className="overflow-hidden rounded-2xl border border-warm-200 bg-white">
          {cities.map((c) => (
            <li key={c.id} className="border-t border-warm-100 first:border-t-0">
              <button type="button" onClick={() => setOpenId(c.id)} className="flex w-full min-w-0 items-center gap-4 px-4 py-3.5 text-left hover:bg-[#fdf6f2]">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-anek text-[15.5px] font-semibold text-charcoal">{c.name}</p>
                  <p className="truncate font-anek text-[13px] text-muted">/{c.slug}</p>
                </div>
                <span className="hidden font-anek text-[13px] text-muted sm:inline">
                  {c.liveRestaurants} {c.liveRestaurants === 1 ? 'restaurant' : 'restaurants'} · {c.dishes} {c.dishes === 1 ? 'dish' : 'dishes'}
                </span>
                <span className={`whitespace-nowrap rounded-full border px-2.5 py-0.5 font-anek text-[11.5px] font-semibold ${
                  c.status === 'active' ? 'border-[#bfe6d2] bg-[#eaf7f0] text-[#1f7a52]' : 'border-warm-200 bg-warm-100 text-muted'
                }`}>
                  {STATUS_LABEL[c.status]}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <SidePanel
        open={openId !== null}
        onClose={close}
        title={openId === 'new' ? 'Add a city' : shown?.name ?? ''}
        subtitle={shown ? `${shown.liveRestaurants} restaurants · ${shown.dishes} dishes` : undefined}
        footer={
          <div className="space-y-3">
            {error && <p role="alert" className="font-anek text-[13.5px] text-spice">{error}</p>}
            <div className="flex items-center gap-2">
              {shown && (
                <Button variant="danger" type="button" loading={busy === 'delete'} disabled={busy !== null || shown.restaurants > 0} onClick={remove}
                  title={shown.restaurants > 0 ? 'Move or delete its restaurants first' : undefined}>
                  Delete
                </Button>
              )}
              <Button className="ml-auto" type="button" loading={busy === 'save'} disabled={busy !== null} onClick={save}>Save</Button>
            </div>
            {shown && shown.restaurants > 0 && (
              <p className="font-anek text-[12.5px] text-muted">A city with restaurants can&apos;t be deleted — move or delete its restaurants first.</p>
            )}
          </div>
        }
      >
        <div className="space-y-5">
          <Field label="City name" htmlFor="c-name">
            <Input id="c-name" value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value, slug: f.slugTouched ? f.slug : slugify(e.target.value) }))} />
          </Field>
          <Field label="Slug" htmlFor="c-slug" hint={`Used in links: /${form.slug || 'city-name'}. Changing it breaks old links.`}>
            <Input id="c-slug" value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value, slugTouched: true }))} />
          </Field>
          <Field label="Status">
            <div className="inline-flex overflow-hidden rounded-lg border border-warm-200" role="radiogroup" aria-label="Status">
              {(['active', 'coming_soon'] as const).map((s) => (
                <button key={s} type="button" role="radio" aria-checked={form.status === s} onClick={() => setForm((f) => ({ ...f, status: s }))}
                  className={`px-4 py-2 font-anek text-[14px] ${form.status === s ? 'bg-ember text-white' : 'bg-white hover:bg-warm-100'}`}>
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          </Field>
          <p className="font-anek text-[13px] text-muted">
            <b>Live</b> cities are browsable and searchable. <b>Coming soon</b> cities show as a locked tile on the homepage.
          </p>
        </div>
      </SidePanel>
    </div>
  )
}
```

- [ ] **Step 3: Create `app/admin/cities/page.tsx`**

```tsx
import { createClient } from '@/lib/supabase/server'
import CityList, { type AdminCity } from '@/components/admin/CityList'
import { EmptyState } from '@/components/admin/ui'

export const metadata = { title: 'Cities — Chakh admin' }

export default async function AdminCitiesPage() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('cities')
    .select('id, name, slug, status, restaurants(id, deleted_at, dishes(id, deleted_at))')
    .order('name')
  if (error) {
    console.error('[admin] cities query failed:', error.message)
    return <EmptyState icon="⚠️" text="Couldn't load cities — refresh to retry." />
  }

  const cities: AdminCity[] = (data ?? []).map((c: any) => {
    const all = c.restaurants ?? []
    const live = all.filter((r: any) => !r.deleted_at)
    return {
      id: c.id,
      name: c.name,
      slug: c.slug,
      status: c.status === 'coming_soon' ? 'coming_soon' : 'active',
      restaurants: all.length,
      liveRestaurants: live.length,
      dishes: live.reduce((n: number, r: any) => n + (r.dishes ?? []).filter((d: any) => !d.deleted_at).length, 0),
    }
  })

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-anek text-3xl font-bold text-charcoal">Cities</h1>
        <p className="font-anek text-[15px] text-muted">Add a city, or switch it between Live and Coming soon.</p>
      </header>
      <CityList cities={cities} />
    </div>
  )
}
```

- [ ] **Step 4: Verify and commit**

Run `npx tsc --noEmit` and `npm test`.

```bash
git add app/admin/cities components/admin/CityList.tsx components/admin/AdminShell.tsx
git commit -m "Add Cities admin: add, rename, Live/Coming soon, safe delete

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Team page, invite landing and docs

**Files:**
- Create: `app/admin/team/page.tsx`, `components/admin/TeamView.tsx`
- Modify: `components/RecoveryRedirect.tsx`, `app/admin/reset-password/page.tsx`, `CLAUDE.md`

**Interfaces:**
- Consumes:
  - `ensureTester`, `createAdminClient` (Task 2)
  - `updateMyName`, `inviteTeammate`, `setRole`, `removeAccess`, `restoreAccess` (Task 2)
  - `memberState`, `MemberState` (Task 1)
  - `authLinkType` (Task 1)
- Produces: `type TeamMember = { id: string; name: string; email: string; role: 'tester' | 'admin'; lastSignIn: string | null; state: MemberState }`, exported from `components/admin/TeamView.tsx`.

- [ ] **Step 1: Create `app/admin/team/page.tsx`**

```tsx
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ensureTester } from '@/lib/admin/currentTester'
import { memberState } from '@/lib/admin/team'
import TeamView, { type TeamMember } from '@/components/admin/TeamView'
import { EmptyState } from '@/components/admin/ui'

export const metadata = { title: 'Team — Chakh admin' }

export default async function AdminTeamPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null // middleware already redirects; keeps types honest

  try {
    const me = await ensureTester({ id: user.id, email: user.email })
    const admin = createAdminClient()
    const [{ data: testers, error: tErr }, { data: usersPage, error: uErr }] = await Promise.all([
      admin.from('testers').select('id, name, role').order('name'),
      admin.auth.admin.listUsers({ page: 1, perPage: 200 }),
    ])
    if (tErr) throw new Error(tErr.message)
    if (uErr) throw new Error(uErr.message)

    const byId = new Map(usersPage.users.map((u) => [u.id, u]))
    const members: TeamMember[] = (testers ?? []).map((t: any) => {
      const u = byId.get(t.id) as any
      return {
        id: t.id,
        name: t.name,
        email: u?.email ?? '—',
        role: t.role === 'admin' ? 'admin' : 'tester',
        lastSignIn: u?.last_sign_in_at ?? null,
        state: memberState({ last_sign_in_at: u?.last_sign_in_at ?? null, banned_until: u?.banned_until ?? null }),
      }
    })

    return (
      <div className="space-y-6">
        <header>
          <h1 className="font-anek text-3xl font-bold text-charcoal">Team</h1>
          <p className="font-anek text-[15px] text-muted">Who can sign in to the Chakh admin.</p>
        </header>
        <TeamView me={{ id: me.id, name: me.name, role: me.role, email: user.email ?? '' }} members={members} />
      </div>
    )
  } catch (err) {
    console.error('[admin] team query failed:', (err as Error).message)
    return <EmptyState icon="⚠️" text="Couldn't load the team — refresh to retry." />
  }
}
```

- [ ] **Step 2: Create `components/admin/TeamView.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { inviteTeammate, removeAccess, restoreAccess, setRole, updateMyName } from '@/app/actions/team'
import type { MemberState } from '@/lib/admin/team'
import { Button, Field, Input } from './ui'
import { useToast } from './Toast'

export type TeamMember = {
  id: string
  name: string
  email: string
  role: 'tester' | 'admin'
  lastSignIn: string | null
  state: MemberState
}

const STATE: Record<MemberState, { text: string; cls: string }> = {
  active: { text: 'Active', cls: 'border-[#bfe6d2] bg-[#eaf7f0] text-[#1f7a52]' },
  invited: { text: 'Invited', cls: 'border-[#f1d9a8] bg-[#fff6e6] text-[#8a5a12]' },
  removed: { text: 'Removed', cls: 'border-warm-200 bg-warm-100 text-muted' },
}

function formatDate(iso: string | null): string {
  if (!iso) return 'Never signed in'
  return `Last in ${new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
}

export default function TeamView({
  me, members,
}: {
  me: { id: string; name: string; role: 'tester' | 'admin'; email: string }
  members: TeamMember[]
}) {
  const router = useRouter()
  const toast = useToast()
  const isAdmin = me.role === 'admin'
  const [name, setName] = useState(me.name)
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function run(key: string, fn: () => Promise<void>, done: string) {
    setBusy(key); setError('')
    try { await fn(); toast(done); router.refresh() }
    catch (err) { setError((err as Error).message) }
    finally { setBusy(null) }
  }

  return (
    <div className="space-y-6">
      {error && <p role="alert" className="rounded-lg bg-[#fdf0ea] px-4 py-3 font-anek text-[14px] text-spice-dark">{error}</p>}

      <section className="rounded-2xl border border-warm-200 bg-white p-6">
        <h2 className="font-anek text-lg font-bold text-charcoal">You</h2>
        <p className="mb-4 font-anek text-[13.5px] text-muted">{me.email} · {me.role === 'admin' ? 'Admin' : 'Tester'}</p>
        <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); run('name', () => updateMyName(name), 'Name updated') }}>
          <div className="min-w-0 flex-1">
            <Field label="Display name" htmlFor="me-name" hint="Shown on your reviews.">
              <Input id="me-name" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
          </div>
          <Button type="submit" variant="secondary" loading={busy === 'name'} disabled={busy !== null || name.trim() === me.name} className="mb-6">Save</Button>
        </form>
      </section>

      {isAdmin && (
        <section className="rounded-2xl border border-warm-200 bg-white p-6">
          <h2 className="font-anek text-lg font-bold text-charcoal">Invite a teammate</h2>
          <p className="mb-4 font-anek text-[13.5px] text-muted">They get an email, choose their own password, and join as a tester.</p>
          <form className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => { e.preventDefault(); run('invite', async () => { await inviteTeammate(email); setEmail('') }, 'Invite sent') }}>
            <div className="min-w-0 flex-1">
              <Field label="Email" htmlFor="invite-email">
                <Input id="invite-email" type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} />
              </Field>
            </div>
            <Button type="submit" loading={busy === 'invite'} disabled={busy !== null || !email.trim()}>Send invite</Button>
          </form>
        </section>
      )}

      <section>
        <h2 className="mb-3 font-anek text-lg font-bold text-charcoal">Everyone ({members.length})</h2>
        <ul className="overflow-hidden rounded-2xl border border-warm-200 bg-white">
          {members.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-3 border-t border-warm-100 px-4 py-3.5 first:border-t-0">
              <div className="min-w-0 flex-1">
                <p className="truncate font-anek text-[15.5px] font-semibold text-charcoal">
                  {m.name}{m.id === me.id && <span className="ml-1.5 font-medium text-muted">(you)</span>}
                </p>
                <p className="truncate font-anek text-[13px] text-muted">{m.email} · {formatDate(m.lastSignIn)}</p>
              </div>
              <span className={`whitespace-nowrap rounded-full border px-2.5 py-0.5 font-anek text-[11.5px] font-semibold ${STATE[m.state].cls}`}>
                {STATE[m.state].text}
              </span>
              <span className="w-14 font-anek text-[13px] font-medium text-charcoal">{m.role === 'admin' ? 'Admin' : 'Tester'}</span>
              {isAdmin && m.id !== me.id && (
                <div className="flex gap-2">
                  <Button variant="secondary" type="button" className="px-3 py-1.5 text-[13px]" disabled={busy !== null} loading={busy === `role-${m.id}`}
                    onClick={() => run(`role-${m.id}`, () => setRole(m.id, m.role === 'admin' ? 'tester' : 'admin'), 'Role updated')}>
                    {m.role === 'admin' ? 'Make tester' : 'Make admin'}
                  </Button>
                  {m.state === 'removed' ? (
                    <Button variant="secondary" type="button" className="px-3 py-1.5 text-[13px]" disabled={busy !== null} loading={busy === `acc-${m.id}`}
                      onClick={() => run(`acc-${m.id}`, () => restoreAccess(m.id), 'Access restored')}>
                      Restore
                    </Button>
                  ) : (
                    <Button variant="danger" type="button" className="px-3 py-1.5 text-[13px]" disabled={busy !== null} loading={busy === `acc-${m.id}`}
                      onClick={() => {
                        if (!window.confirm(`Remove ${m.name}'s access? Their reviews stay. You can restore access later.`)) return
                        run(`acc-${m.id}`, () => removeAccess(m.id), 'Access removed')
                      }}>
                      Remove
                    </Button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
        {!isAdmin && <p className="mt-3 font-anek text-[13px] text-muted">Only admins can invite people or change access.</p>}
      </section>
    </div>
  )
}
```

- [ ] **Step 3: Send invite and recovery links to the password form**

Replace the body of `components/RecoveryRedirect.tsx`'s effect so it also handles invite links. The hash type is captured before the client consumes the hash:

```tsx
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { authLinkType } from '@/lib/admin/authMessages'

const RESET_PATH = '/admin/reset-password'

/**
 * Auth emails don't always land on /auth/callback. Recovery links that fall back to the
 * Site URL, and admin invite links (which can't use PKCE), arrive as a #access_token…&type=
 * hash on whatever page they land on — often /admin/login after the middleware bounce,
 * since browsers keep the hash across redirects. The browser client signs the user in
 * from that hash; this sends them on to choose a password instead of leaving them
 * silently signed in.
 */
export default function RecoveryRedirect() {
  const router = useRouter()

  useEffect(() => {
    // Read before createClient(): the client strips the hash once it has consumed it.
    const linkType = authLinkType(window.location.hash)
    const supabase = createClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (window.location.pathname === RESET_PATH) return
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && linkType === 'recovery')) {
        router.replace(RESET_PATH)
      } else if (event === 'SIGNED_IN' && linkType === 'invite') {
        router.replace(`${RESET_PATH}?welcome=1`)
      }
    })
    return () => subscription.unsubscribe()
  }, [router])

  return null
}
```

- [ ] **Step 4: Add welcome copy to the reset page**

In `app/admin/reset-password/page.tsx`:
- Import `useSearchParams` from `next/navigation` and read `const welcome = useSearchParams().get('welcome') === '1'`.
- Change the `AuthLayout` props:
  - `title={welcome ? 'Welcome to Chakh — set your password' : 'Choose a new password'}`
  - `subtitle={welcome ? "You've been invited to the Chakh admin. Pick a password to finish." : "You'll use it to sign in to the Chakh admin."}`

The page is a client component that uses `useSearchParams`, so wrap it:
1. Rename the current default export to `function ResetPasswordForm()`.
2. Add:

```tsx
export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  )
}
```

Import `Suspense` from `react`.

- [ ] **Step 5: Update `CLAUDE.md`**

In the **Admin routes** paragraph, change "Restaurants (`/admin/restaurants`)." to "Restaurants (`/admin/restaurants`), Cities (`/admin/cities` — Live/Coming soon; delete only when a city has no restaurants, because restaurants cascade), Team (`/admin/team` — tester profiles are auto-created on sign-in; admins invite by email, change roles, and remove access by banning, never deleting, since reviews cascade with the user)."

In the **Admin password reset** section:
- Append "Add `…/admin/reset-password` to the same Redirect URLs list — team invites land there."
- Add "Migration `010_admin_cities_team.sql` must be applied for the Cities page to save and for testers to rename themselves."

Also replace the outdated Directus line "go to **Settings → Data Model → Reload** in the Directus UI to pick up schema changes" with "restart Directus (`cd cms && npm start`) to pick up schema changes (Directus 11 has no reload button)".

- [ ] **Step 6: Verify and commit**

Run `npx tsc --noEmit` and `npm test`.

```bash
git add app/admin/team components/admin/TeamView.tsx components/RecoveryRedirect.tsx app/admin/reset-password/page.tsx CLAUDE.md
git commit -m "Add Team admin: profiles, invites, roles, remove access; land invites on set-password

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
