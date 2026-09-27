-- Migration 007: dish taxonomy
--
-- Search could not reason about food because the only tag-like column was
-- restaurants.cuisine_type, which conflated three different dimensions:
--   'south indian' (a cuisine), 'desserts' (a category), 'street food' (a style).
-- Nothing described the dish itself, so "best cake" could not find a brownie and
-- "veg" could not be filtered at all.
--
-- Tags live directly on `dishes` rather than on a canonical-dish table: every dish
-- currently belongs to exactly one restaurant, so there is no duplication to
-- deduplicate yet. Canonical grouping can come later, when the same dish genuinely
-- appears in several places.
--
-- `category` stores the LEAF only ('baked', 'curry'). The parent grouping
-- (dessert / beverage / main / snack) and search aliases ("cake" -> baked) live in
-- lib/taxonomy.ts, so broadening a synonym never needs a migration.

ALTER TABLE dishes
  ADD COLUMN IF NOT EXISTS diet     text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS cuisine  text,
  ADD COLUMN IF NOT EXISTS tastes   text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS meals    text[] NOT NULL DEFAULT '{}';

-- Diet is a factual property; keep it closed.
ALTER TABLE dishes DROP CONSTRAINT IF EXISTS dishes_diet_check;
ALTER TABLE dishes ADD CONSTRAINT dishes_diet_check
  CHECK (diet IS NULL OR diet IN ('veg', 'non_veg', 'jain', 'egg'));

-- Category leaves. Parents are derived in code.
ALTER TABLE dishes DROP CONSTRAINT IF EXISTS dishes_category_check;
ALTER TABLE dishes ADD CONSTRAINT dishes_category_check
  CHECK (category IS NULL OR category IN (
    -- dessert
    'baked', 'frozen', 'dessert_drink',
    -- beverage
    'coffee', 'tea', 'shake', 'juice',
    -- main
    'thali', 'curry', 'rice', 'bread', 'noodles',
    -- snack
    'roll', 'chaat', 'fried', 'sandwich'
  ));

-- Cuisine stays OPTIONAL and open-ended by design: a Biscoff brownie belongs to no
-- cuisine, and forcing one produces garbage data.
ALTER TABLE dishes DROP CONSTRAINT IF EXISTS dishes_cuisine_check;
ALTER TABLE dishes ADD CONSTRAINT dishes_cuisine_check
  CHECK (cuisine IS NULL OR cuisine IN (
    'south_indian', 'north_indian', 'punjabi', 'mughlai', 'gujarati',
    'chinese', 'italian', 'continental', 'street_food'
  ));

ALTER TABLE dishes DROP CONSTRAINT IF EXISTS dishes_tastes_check;
ALTER TABLE dishes ADD CONSTRAINT dishes_tastes_check
  CHECK (tastes <@ ARRAY['sweet','spicy','tangy','savoury','rich','light','creamy','crispy']::text[]);

ALTER TABLE dishes DROP CONSTRAINT IF EXISTS dishes_meals_check;
ALTER TABLE dishes ADD CONSTRAINT dishes_meals_check
  CHECK (meals <@ ARRAY['breakfast','brunch','lunch','dinner','anytime']::text[]);

-- Filtering by these is the hot path for search and the filter chips.
CREATE INDEX IF NOT EXISTS idx_dishes_category ON dishes (category) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_dishes_diet     ON dishes (diet)     WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_dishes_tastes   ON dishes USING gin (tastes);
CREATE INDEX IF NOT EXISTS idx_dishes_meals    ON dishes USING gin (meals);
