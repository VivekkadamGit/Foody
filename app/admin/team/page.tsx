import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ensureTester } from '@/lib/admin/currentTester'
import { memberState } from '@/lib/admin/team'
import TeamView, { type TeamMember } from '@/components/admin/TeamView'
import { EmptyState } from '@/components/admin/ui'

export const metadata = { title: 'Team — Chakh admin' }

export default async function AdminTeamPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null // middleware already redirects; keeps types honest

  try {
    const me = await ensureTester({ id: user.id, email: user.email })
    const admin = createAdminClient()
    const [{ data: testers, error: tErr }, { data: usersPage, error: uErr }] = await Promise.all([
      admin.from('testers').select('id, name, role').order('name'),
      admin.auth.admin.listUsers({ page: 1, perPage: 200 }),
    ])
    if (tErr) throw new Error(tErr.message)
    if (uErr) throw new Error(uErr.message)

    const byId = new Map(usersPage.users.map((u) => [u.id, u]))
    const members: TeamMember[] = (testers ?? []).map((t: any) => {
      const u = byId.get(t.id) as any
      return {
        id: t.id,
        name: t.name,
        email: u?.email ?? '—',
        role: t.role === 'admin' ? 'admin' : 'tester',
        lastSignIn: u?.last_sign_in_at ?? null,
        state: memberState({ last_sign_in_at: u?.last_sign_in_at ?? null, banned_until: u?.banned_until ?? null }),
      }
    })

    return (
      <div className="space-y-6">
        <header>
          <h1 className="font-anek text-3xl font-bold text-charcoal">Team</h1>
          <p className="font-anek text-[15px] text-muted">Who can sign in to the Chakh admin.</p>
        </header>
        <TeamView me={{ id: me.id, name: me.name, role: me.role, email: user.email ?? '' }} members={members} />
      </div>
    )
  } catch (err) {
    console.error('[admin] team query failed:', (err as Error).message)
    return <EmptyState icon="⚠️" text="Couldn't load the team — refresh to retry." />
  }
}
