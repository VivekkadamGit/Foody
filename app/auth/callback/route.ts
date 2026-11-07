import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { publicOrigin } from '@/lib/http/publicOrigin'

/**
 * Lands the emailed password-reset link: swaps the one-time ?code= for a session
 * (cookies), then continues to `next`. Only /admin/* destinations are allowed, so the
 * link can't be turned into an open redirect.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const origin = publicOrigin(request.headers)
  const code = url.searchParams.get('code')
  const nextParam = url.searchParams.get('next') ?? '/admin'
  const next = nextParam === '/admin' ||
    (nextParam.startsWith('/admin/') && !/\.\.|\\|\/\//.test(nextParam))
      ? nextParam
      : '/admin'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(new URL(next, origin))
    console.error('[auth] code exchange failed:', error.message)
  }
  return NextResponse.redirect(new URL('/admin/login?error=link', origin))
}
