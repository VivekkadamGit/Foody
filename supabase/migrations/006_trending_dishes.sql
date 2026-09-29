-- Migration 006: Trending Right Now
--
-- Food the city is talking about that we have NOT visited yet.
--
-- Deliberately its own table rather than a flag on `dishes`. A trending place is
-- usually not in our database at all, so flagging a dish would mean inventing a
-- restaurant row and a dish row for somewhere nobody has been — and those rows would
-- then be reachable from search, city listings and the AI suggest context. This table
-- has no score column, so an untasted entry cannot acquire a number by any code path.

CREATE TABLE IF NOT EXISTS trending_dishes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dish_name       text NOT NULL,
  place_name      text NOT NULL,
  city_id         uuid NOT NULL REFERENCES cities(id),
  -- Optional: set only when we already have the restaurant, so the card can link
  -- somewhere real instead of dead-ending.
  restaurant_id   uuid REFERENCES restaurants(id),
  area            text,
  -- Required. An entry with no stated reason is a rumour, not a signal.
  why             text NOT NULL,
  -- The receipt: where we saw it. Rendered as "Seen on —".
  source_url      text,
  photo_url       text,
  -- Set once we actually go and review it. The entry then leaves the column.
  visited_dish_id uuid REFERENCES dishes(id),
  rank            int NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz DEFAULT NULL
);

-- Matches the only query the public page makes: live, unvisited, by city, in rank order.
CREATE INDEX IF NOT EXISTS idx_trending_live
  ON trending_dishes (city_id, rank, created_at DESC)
  WHERE deleted_at IS NULL AND visited_dish_id IS NULL;

ALTER TABLE trending_dishes ENABLE ROW LEVEL SECURITY;

-- Anyone can read a live entry. Soft-deleted rows stay hidden at the policy level, so a
-- public page that forgets .is('deleted_at', null) still cannot leak them.
DROP POLICY IF EXISTS "Public can read live trending dishes" ON trending_dishes;
CREATE POLICY "Public can read live trending dishes" ON trending_dishes
  FOR SELECT TO anon, authenticated
  USING (deleted_at IS NULL);

-- Only signed-in testers curate the list.
DROP POLICY IF EXISTS "Testers can insert trending dishes" ON trending_dishes;
CREATE POLICY "Testers can insert trending dishes" ON trending_dishes
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Testers can update trending dishes" ON trending_dishes;
CREATE POLICY "Testers can update trending dishes" ON trending_dishes
  FOR UPDATE TO authenticated USING (true);
