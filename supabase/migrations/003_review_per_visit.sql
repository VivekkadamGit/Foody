-- Migration 003: One review per visit, not one per dish
--
-- Previously reviews had UNIQUE (dish_id, tester_id), and the admin review page
-- upserted on that key. Re-tasting a dish therefore OVERWROTE the earlier review,
-- destroying visit history. It also capped review_count at 1 per tester, which made
-- the Certified/Rated quality tiers unreachable — every dish was stuck at "New".
--
-- A review now represents a single visit. visit_date distinguishes them, so
-- review_count is a genuine "tasted N times" count.

ALTER TABLE reviews DROP CONSTRAINT IF EXISTS reviews_dish_id_tester_id_key;

-- Still guard against double-logging the same dish on the same day.
ALTER TABLE reviews ADD CONSTRAINT reviews_dish_tester_visit_key
  UNIQUE (dish_id, tester_id, visit_date);

-- Counting reviews per dish is now the hot path for every score on the site.
CREATE INDEX IF NOT EXISTS idx_reviews_dish_id ON reviews (dish_id) WHERE deleted_at IS NULL;
