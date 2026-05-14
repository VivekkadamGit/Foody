-- Migration 001: Soft delete for restaurants, dishes, reviews
-- deleted_at IS NULL  → active
-- deleted_at IS NOT NULL → soft-deleted

ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE dishes      ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE reviews     ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

-- Indexes so filtering by deleted_at stays fast as data grows
CREATE INDEX IF NOT EXISTS idx_restaurants_deleted_at ON restaurants (deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_dishes_deleted_at      ON dishes      (deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_reviews_deleted_at     ON reviews     (deleted_at) WHERE deleted_at IS NULL;
