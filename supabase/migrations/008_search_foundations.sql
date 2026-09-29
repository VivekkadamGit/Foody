-- Migration 008: search foundations
--
-- 1. Viral entries ("On our list · visiting soon") get a hand-set buzz level and the
--    same taxonomy tags as dishes, so "cake" can find a viral cake place.
-- 2. pg_trgm for typo tolerance ("brwnie" -> "Brownie").
-- 3. search_fuzzy(): PostgREST cannot order by trigram similarity, so the fuzzy path
--    is one SQL function returning ids + similarity; the app loads the rows itself.

-- 1. Trending: buzz + tags ---------------------------------------------------------

ALTER TABLE trending_dishes
  ADD COLUMN IF NOT EXISTS buzz     smallint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS diet     text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS cuisine  text,
  ADD COLUMN IF NOT EXISTS tastes   text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS meals    text[] NOT NULL DEFAULT '{}';

ALTER TABLE trending_dishes DROP CONSTRAINT IF EXISTS trending_buzz_check;
ALTER TABLE trending_dishes ADD CONSTRAINT trending_buzz_check
  CHECK (buzz BETWEEN 1 AND 3);

-- Same vocabularies as dishes (migration 007). Keep the two lists in step.
ALTER TABLE trending_dishes DROP CONSTRAINT IF EXISTS trending_diet_check;
ALTER TABLE trending_dishes ADD CONSTRAINT trending_diet_check
  CHECK (diet IS NULL OR diet IN ('veg', 'non_veg', 'jain', 'egg'));

ALTER TABLE trending_dishes DROP CONSTRAINT IF EXISTS trending_category_check;
ALTER TABLE trending_dishes ADD CONSTRAINT trending_category_check
  CHECK (category IS NULL OR category IN (
    'baked', 'frozen', 'dessert_drink',
    'coffee', 'tea', 'shake', 'juice',
    'thali', 'curry', 'rice', 'bread', 'noodles',
    'roll', 'chaat', 'fried', 'sandwich'
  ));

ALTER TABLE trending_dishes DROP CONSTRAINT IF EXISTS trending_cuisine_check;
ALTER TABLE trending_dishes ADD CONSTRAINT trending_cuisine_check
  CHECK (cuisine IS NULL OR cuisine IN (
    'south_indian', 'north_indian', 'punjabi', 'mughlai', 'gujarati',
    'chinese', 'italian', 'continental', 'street_food'
  ));

ALTER TABLE trending_dishes DROP CONSTRAINT IF EXISTS trending_tastes_check;
ALTER TABLE trending_dishes ADD CONSTRAINT trending_tastes_check
  CHECK (tastes <@ ARRAY['sweet','spicy','tangy','savoury','rich','light','creamy','crispy']::text[]);

ALTER TABLE trending_dishes DROP CONSTRAINT IF EXISTS trending_meals_check;
ALTER TABLE trending_dishes ADD CONSTRAINT trending_meals_check
  CHECK (meals <@ ARRAY['breakfast','brunch','lunch','dinner','anytime']::text[]);

-- 2. Typo tolerance -----------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

CREATE INDEX IF NOT EXISTS idx_dishes_name_trgm
  ON dishes USING gin (name extensions.gin_trgm_ops) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_restaurants_name_trgm
  ON restaurants USING gin (name extensions.gin_trgm_ops) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_trending_dish_name_trgm
  ON trending_dishes USING gin (dish_name extensions.gin_trgm_ops) WHERE deleted_at IS NULL;

-- "best X" orders by score within a category.
CREATE INDEX IF NOT EXISTS idx_dishes_category_score
  ON dishes (category, score DESC NULLS LAST) WHERE deleted_at IS NULL;

-- 3. Fuzzy search -------------------------------------------------------------------

-- word_similarity, not similarity: "nutella" should match "Nutella Brownie" fully.
-- Threshold 0.4 lets one-letter typos through ("brwnie" scores 0.5 against "Nutella
-- Brownie with Ice Cream") without matching noise.
--
-- The threshold is compared explicitly rather than via `SET pg_trgm.word_similarity_threshold`
-- + the `<%` operator: Supabase's postgres role may not set that parameter on a function
-- ("permission denied to set parameter"), which made this migration fail on re-run.
-- The trigram indexes above still serve the ILIKE name filters in lib/search/fetch.ts.
-- SECURITY INVOKER (the default), so RLS still applies to the caller.
CREATE OR REPLACE FUNCTION search_fuzzy(q text, city_slug text)
RETURNS TABLE (hit_kind text, hit_id uuid, sim real)
LANGUAGE sql STABLE
SET search_path = public, extensions
AS $$
  (SELECT 'dish'::text, d.id, word_similarity(q, d.name)
     FROM dishes d
     JOIN restaurants r ON r.id = d.restaurant_id
     JOIN cities c ON c.id = r.city_id
    WHERE c.slug = city_slug
      AND d.deleted_at IS NULL AND r.deleted_at IS NULL
      AND word_similarity(q, d.name) >= 0.4
    ORDER BY 3 DESC
    LIMIT 20)
  UNION ALL
  (SELECT 'restaurant'::text, r.id, word_similarity(q, r.name)
     FROM restaurants r
     JOIN cities c ON c.id = r.city_id
    WHERE c.slug = city_slug
      AND r.deleted_at IS NULL
      AND word_similarity(q, r.name) >= 0.4
    ORDER BY 3 DESC
    LIMIT 5)
  UNION ALL
  (SELECT 'trending'::text, t.id,
          GREATEST(word_similarity(q, t.dish_name), word_similarity(q, t.place_name))
     FROM trending_dishes t
     JOIN cities c ON c.id = t.city_id
    WHERE c.slug = city_slug
      AND t.deleted_at IS NULL AND t.visited_dish_id IS NULL
      AND GREATEST(word_similarity(q, t.dish_name), word_similarity(q, t.place_name)) >= 0.4
    ORDER BY 3 DESC
    LIMIT 6)
$$;

GRANT EXECUTE ON FUNCTION search_fuzzy(text, text) TO anon, authenticated;
