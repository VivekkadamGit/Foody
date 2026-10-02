'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { authLinkType } from '@/lib/admin/authMessages'

const RESET_PATH = '/admin/reset-password'

/**
 * Auth emails don't always land on /auth/callback. Recovery links that fall back to the
 * Site URL, and admin invite links (which can't use PKCE), arrive as a #access_token…&type=
 * hash on whatever page they land on — often /admin/login after the middleware bounce,
 * since browsers keep the hash across redirects. The browser client signs the user in
 * from that hash; this sends them on to choose a password instead of leaving them
 * silently signed in.
 */
export default function RecoveryRedirect() {
  const router = useRouter()

  useEffect(() => {
    // Read before createClient(): the client strips the hash once it has consumed it.
    const linkType = authLinkType(window.location.hash)
    const supabase = createClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (window.location.pathname === RESET_PATH) return
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && linkType === 'recovery')) {
        router.replace(RESET_PATH)
      } else if (event === 'SIGNED_IN' && linkType === 'invite') {
        router.replace(`${RESET_PATH}?welcome=1`)
      }
    })
    return () => subscription.unsubscribe()
  }, [router])

  return null
}
