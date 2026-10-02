'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { authLinkType, authLinkTokens } from '@/lib/admin/authMessages'

const RESET_PATH = '/admin/reset-password'

/**
 * Auth emails don't always land on /auth/callback. Recovery links that fall back to the
 * Site URL, and admin invite links (which can't use PKCE), arrive as a #access_token…&type=
 * hash on whatever page they land on — often /admin/login after the middleware bounce,
 * since browsers keep the hash across redirects. The SSR browser client is PKCE-only and
 * rejects implicit hashes ("Not a valid PKCE flow url"), so the tokens are applied by hand
 * with setSession(), which emits SIGNED_IN; this then sends the user on to choose a
 * password instead of leaving them silently signed in.
 */
export default function RecoveryRedirect() {
  const router = useRouter()

  useEffect(() => {
    // Read before createClient(): the client strips the hash once it has consumed it.
    let linkType: ReturnType<typeof authLinkType> = authLinkType(window.location.hash)
    const tokens = authLinkTokens(window.location.hash)
    const supabase = createClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (window.location.pathname === RESET_PATH) return
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && linkType === 'recovery')) {
        linkType = null
        router.replace(RESET_PATH)
      } else if (event === 'SIGNED_IN' && linkType === 'invite') {
        linkType = null
        router.replace(`${RESET_PATH}?welcome=1`)
      }
    })

    if ((linkType === 'invite' || linkType === 'recovery') && tokens) {
      supabase.auth.setSession(tokens).then(({ error }) => {
        if (error) {
          console.error('[auth] could not start session from link:', error.message)
          router.replace('/admin/login?error=link')
        }
        window.history.replaceState(null, '', window.location.pathname + window.location.search)
      })
    }
    return () => subscription.unsubscribe()
  }, [router])

  return null
}
