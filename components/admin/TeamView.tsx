'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { inviteTeammate, removeAccess, restoreAccess, setRole, updateMyName } from '@/app/actions/team'
import type { MemberState } from '@/lib/admin/team'
import { Button, Field, Input } from './ui'
import { useToast } from './Toast'

export type TeamMember = {
  id: string
  name: string
  email: string
  role: 'tester' | 'admin'
  lastSignIn: string | null
  state: MemberState
}

const STATE: Record<MemberState, { text: string; cls: string }> = {
  active: { text: 'Active', cls: 'border-[#bfe6d2] bg-[#eaf7f0] text-[#1f7a52]' },
  invited: { text: 'Invited', cls: 'border-[#f1d9a8] bg-[#fff6e6] text-[#8a5a12]' },
  removed: { text: 'Removed', cls: 'border-warm-200 bg-warm-100 text-muted' },
}

function formatDate(iso: string | null): string {
  if (!iso) return 'Never signed in'
  return `Last in ${new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
}

export default function TeamView({
  me, members,
}: {
  me: { id: string; name: string; role: 'tester' | 'admin'; email: string }
  members: TeamMember[]
}) {
  const router = useRouter()
  const toast = useToast()
  const isAdmin = me.role === 'admin'
  const [name, setName] = useState(me.name)
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function run(key: string, fn: () => Promise<void>, done: string) {
    setBusy(key); setError('')
    try { await fn(); toast(done); router.refresh() }
    catch (err) { setError((err as Error).message) }
    finally { setBusy(null) }
  }

  return (
    <div className="space-y-6">
      {error && <p role="alert" className="rounded-lg bg-[#fdf0ea] px-4 py-3 font-anek text-[14px] text-spice-dark">{error}</p>}

      <section className="rounded-2xl border border-warm-200 bg-white p-6">
        <h2 className="font-anek text-lg font-bold text-charcoal">You</h2>
        <p className="mb-4 font-anek text-[13.5px] text-muted">{me.email} · {me.role === 'admin' ? 'Admin' : 'Tester'}</p>
        <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); run('name', () => updateMyName(name), 'Name updated') }}>
          <div className="min-w-0 flex-1">
            <Field label="Display name" htmlFor="me-name" hint="Shown on your reviews.">
              <Input id="me-name" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
          </div>
          <Button type="submit" variant="secondary" loading={busy === 'name'} disabled={busy !== null || name.trim() === me.name} className="mb-6">Save</Button>
        </form>
      </section>

      {isAdmin && (
        <section className="rounded-2xl border border-warm-200 bg-white p-6">
          <h2 className="font-anek text-lg font-bold text-charcoal">Invite a teammate</h2>
          <p className="mb-4 font-anek text-[13.5px] text-muted">They get an email, choose their own password, and join as a tester.</p>
          <form className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => { e.preventDefault(); run('invite', async () => { await inviteTeammate(email); setEmail('') }, 'Invite sent') }}>
            <div className="min-w-0 flex-1">
              <Field label="Email" htmlFor="invite-email">
                <Input id="invite-email" type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} />
              </Field>
            </div>
            <Button type="submit" loading={busy === 'invite'} disabled={busy !== null || !email.trim()}>Send invite</Button>
          </form>
        </section>
      )}

      <section>
        <h2 className="mb-3 font-anek text-lg font-bold text-charcoal">Everyone ({members.length})</h2>
        <ul className="overflow-hidden rounded-2xl border border-warm-200 bg-white">
          {members.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-3 border-t border-warm-100 px-4 py-3.5 first:border-t-0">
              <div className="min-w-0 flex-1">
                <p className="truncate font-anek text-[15.5px] font-semibold text-charcoal">
                  {m.name}{m.id === me.id && <span className="ml-1.5 font-medium text-muted">(you)</span>}
                </p>
                <p className="truncate font-anek text-[13px] text-muted">{m.email} · {formatDate(m.lastSignIn)}</p>
              </div>
              <span className={`whitespace-nowrap rounded-full border px-2.5 py-0.5 font-anek text-[11.5px] font-semibold ${STATE[m.state].cls}`}>
                {STATE[m.state].text}
              </span>
              <span className="w-14 font-anek text-[13px] font-medium text-charcoal">{m.role === 'admin' ? 'Admin' : 'Tester'}</span>
              {isAdmin && m.id !== me.id && (
                <div className="flex gap-2">
                  <Button variant="secondary" type="button" className="px-3 py-1.5 text-[13px]" disabled={busy !== null} loading={busy === `role-${m.id}`}
                    onClick={() => run(`role-${m.id}`, () => setRole(m.id, m.role === 'admin' ? 'tester' : 'admin'), 'Role updated')}>
                    {m.role === 'admin' ? 'Make tester' : 'Make admin'}
                  </Button>
                  {m.state === 'removed' ? (
                    <Button variant="secondary" type="button" className="px-3 py-1.5 text-[13px]" disabled={busy !== null} loading={busy === `acc-${m.id}`}
                      onClick={() => run(`acc-${m.id}`, () => restoreAccess(m.id), 'Access restored')}>
                      Restore
                    </Button>
                  ) : (
                    <Button variant="danger" type="button" className="px-3 py-1.5 text-[13px]" disabled={busy !== null} loading={busy === `acc-${m.id}`}
                      onClick={() => {
                        if (!window.confirm(`Remove ${m.name}'s access? Their reviews stay. You can restore access later.`)) return
                        run(`acc-${m.id}`, () => removeAccess(m.id), 'Access removed')
                      }}>
                      Remove
                    </Button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
        {!isAdmin && <p className="mt-3 font-anek text-[13px] text-muted">Only admins can invite people or change access.</p>}
      </section>
    </div>
  )
}
