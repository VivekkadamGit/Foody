# Admin Redesign — Design

**Date:** 2026-10-02
**Status:** Approved in brainstorming. The user chose look C and the side-panel editing, and asked for the remaining sections to be designed without per-section sign-off.
**Builds on:** migrations 007 (dish taxonomy) and 008 (trending buzz + tags), `lib/taxonomy.ts`, `app/actions/*`.

## Goal

The admin is where Chakh's data gets made, and today it cannot produce searchable data:

- Dishes cannot be tagged.
- Viral places have no admin screen.
- There is no overview of what still needs a score or tags.

This redesign does five things:

- makes every field search depends on editable
- adds an "On our list" admin
- gives the admin a proper Spice Market look
- fixes the login experience, including self-service password reset

No database migrations are needed. Every column this writes to already exists.

## Decisions

| Question | Decision |
|---|---|
| Look | **C**: dark ink sidebar (`ink`, `ember-light` accents) + cream workspace (`cream`, white cards, `ember` buttons) |
| Editing a dish | **Side panel** next to the list, with **Save & next →**. Full screen on phones |
| Untagged dishes | Still saveable. They are flagged in a **Needs tags** tab and counted on the dashboard |
| Tag vocabulary | Comes only from `lib/taxonomy.ts`. The admin never hard-codes tag lists |
| Login extras | A clear error message, a **Forgot password** flow, and show/hide password |
| Build approach | Shared `components/admin/*` building blocks; every admin page rebuilt on them. No UI library added |

## 1. Layout and building blocks

### AdminShell (`app/admin/layout.tsx` + `components/admin/AdminShell.tsx`)

- **Signed in:**
  - Left sidebar, 232px, `bg-ink`. It holds:
    - the logo: "chakh" wordmark + "admin" label
    - nav links: Dashboard `/admin`, Dishes `/admin/dishes`, On our list `/admin/trending`, Restaurants `/admin/restaurants`
    - View site ↗ `/`
    - Sign out, at the bottom
  - The active link uses `bg-ink-card text-ember-light`.
  - Workspace: `bg-cream`, content `max-w-6xl`, padding 24–32px.
- **Below `md`:** the sidebar becomes a top bar with a ☰ button that opens it as an overlay.
- **Signed out:** children render standalone, as today. This covers login, forgot-password and reset-password.

### Building blocks (`components/admin/`)

| Component | Contract |
|---|---|
| `Button` | `variant: 'primary' \| 'secondary' \| 'danger' \| 'ghost'`, `loading?: boolean`. Primary = `bg-ember text-white` |
| `Field` | `label`, `hint?`, `error?`, children. Renders label → control → hint/error |
| `Input`, `Textarea`, `Select` | Styled native controls (`bg-cream border-warm-200 rounded-lg`), forwarding all props |
| `Chip` | Toggle pill. `selected`, `onClick`. Selected = `bg-ember text-white` |
| `TagPicker` | Value `DishTags` (below), `onChange`. Renders five labelled rows from `lib/taxonomy.ts`:<br>• **Diet** (single, required for "tagged")<br>• **Category** (single, required for "tagged", chips grouped under Dessert / Drinks / Mains / Snacks from `CATEGORY_TREE`)<br>• **Cuisine** (single, optional, can be cleared)<br>• **Taste** (multi)<br>• **Meal** (multi)<br>Chip labels come from `tagLabel()` |
| `SidePanel` | `open`, `title`, `onClose`, `footer`, children. Fixed right panel, `w-full md:w-[480px]`, slide-in. Esc and ✕ close it. Before closing with unsaved changes, it asks via `confirm()`. Body scrolls; footer is sticky |
| `StatusBadge` | `status: 'needs_score' \| 'needs_tags' \| 'scored' \| 'deleted'`, `score?` |
| `Toast` | `useToast()` → `toast('Saved')`. Bottom-right, auto-hides after 2.5s. One `ToastProvider` in AdminShell |
| `CityTabs` | City switcher driven by a `?city=` search param. Defaults to the first of `CITY_PRIORITY` that exists |
| `EmptyState` | Icon + line + optional action |

### Shared logic (`lib/admin/`) — pure and unit tested

- `dishTags.ts`:
  - `type DishTags = { diet: Diet | null; category: CategoryLeaf | null; cuisine: Cuisine | null; tastes: Taste[]; meals: Meal[] }`
  - `validateTags(input: unknown): DishTags`. Throws `Error('Unknown diet: x')` etc. for values outside the taxonomy; drops duplicates.
  - `tagLabel(dim, value)` gives human labels. Category uses the same labels as `BOARD_LABELS` in `lib/search/rank.ts` ("Cakes & Bakes"…), everything else uses `labelFor`.
