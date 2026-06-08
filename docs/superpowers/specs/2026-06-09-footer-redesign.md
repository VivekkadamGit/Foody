# Footer Redesign

**Date:** 2026-06-09
**Status:** Approved

## Goal

Replace the single-line charcoal footer with a structured 3-column footer matching the Falkor-style reference. Consistent across all public pages.

## Layout

3 columns on desktop, stacked vertically on mobile, all on the charcoal background.

```
┌─────────────────────────────────────────────────────────────────┐
│  [Logo]                  COMPANY          FOLLOW US             │
│  Made with love and      About Us         [YouTube] [Instagram] │
│  for the love of food.   Join Us          [Twitter] [Facebook]  │
│                          Contact                                 │
├─────────────────────────────────────────────────────────────────┤
│  © 2025 Foody — Genuine food reviews across India               │
└─────────────────────────────────────────────────────────────────┘
```

## Component

New shared component: `components/ui/Footer.tsx`

- No props required — fully self-contained
- Replaces the inline `<footer>` in both:
  - `app/page.tsx`
  - `app/(public)/layout.tsx`

## Content

**Left column**
- Logo: `<Image src="/logo.png" />` (same as Navbar)
- Tagline: "Made with love and for the love of food."

**Center column — heading: "COMPANY"**
- About Us → `href="#"` (placeholder, page doesn't exist yet)
- Join Us → `href="/join"` (placeholder)
- Contact → `href="#"` (placeholder)

**Right column — heading: "FOLLOW US"**
- YouTube → `href="#"`
- Instagram → `href="#"`
- Twitter/X → `href="#"`
- Facebook → `href="#"`
- Icons: inline SVG, no external icon library

**Bottom bar**
- `© 2025 Foody — Genuine food reviews across India`

## Styling

| Element | Style |
|---|---|
| Background | `bg-charcoal` (`#1A1614`) |
| Top border | `border-t border-white/10` |
| Column headings | Warm Gold (`#C8A97E`), `text-xs uppercase tracking-widest font-bold` |
| Links | `text-muted`, hover → `text-spice` with underline |
| Social icons | `text-muted`, hover → `text-[#C8A97E]` (warm gold) |
| Tagline | `text-muted text-sm` |
| Bottom bar border | `border-t border-white/10` |
| Copyright | `text-muted text-xs uppercase tracking-widest` |

Mobile: columns stack, left-aligned; bottom bar centered.

## Out of scope

- About, Contact, Join Us page content (links are placeholders)
- Newsletter subscription input
- Actual social media URLs (all `href="#"` until accounts are confirmed)
