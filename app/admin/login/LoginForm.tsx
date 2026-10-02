'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { loginErrorMessage } from '@/lib/admin/authMessages'
import { Button, Field, Input } from '@/components/admin/ui'
import PasswordInput from '@/components/admin/PasswordInput'

export default function LoginForm({ notice }: { notice: { tone: 'info' | 'error'; text: string } | null }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const { error } = await createClient().auth.signInWithPassword({ email: email.trim(), password })
      if (error) {
        setError(loginErrorMessage(error))
        setLoading(false)
        return
      }
      router.push('/admin')
      router.refresh()
    } catch (err) {
      setError(loginErrorMessage(err as Error))
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {notice && (
        <p role={notice.tone === 'error' ? 'alert' : 'status'} className={`rounded-lg border px-4 py-3 font-anek text-[14px] ${
          notice.tone === 'error' ? 'border-[#f2c9bb] bg-[#fdf0ea] text-spice-dark' : 'border-[#bfe6d2] bg-[#eaf7f0] text-[#1f7a52]'
        }`}>
          {notice.text}
        </p>
      )}
      <Field label="Email" htmlFor="email">
        <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field label="Password" htmlFor="password">
        <PasswordInput id="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <div className="flex justify-end">
        <Link href="/admin/forgot-password" className="font-anek text-[14px] font-medium text-ember hover:underline">
          Forgot password?
        </Link>
      </div>
      {error && <p role="alert" className="rounded-lg bg-[#fdf0ea] px-4 py-3 font-anek text-[14px] text-spice-dark">{error}</p>}
      <Button type="submit" loading={loading} disabled={!email || !password} className="w-full py-3">
        {loading ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  )
}