- `dishStatus.ts`: `dishStatus(d: { score: number | null; diet: string | null; category: string | null; deleted_at: string | null })` returns `'deleted' | 'needs_tags' | 'needs_score' | 'scored'`. Precedence is deleted → needs_tags → needs_score → scored. It reuses `isUntagged` from `lib/taxonomy.ts`.
- `score.ts`: `parseScore(raw: string): number | null`. Blank gives null. Otherwise it must be a number from 0 to 10, rounded to 1 decimal; anything else throws `'Score must be between 0 and 10'`.

### Server actions

- **`app/actions/dishes.ts`:**
  - `createDish(input)` (new) and `updateDish(id, input)` (extended) accept `{ restaurant_id, name, description, is_must_try, score, photo_url, ...DishTags }`.
  - Both run `validateTags` and the score check server-side and throw on bad input.
  - Both revalidate `/admin/dishes`, `/admin/restaurants/[id]`, `/admin` and `/`.
  - `updateDish` drops its `restaurantId` positional argument: the restaurant comes from the row. Callers are updated.
- **Add dish:** `AddDishForm`'s direct browser `insert` is replaced by `createDish`. The photo upload stays in the browser (Supabase Storage `dish-photos`, unchanged pattern) and passes `photo_url`.
- **`app/actions/trending.ts`:** `TrendingInput` gains `buzz` (1–3) and the `DishTags` fields. Both are validated server-side. `revalidate()` also covers `/admin` and `/search`.
- **`types/database.ts`:** `Dish` gains `score: number | null`, `diet`, `category`, `cuisine`, `tastes: string[]`, `meals: string[]`, `deleted_at: string | null`.

## 2. Dishes page — `/admin/dishes`

- **Header:** "Dishes", a CityTabs switcher, and a **+ Add dish** button.
- **Tabs** (`?tab=` param):
  - **All**
  - **Needs score** (n)
  - **Needs tags** (n)
  - **Deleted**
- **Counts:** the n values are computed from the city's dishes using `dishStatus`. "Needs score" includes any non-deleted dish with a null score; a dish can be in both Needs tabs.
- **Name filter:** filters the visible list client-side.
- **Rows:**
  - photo thumbnail (or striped placeholder)
  - name
  - restaurant
  - StatusBadge
  - score (or "—")
- **Clicking a row** opens the **DishPanel**: a SidePanel containing name, description, score input (0–10, step 0.1), Must-try toggle, photo (replace or remove), and TagPicker.
- **DishPanel footer:**
  - Delete (danger; becomes **Restore** on deleted dishes), using the existing `softDeleteDish` / `restoreDish`
  - Save
  - **Save & next →**
- **Save & next:** saves, then opens the next dish in the current tab's list order. On the last one it closes the panel and toasts "That was the last one".
- **+ Add dish:** opens the same panel empty, with a required **Restaurant** select (restaurants in the selected city) at the top.
- **Data:** a server component loads the city's dishes with `restaurants!inner(id, name, city_id, cities!inner(slug))`, including soft-deleted rows, which only the Deleted tab shows. A client component holds tab, filter and panel state.

## 3. On our list — `/admin/trending`

- **Header:** "On our list" with the subtitle "Places we plan to visit — shown on search and What's New, never scored", CityTabs, and **+ Add place**.
- **Tabs:**
  - **Live**: not deleted, not visited
  - **Visited**
  - **Deleted**
- **Rows:**
  - 🔥×buzz
  - dish @ place
  - area
  - a "Needs tags" badge when diet or category is missing
  - rank
