import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { defaultTesterName } from './team'

export type TesterProfile = { id: string; name: string; role: 'tester' | 'admin' }

/**
 * Every review needs a testers row (reviews.tester_id is NOT NULL), but nothing used to
 * create one. Called on every signed-in admin request: returns the profile, creating it
 * on first sign-in. The first profile ever created while no admin exists becomes admin.
 */
export async function ensureTester(user: { id: string; email?: string | null }): Promise<TesterProfile> {
  const admin = createAdminClient()
  const { data: existing, error } = await admin.from('testers').select('id, name, role').eq('id', user.id).maybeSingle()
  if (error) throw new Error(error.message)
  if (existing) return existing as TesterProfile

  const { count, error: countError } = await admin
    .from('testers')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'admin')
  if (countError) throw new Error(countError.message)

  const profile: TesterProfile = {
    id: user.id,
    name: defaultTesterName(user.email ?? ''),
    role: (count ?? 0) === 0 ? 'admin' : 'tester',
  }
  // upsert, not insert: two concurrent first requests must not fail on the primary key.
  const { error: insertError } = await admin.from('testers').upsert(profile, { onConflict: 'id', ignoreDuplicates: true })
  if (insertError) throw new Error(insertError.message)
  return profile
}
