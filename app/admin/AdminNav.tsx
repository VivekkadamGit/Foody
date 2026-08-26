'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AdminNav() {
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/admin/login')
  }

  return (
    <nav className="bg-gray-900 text-white px-6 h-14 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <Link href="/admin" className="font-bold text-orange-400">🍽️ Chakh Admin</Link>
        <Link href="/admin/restaurants/new" className="text-sm text-gray-300 hover:text-white transition-colors">
          + Add Restaurant
        </Link>
      </div>
      <div className="flex items-center gap-4">
        <Link href="/" className="text-sm text-gray-400 hover:text-white transition-colors">
          ← Public Site
        </Link>
        <button
          onClick={handleLogout}
          className="text-sm text-gray-400 hover:text-red-400 transition-colors"
        >
          Sign Out
        </button>
      </div>
    </nav>
  )
}