- **TrendingPanel** (SidePanel) fields:
  - Dish name\*, Place name\*, Area
  - **Why it's buzzing\*** (required; the existing column is NOT NULL)
  - Source link (must start with `http`)
  - Photo (upload to `dish-photos` under `trending/<city_id>/…`)
  - "We have this restaurant" (optional select of the city's restaurants)
  - **Buzz**: three-step segmented control 🔥 / 🔥🔥 / 🔥🔥🔥
  - Rank (number, lower = earlier)
  - TagPicker
- **Footer:** Delete or Restore, Save, and **Mark visited…**
- **Mark visited…** shows a select of the city's dishes. Confirming calls the existing `markTrendingVisited`, which moves the entry to Visited.

## 4. Login and password reset

### `/admin/login`

- **Layout:** a full-screen split.
  - **Left (desktop only):** `bg-ink` panel with the chakh wordmark, the line "The honest food guide — back office", and drifting dish names echoing the homepage hero, as static text, no animation loop.
  - **Right:** a cream panel with the form card.
- **Fields:** email; password with a **show/hide** eye toggle (`aria-pressed`, `aria-label`).
- **Links:** **Forgot password?** links to `/admin/forgot-password`.
- **Errors are mapped** to clear messages by a pure `loginErrorMessage(err)` in `lib/admin/authMessages.ts`:
  - `Invalid login credentials` → "That email and password don't match a Chakh admin account. Your Directus login is separate and won't work here. Forgot your password?"
  - `Email not confirmed` → "This account hasn't been confirmed yet. Ask the admin to confirm it in Supabase → Authentication → Users."
  - Network or fetch failure → "Can't reach the login server. Check your connection and try again."
  - Anything else → the raw message.
- **Query messages:** `?reset=sent` shows "Check your inbox for a reset link." `?error=link` shows "That reset link has expired or was already used. Request a new one."

### `/admin/forgot-password` (public)

- **Form:** email.
- **On submit:** calls `supabase.auth.resetPasswordForEmail(email, { redirectTo: \`${location.origin}/auth/callback?next=/admin/reset-password\` })`.
- **Response:** always the same message, "If an account exists for that email, a reset link is on its way.", so it never reveals whether an account exists.

### `/auth/callback` (route handler, outside `/admin`)

- Exchanges `?code=` for a session with the server Supabase client (`exchangeCodeForSession`).
- Then redirects to `next`, accepting only paths that start with `/admin/`; anything else becomes `/admin`.
- If the code is missing or invalid, it redirects to `/admin/login?error=link`.

### `/admin/reset-password` (requires the recovery session)

- **Fields:** new password and confirm, both with show/hide.
- **Validation:** minimum 8 characters, and the two must match.
- **On submit:** `supabase.auth.updateUser({ password })`, then redirect to `/admin` and toast "Password updated".
- **Without a session**, the middleware sends the user to login, as for any admin page.

### Middleware

- **Public paths:** `/admin/login` and `/admin/forgot-password`.
- **Signed-in users** on either page are redirected to `/admin`.

### One-time Supabase setup (documented in CLAUDE.md; the user does it)

- Go to **Authentication → URL Configuration → Redirect URLs**.
- Add `http://localhost:3000/auth/callback` and the Vercel domain's `/auth/callback`.
- Without these, Supabase rejects the reset redirect.

### Account recovery right now

If no admin account exists, create one in **Supabase → Authentication → Users → Add user** with Auto Confirm. Otherwise use Forgot password. Claude does not create accounts or set passwords.

## 5. Dashboard and restaurant pages

### Dashboard (`/admin`)

- **Stat cards:**
  - Restaurants
  - Dishes
  - **Scored** "x / y"
  - **On our list** (live count)
- **"Needs attention" card:**
  - "N dishes need a score" → `/admin/dishes?tab=needs_score`
  - "N dishes need tags" → `?tab=needs_tags`
  - "N places on our list need tags" → `/admin/trending`
  - When all are zero: "All caught up".
- **Lists:** recent reviews and recent restaurants (existing data), restyled.
- **Counts exclude** soft-deleted rows.

### Restaurants (`/admin/restaurants`)

- **New list page:**
  - CityTabs, a search box, and + Add restaurant
  - rows showing name, area, dish count and price tier
  - deleted restaurants shown greyed out under a "Show deleted" toggle

### `/admin/restaurants/[id]` (existing)

- Restyled.
- The restaurant edit and delete card stays (`RestaurantActions`, restyled).
- The dish list uses the same rows + **DishPanel** as `/admin/dishes`.
- "Add a dish" opens DishPanel with the restaurant preset, replacing the inline `AddDishForm`. Its upload logic moves into DishPanel.
- Reviews stay as today, restyled.

### Other pages

- `/admin/restaurants/new` and `/admin/dishes/[id]/review` are restyled with the building blocks. Their behaviour is unchanged.

## Error handling

- **Server actions** throw `Error(message)`. Panels catch it, show it under the footer, and keep the user's input.
- **Successful saves** toast "Saved".
- **Server-component query failures** `console.error('[admin] …')` and render an EmptyState saying "Couldn't load — refresh to retry". They are never silently empty.
- **Photo upload failure** shows the storage error and does not save the row.

## Testing

- **Vitest unit tests** cover the pure functions: `validateTags`, `tagLabel`, `dishStatus`, `parseScore`, and `loginErrorMessage`.
- **Browser verification:**
  - Pages that need no sign-in are verified directly: login (layout, show/hide, error mapping via a deliberately wrong password *typed by the user*), forgot-password, and the `/auth/callback` error redirect.
  - Signed-in pages are verified after **the user signs in themselves** in the browser pane. Claude does not enter credentials.
- **Before merge:** `npx tsc --noEmit` and `npm run build` must pass.

## Out of scope

- Roles and permissions (`testers.role` is unused today and stays that way).
- Bulk editing.
- Image cropping.
- Directus changes.
- Inviting new testers from the admin.
