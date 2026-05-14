-- Foody Database Schema
-- Run this in your Supabase SQL Editor

-- Cities
CREATE TABLE cities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL
);

INSERT INTO cities (name, slug) VALUES
  ('Surat', 'surat'),
  ('Vadodara', 'vadodara');

-- Restaurants
CREATE TABLE restaurants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id uuid REFERENCES cities(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  address text,
  google_place_id text,
  latitude numeric,
  longitude numeric,
  cuisine_type text[] DEFAULT '{}',
  price_range int CHECK (price_range BETWEEN 1 AND 3) DEFAULT 1,
  cover_image_url text,
  created_at timestamptz DEFAULT now()
);

-- Dishes
CREATE TABLE dishes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid REFERENCES restaurants(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text,
  photo_url text,
  is_must_try boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Testers (extends auth.users)
CREATE TABLE testers (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  role text DEFAULT 'tester' CHECK (role IN ('tester', 'admin'))
);

-- Reviews
CREATE TABLE reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dish_id uuid REFERENCES dishes(id) ON DELETE CASCADE NOT NULL,
  tester_id uuid REFERENCES testers(id) ON DELETE CASCADE NOT NULL,
  rating int CHECK (rating BETWEEN 1 AND 5) NOT NULL,
  taste_notes text,
  visit_date date NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(dish_id, tester_id)
);

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE dishes ENABLE ROW LEVEL SECURITY;
ALTER TABLE testers ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Public can read cities" ON cities FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public can read restaurants" ON restaurants FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public can read dishes" ON dishes FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public can read reviews" ON reviews FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public can read testers" ON testers FOR SELECT TO anon, authenticated USING (true);

-- Only authenticated testers can write
CREATE POLICY "Testers can insert restaurants" ON restaurants FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Testers can update restaurants" ON restaurants FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Testers can insert dishes" ON dishes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Testers can update dishes" ON dishes FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Testers can insert their own reviews" ON reviews
  FOR INSERT TO authenticated
  WITH CHECK (tester_id = auth.uid());

CREATE POLICY "Testers can update their own reviews" ON reviews
  FOR UPDATE TO authenticated
  USING (tester_id = auth.uid());

CREATE POLICY "Testers can insert their profile" ON testers
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- ============================================================
-- Supabase Storage: dish-photos bucket
-- ============================================================
-- Run in Storage section: create a public bucket named "dish-photos"
-- Then add this policy:
-- INSERT: authenticated users can upload
-- SELECT: public can read
