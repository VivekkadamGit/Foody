-- Migration 009: admins can see soft-deleted "On our list" entries
--
-- 006 only lets anyone read live rows (deleted_at IS NULL). That is right for the
-- public site but means a signed-in admin can't see the Deleted tab, and soft-deleting
-- fails because the updated row is no longer visible to the updater. Policies are OR'd,
-- so this adds visibility for signed-in testers without touching the public rule;
-- public queries still filter deleted_at themselves.
DROP POLICY IF EXISTS "Testers can read all trending dishes" ON trending_dishes;
CREATE POLICY "Testers can read all trending dishes" ON trending_dishes
  FOR SELECT TO authenticated
  USING (true);
