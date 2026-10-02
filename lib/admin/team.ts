/** "vivek.adam@gmail.com" → "Vivek Adam". Editable later; this only seeds the profile. */
export function defaultTesterName(email: string): string {
  const local = email.split('@')[0] ?? ''
  const words = local.split(/[._-]+/).filter(Boolean)
  if (words.length === 0) return 'Tester'
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

export type MemberState = 'active' | 'invited' | 'removed'

export function memberState(
  u: { last_sign_in_at: string | null; banned_until?: string | null },
  now: Date = new Date()
): MemberState {
  if (u.banned_until && new Date(u.banned_until) > now) return 'removed'
  if (!u.last_sign_in_at) return 'invited'
  return 'active'
}

/** A team must always keep at least one admin. */
export function canDemote(adminCount: number): boolean {
  return adminCount > 1
}
