import AdminNav from './AdminNav'
import { createClient } from '@/lib/supabase/server'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Signed out — in practice the login page. Render it standalone: no nav offering
  // "Sign Out" to someone who isn't signed in, and no width clamp fighting its
  // own full-screen layout.
  if (!user) return <>{children}</>

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />
      <main className="max-w-4xl mx-auto px-4 py-8">{children}</main>
    </div>
  )
}
