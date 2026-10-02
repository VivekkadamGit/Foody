'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canDemote, defaultTesterName, isValidEmail } from '@/lib/admin/team'

async function caller() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not signed in')
  return user
}

async function requireAdmin() {
  const user = await caller()
  const { data, error } = await createAdminClient().from('testers').select('role').eq('id', user.id).maybeSingle()
  if (error) throw new Error(error.message)
  if (data?.role !== 'admin') throw new Error('Only admins can manage the team')
  // A removed admin's token stays valid for up to an hour; the ban is the source of truth.
  const { data: authData, error: authError } = await createAdminClient().auth.admin.getUserById(user.id)
  if (authError) throw new Error(authError.message)
  const bannedUntil = authData.user?.banned_until
  if (bannedUntil && new Date(bannedUntil).getTime() > Date.now()) throw new Error('Only admins can manage the team')
  return user
}

const REFUSED = "Couldn't save — the change was refused. Has migration 010 been applied?"

function origin(): string {
  const h = headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  return `${proto}://${host}`
}

export async function updateMyName(name: string) {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Name is required')
  if (trimmed.length > 60) throw new Error('Keep the name under 60 characters')
  const user = await caller()
  const supabase = await createClient()
  const { data, error } = await supabase.from('testers').update({ name: trimmed }).eq('id', user.id).select('id')
  if (error) throw new Error(error.message)
  if (!data || data.length === 0) throw new Error(REFUSED)
  revalidatePath('/admin/team')
}

export async function inviteTeammate(email: string) {
  await requireAdmin()
  const clean = email.trim().toLowerCase()
  if (!isValidEmail(clean)) throw new Error('Enter a valid email address')

  const admin = createAdminClient()
  const { data, error } = await admin.auth.admin.inviteUserByEmail(clean, {
    redirectTo: `${origin()}/admin/reset-password`,
  })
  if (error) {
    if (/already (been )?registered|already exists/i.test(error.message)) throw new Error('That email already has an account')
    if (/not authorized|email address.*not allowed|rate limit/i.test(error.message)) {
      throw new Error("Supabase couldn't send the invite email. Its built-in email only reaches your Supabase team and a few emails an hour — set up custom SMTP in Supabase → Authentication → Emails.")
    }
    throw new Error(error.message)
  }
  const { error: profileError } = await admin
    .from('testers')
    .upsert({ id: data.user.id, name: defaultTesterName(clean), role: 'tester' }, { onConflict: 'id', ignoreDuplicates: true })
  if (profileError) throw new Error(profileError.message)
  revalidatePath('/admin/team')
}

export async function setRole(userId: string, role: 'tester' | 'admin') {
  await requireAdmin()
  if (role !== 'tester' && role !== 'admin') throw new Error('Unknown role')
  const admin = createAdminClient()
  const { data: target, error: targetError } = await admin.from('testers').select('role').eq('id', userId).maybeSingle()
  if (targetError) throw new Error(targetError.message)
  if (!target) throw new Error('No such teammate')
  if (target.role === role) return
  if (target.role === 'admin' && role === 'tester') {
    const { count, error } = await admin.from('testers').select('id', { count: 'exact', head: true }).eq('role', 'admin')
    if (error) throw new Error(error.message)
    if (!canDemote(count ?? 0)) throw new Error('The team needs at least one admin')
  }
  const { error } = await admin.from('testers').update({ role }).eq('id', userId)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/team')
}

/**
 * Ban, never delete: deleting an auth user cascades away their reviews.
 * Bans block new sign-ins and token refreshes only, so a removed user's existing session
 * can keep working until its access token expires (about an hour).
 */
export async function removeAccess(userId: string) {
  const me = await requireAdmin()
  if (me.id === userId) throw new Error("You can't remove your own access")
  const admin = createAdminClient()
  const { data: target, error: targetError } = await admin.from('testers').select('role').eq('id', userId).maybeSingle()
  if (targetError) throw new Error(targetError.message)
  if (target?.role === 'admin') {
    const { count, error: countError } = await admin.from('testers').select('id', { count: 'exact', head: true }).eq('role', 'admin')
    if (countError) throw new Error(countError.message)
    if (!canDemote(count ?? 0)) throw new Error('The team needs at least one admin')
  }
  const { error } = await admin.auth.admin.updateUserById(userId, { ban_duration: '876000h' })
  if (error) throw new Error(error.message)
  // A removed person must stop counting as an admin (and can't pass requireAdmin if restored by someone else's mistake).
  const { error: roleError } = await admin.from('testers').update({ role: 'tester' }).eq('id', userId)
  if (roleError) throw new Error(roleError.message)
  revalidatePath('/admin/team')
}

export async function restoreAccess(userId: string) {
  await requireAdmin()
  const { error } = await createAdminClient().auth.admin.updateUserById(userId, { ban_duration: 'none' })
  if (error) throw new Error(error.message)
  revalidatePath('/admin/team')
}
