# Landing Page Redesign — Design Spec
**Date:** 2026-06-01  
**Status:** Design approved, ready for implementation

---

## Overview

Redesign the public-facing homepage (`app/page.tsx`) to be clean, premium, and food-forward. Goal: users immediately understand what to do (search for food) and feel hungry looking at it.

---

## Color Palette — Spice Market

| Role | Name | Hex |
|---|---|---|
| **Primary text / navbar** | Charcoal | `#1A1614` |
| **CTA / accents** | Spice Red | `#C0432A` |
| **Logo / gold highlights** | Warm Gold | `#C8A97E` |
| **Page background** | Cream | `#FAF6EF` |
| **Card backgrounds** | Off-white | `#F5F0E8` |
| **Borders / dividers** | Linen | `#E8E2D9` |
| **Subtext / metadata** | Muted | `#888880` |
| **CTA hover** | Spice Red Light | `#D4614A` |
| **CTA active** | Spice Red Dark | `#9E3520` |
| **Must Try badge** | Success Green | `#2D6A2D` |

**Rationale:** Red is scientifically the strongest appetite-stimulating color (used by Zomato, Swiggy, McDonald's). Cream background reduces eye strain for review reading.

---

## Page Structure

```
[ Navbar ]
[ Hero — Dark, with floating dish names + big search bar ]
[ Top Picks — 3-4 highest rated dishes ]
[ Browse by City — 3 city cards ]
[ Footer ]
```

---

## Section Specs

### 1. Navbar
- Dark background (`#1A1614`)
- Logo: "🍴 Foody" in Warm Gold
- City links: Ahmedabad · Surat · Vadodara
- Sticky on scroll

### 2. Hero
- Dark gradient background (`#1A1614` → `#2C1F1A`)
- **Floating dish names** — animate in background (from Supabase, location-filtered)
  - Spawn in 4 safe zones: top strip, bottom strip, left strip, right strip
  - Glide in fully random directions (any angle, 60–130px distance)
  - Random font sizes: 18px–52px
  - Subtle opacity: 10–32%
  - Duration: 12–20s per word, one new word every ~2.5s
  - Words have `z-index:1`, hero content has `z-index:10` — ~10% overlap behind title is intentional
- **Eyebrow text:** "Your finest food guide" (static, always)
- **H1:** "Find your next favourite dish"
- **Sub text:** "Popular food around [City]" — appears after location is granted, in Warm Gold
- **Location prompt overlay** on first load — "Allow Location" / "Skip"
- **Big search bar** — white, red border on focus, `#C0432A` search button

#### Dish data for floating names
- Fetched server-side at page load for all 3 cities (pre-fetch all, pick by location client-side)
- Source: Supabase `dishes` table — `name` field, filtered by city via restaurant join
- Only active (non-deleted) dishes: `.is('deleted_at', null)`

#### Location detection
- `navigator.geolocation.getCurrentPosition()`
- Match to nearest city by Euclidean distance on lat/lng
- Fallback to Ahmedabad if denied or outside Gujarat

### 3. Top Picks
- Background: Cream (`#FAF6EF`)
- Section label: "✦ Top Picks" in Spice Red
- Section title: "Most loved dishes right now"
- 3–4 dish cards, sorted by average rating descending
- Each card shows: dish emoji/photo thumbnail, name, restaurant + city, tags (Must Try, Vegetarian, etc.), rating score
- "View all →" link

### 4. Browse by City
- Background: Off-white (`#F5F0E8`)
- 3 city cards in a row: Ahmedabad, Surat, Vadodara
- Each: dark card (`#1A1614`), emoji, city name, restaurant count

### 5. Footer
- Dark (`#1A1614`)
- Logo + tagline: "Honest food reviews from Gujarat"

---

## Responsive Behaviour

| Breakpoint | Layout |
|---|---|
| Mobile (< 640px) | Single column, full width. Top Picks stacked. |
| Tablet (640–1024px) | Max-width 720px centered. Top Picks 2-col grid. |
| Desktop (> 1024px) | Max-width 1100px. Top Picks 3-col grid. Wider hero. |

---

## Typography
- **Display / headings:** Playfair Display (already in project)
- **Body / UI:** DM Sans (already in project)

---

## Data Sources
| Section | Source | Query |
|---|---|---|
| Floating dish names | Supabase `dishes` | Top dishes per city, name only |
| Top Picks | Supabase `dishes` + `reviews` | Avg rating desc, limit 4, all cities |
| City restaurant count | Supabase `restaurants` | Count per city |

---

## Out of Scope
- Search functionality (full-text search is a planned feature in CLAUDE.md)
- User authentication on homepage
- Dish of the Week (manual curation — deferred)
