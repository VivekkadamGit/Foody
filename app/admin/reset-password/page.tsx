'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AuthLayout from '@/components/admin/AuthLayout'
import { Button, Field } from '@/components/admin/ui'
import PasswordInput from '@/components/admin/PasswordInput'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [expired, setExpired] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setExpired(false)
    if (password.length < 8) return setError('Use at least 8 characters.')
    if (password !== confirm) return setError("The two passwords don't match.")
    setLoading(true)
    const { error } = await createClient().auth.updateUser({ password })
    if (error) {
      if (/session missing|not authenticated|jwt/i.test(error.message)) {
        setExpired(true)
        setError('This reset link has expired. Request a new one.')
      } else {
        setError(error.message)
      }
      setLoading(false)
      return
    }
    router.push('/admin?password=updated')
    router.refresh()
  }

  return (
    <AuthLayout title="Choose a new password" subtitle="You'll use it to sign in to the Chakh admin.">
      <form onSubmit={handleSubmit} className="space-y-5">
        <Field label="New password" htmlFor="pw" hint="At least 8 characters.">
          <PasswordInput id="pw" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Field label="Confirm password" htmlFor="pw2">
          <PasswordInput id="pw2" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </Field>
        {error && <p role="alert" className="rounded-lg bg-[#fdf0ea] px-4 py-3 font-anek text-[14px] text-spice-dark">{error}</p>}
        {expired && (
          <Link href="/admin/forgot-password" className="block font-anek text-[14px] font-medium text-ember hover:underline">
            Request a new reset link
          </Link>
        )}
        <Button type="submit" loading={loading} className="w-full py-3">Save password</Button>
        {/* Rendered outside the admin shell, so give a way back without changing anything. */}
        <Link href="/admin" className="block text-center font-anek text-[14px] font-medium text-muted hover:text-charcoal">
          ← Back to admin
        </Link>
      </form>
    </AuthLayout>
  )
}
