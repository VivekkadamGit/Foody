-- Migration 005: the score lives on the dish
--
-- Previously the displayed score was avg(reviews.rating) * 2, so a revisit averaged
-- against the earlier verdict instead of replacing it, and quality tiers were derived
-- from how many times a dish had been reviewed. That is backwards for a single critic:
-- one visit, one judgement, edited if it changes.
--
-- Score is now an authoritative 0-10 value set by hand on the dish. Reviews remain as
-- a visit log (date + taste notes) proving the place was visited, but no longer drive
-- the number, and visit count no longer affects any badge.

ALTER TABLE dishes ADD COLUMN IF NOT EXISTS score numeric(3,1)
  CHECK (score IS NULL OR (score >= 0 AND score <= 10));

-- Carry over anything already scored through the old review-average path, so no
-- existing judgement is lost. (No-op on a database with no reviews.)
UPDATE dishes d
SET score = ROUND(sub.avg_rating * 2, 1)
FROM (
  SELECT dish_id, AVG(rating)::numeric AS avg_rating
  FROM reviews
  WHERE deleted_at IS NULL
  GROUP BY dish_id
) sub
WHERE sub.dish_id = d.id
  AND d.score IS NULL;

-- Ranking by score is now the hot path on the homepage, search and dish listings.
CREATE INDEX IF NOT EXISTS idx_dishes_score
  ON dishes (score DESC NULLS LAST)
  WHERE deleted_at IS NULL;
