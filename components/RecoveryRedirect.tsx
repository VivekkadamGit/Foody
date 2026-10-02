'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const RESET_PATH = '/admin/reset-password'

/**
 * A password-recovery email does not always land on /auth/callback. When Supabase
 * falls back to the Site URL (e.g. "Send password recovery" from the dashboard, or a
 * redirect URL that isn't allow-listed), the browser client signs the user in from the
 * link and fires PASSWORD_RECOVERY on whatever page they landed on. Without this the
 * user ends up signed in but never sees the "choose a new password" form.
 */
export default function RecoveryRedirect() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' && window.location.pathname !== RESET_PATH) {
        router.replace(RESET_PATH)
      }
    })
    return () => subscription.unsubscribe()
  }, [router])

  return null
}
