import AdminShell from '@/components/admin/AdminShell'
import { createClient } from '@/lib/supabase/server'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Signed out — login / forgot / reset render standalone, full screen.
  if (!user) return <>{children}</>

  return <AdminShell email={user.email ?? null}>{children}</AdminShell>
}
