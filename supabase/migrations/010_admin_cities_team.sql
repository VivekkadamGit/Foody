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

-- restaurants.city_id becomes ON DELETE RESTRICT (below), so the database itself refuses to
-- delete a city that still has restaurants. The server action's count check only gives a
-- friendlier error message.
DROP POLICY IF EXISTS "Testers can delete cities" ON cities;
CREATE POLICY "Testers can delete cities" ON cities
  FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "Testers can update their own profile" ON testers;
CREATE POLICY "Testers can update their own profile" ON testers
  FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- Roles change only through the server's service-role client (or a DB owner such as Directus).
CREATE OR REPLACE FUNCTION testers_guard_role() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') AND (
       (TG_OP = 'UPDATE' AND NEW.role IS DISTINCT FROM OLD.role)
    OR (TG_OP = 'INSERT' AND NEW.role IS DISTINCT FROM 'tester')
  ) THEN
    RAISE EXCEPTION 'Only admins can change roles';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS testers_guard_role ON testers;
CREATE TRIGGER testers_guard_role BEFORE INSERT OR UPDATE ON testers
  FOR EACH ROW EXECUTE FUNCTION testers_guard_role();

DROP POLICY IF EXISTS "Testers can insert their profile" ON testers;
CREATE POLICY "Testers can insert their profile" ON testers FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid() AND role = 'tester');

DO $$
DECLARE c text;
BEGIN
  SELECT conname INTO c FROM pg_constraint
   WHERE conrelid = 'restaurants'::regclass AND contype = 'f'
     AND conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = 'restaurants'::regclass AND attname = 'city_id')];
  IF c IS NOT NULL THEN
    EXECUTE format('ALTER TABLE restaurants DROP CONSTRAINT %I', c);
  END IF;
  ALTER TABLE restaurants ADD CONSTRAINT restaurants_city_id_fkey
    FOREIGN KEY (city_id) REFERENCES cities(id) ON DELETE RESTRICT;
END $$;
