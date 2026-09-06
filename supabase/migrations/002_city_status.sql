-- Migration 002: City status (active vs. coming soon)
-- 'active'      → city is live: browsable, selectable by geolocation, shown in rankings
-- 'coming_soon' → city is locked: shown on the homepage as a locked tile, not selectable

ALTER TABLE cities ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'
  CHECK (status IN ('active', 'coming_soon'));

-- Surat, Ahmedabad, Vadodara are live; Indore is locked/coming soon.
-- Upsert by slug so this is safe to re-run and works whether or not the city already exists.
INSERT INTO cities (name, slug, status) VALUES
  ('Surat', 'surat', 'active'),
  ('Ahmedabad', 'ahmedabad', 'active'),
  ('Vadodara', 'vadodara', 'active'),
  ('Indore', 'indore', 'coming_soon')
ON CONFLICT (slug) DO UPDATE SET status = EXCLUDED.status;
