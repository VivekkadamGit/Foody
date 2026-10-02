'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ToastProvider } from './Toast'

const NAV = [
  { href: '/admin', label: 'Dashboard', icon: '◧' },
  { href: '/admin/dishes', label: 'Dishes', icon: '🍽' },
  { href: '/admin/trending', label: 'On our list', icon: '🔥' },
  { href: '/admin/restaurants', label: 'Restaurants', icon: '🏪' },
  { href: '/admin/cities', label: 'Cities', icon: '🏙' },
  { href: '/admin/team', label: 'Team', icon: '👥' },
]

function isActive(path: string, href: string) {
  return href === '/admin' ? path === '/admin' : path.startsWith(href)
}

export default function AdminShell({ email, children }: { email: string | null; children: ReactNode }) {
  const path = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)

  if (path === '/admin/reset-password') return <ToastProvider>{children}</ToastProvider>

  async function signOut() {
    await createClient().auth.signOut()
    router.push('/admin/login')
    router.refresh()
  }

  const sidebar = (
    <nav className="flex h-full flex-col bg-ink px-4 py-6 text-[#cdc2b8]">
      <Link href="/admin" className="mb-8 flex items-baseline px-2" onClick={() => setOpen(false)}>
        <span className="font-anek text-[26px] font-extrabold tracking-tight text-ember-light">chakh</span>
        <span className="ml-1 h-1.5 w-1.5 rounded-full bg-ember" />
        <span className="ml-2 font-anek text-[11px] font-bold uppercase tracking-[0.18em] text-sand">admin</span>
      </Link>
      <ul className="space-y-1">
        {NAV.map((n) => {
          const on = isActive(path, n.href)
          return (
            <li key={n.href}>
              <Link
                href={n.href}
                onClick={() => setOpen(false)}
                aria-current={on ? 'page' : undefined}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 font-anek text-[15px] font-medium transition-colors ${
                  on ? 'bg-ink-card text-ember-light' : 'hover:bg-ink-light hover:text-[#fdf9f4]'
                }`}
              >
                <span className="w-5 text-center" aria-hidden>{n.icon}</span>
                {n.label}
              </Link>
            </li>
          )
        })}
      </ul>
      <div className="mt-auto space-y-1 border-t border-white/[0.08] pt-4">
        <Link href="/" target="_blank" className="block rounded-lg px-3 py-2 font-anek text-[14px] hover:text-[#fdf9f4]">View site ↗</Link>
        {email && <p className="truncate px-3 font-anek text-[12px] text-sand-darker" title={email}>{email}</p>}
        <Link href="/admin/reset-password" onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2 font-anek text-[14px] hover:text-[#fdf9f4]">
          Change password
        </Link>
        <button type="button" onClick={signOut} className="w-full rounded-lg px-3 py-2 text-left font-anek text-[14px] hover:text-ember-light">
          Sign out
        </button>
      </div>
    </nav>
  )

  return (
    <ToastProvider>
      <div className="min-h-screen bg-cream md:flex">
        <aside className="sticky top-0 hidden h-screen w-[232px] shrink-0 md:block">{sidebar}</aside>

        <div className="flex items-center justify-between bg-ink px-4 py-3 md:hidden">
          <span className="font-anek text-xl font-extrabold text-ember-light">chakh <span className="text-[11px] uppercase tracking-[0.18em] text-sand">admin</span></span>
          <button type="button" onClick={() => setOpen(true)} aria-label="Open menu" className="rounded-lg px-2 py-1 text-[22px] text-[#fdf9f4]">☰</button>
        </div>
        {open && (
          <div className="fixed inset-0 z-50 md:hidden">
            <div className="absolute inset-0 bg-ink/50" onClick={() => setOpen(false)} />
            <div className="absolute inset-y-0 left-0 w-[260px]">{sidebar}</div>
          </div>
        )}

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 sm:py-8">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </ToastProvider>
  )
}
