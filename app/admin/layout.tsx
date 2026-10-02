import AdminShell from '@/components/admin/AdminShell'
import { createClient } from '@/lib/supabase/server'
import { ensureTester } from '@/lib/admin/currentTester'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Signed out — login / forgot / reset render standalone, full screen.
  if (!user) return <>{children}</>

  // Make sure this account has a tester profile — visit logs can't be saved without one.
  try {
    await ensureTester({ id: user.id, email: user.email })
  } catch (err) {
    console.error('[admin] could not ensure tester profile:', (err as Error).message)
  }

  return <AdminShell email={user.email ?? null}>{children}</AdminShell>
}
