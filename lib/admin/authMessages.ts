/** Supabase's auth errors are terse; these say what actually went wrong and what to do. */
export function loginErrorMessage(err: { message?: string } | null | undefined): string {
  const m = err?.message ?? ''
  if (!m) return 'Something went wrong. Please try again.'
  if (/invalid login credentials/i.test(m)) {
    return "That email and password don't match a Chakh admin account. Your Directus login is separate and won't work here. Forgot your password?"
  }
  if (/email not confirmed/i.test(m)) {
    return "This account hasn't been confirmed yet. Ask the admin to confirm it in Supabase → Authentication → Users."
  }
  if (/failed to fetch|network/i.test(m)) {
    return "Can't reach the login server. Check your connection and try again."
  }
  return m
}

export function loginNotice(params: { reset?: string; error?: string }): { tone: 'info' | 'error'; text: string } | null {
  if (params.reset === 'sent') return { tone: 'info', text: 'Check your inbox for a reset link.' }
  if (params.error === 'link') {
    return { tone: 'error', text: 'That reset link has expired or was already used. Request a new one.' }
  }
  return null
}

/**
 * Message for a failed reset-email request, or null when it should look like success
 * (no error, or the account simply doesn't exist: never reveal which emails are real).
 */
export function resetRequestError(err: { message?: string; status?: number } | null | undefined): string | null {
  if (!err) return null
  const m = err.message ?? ''
  if (/user not found|not found/i.test(m)) return null
  if (err.status === 429 || /rate limit|security purposes/i.test(m)) {
    return 'Too many reset requests — wait a minute and try again.'
  }
  if (/failed to fetch|network/i.test(m)) {
    return "Can't reach the login server. Check your connection and try again."
  }
  return `Couldn't send the reset email (${m}). If this keeps happening, reset the password in Supabase → Authentication → Users.`
}
