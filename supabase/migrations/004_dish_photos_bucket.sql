-- Migration 004: dish-photos storage bucket
--
-- AddDishForm uploads to supabase.storage.from('dish-photos'), but the bucket was
-- never created — schema.sql only left a comment asking for it to be made by hand,
-- so every dish photo upload failed with "Bucket not found".
--
-- Public bucket: dish photos are shown on public pages and read with plain <img>,
-- so no signed URLs are needed. Writes stay restricted to authenticated testers.

INSERT INTO storage.buckets (id, name, public)
VALUES ('dish-photos', 'dish-photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Anyone can read a dish photo.
DROP POLICY IF EXISTS "Public can read dish photos" ON storage.objects;
CREATE POLICY "Public can read dish photos" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'dish-photos');

-- Only signed-in testers can add or replace them.
DROP POLICY IF EXISTS "Testers can upload dish photos" ON storage.objects;
CREATE POLICY "Testers can upload dish photos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'dish-photos');

DROP POLICY IF EXISTS "Testers can update dish photos" ON storage.objects;
CREATE POLICY "Testers can update dish photos" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'dish-photos');
