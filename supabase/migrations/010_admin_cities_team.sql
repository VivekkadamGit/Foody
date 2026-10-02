-- Migration 010: admin can manage cities; testers can rename themselves
--
-- Cities only had a public SELECT policy, so the new /admin/cities page could not write.
-- Testers could insert their own profile but never edit it. Role changes and profiles
-- for other people go through the server-side service-role client, not these policies.

DROP POLICY IF EXISTS "Testers can insert cities" ON cities;
CREATE POLICY "Testers can insert cities" ON cities
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Testers can update cities" ON cities;
CREATE POLICY "Testers can update cities" ON cities
  FOR UPDATE TO authenticated USING (true);

-- Deleting a city cascades to its restaurants (restaurants.city_id ON DELETE CASCADE).
-- The server action refuses unless the city has no restaurants at all.
DROP POLICY IF EXISTS "Testers can delete cities" ON cities;
CREATE POLICY "Testers can delete cities" ON cities
  FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "Testers can update their own profile" ON testers;
CREATE POLICY "Testers can update their own profile" ON testers
  FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
