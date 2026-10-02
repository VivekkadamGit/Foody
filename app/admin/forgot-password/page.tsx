'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import AuthLayout from '@/components/admin/AuthLayout'
import { Button, Field, Input } from '@/components/admin/ui'
import { resetRequestError } from '@/lib/admin/authMessages'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await createClient().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/admin/reset-password`,
    })
    setLoading(false)
    // Unknown accounts look like success (never reveal who exists); real failures surface.
    const message = resetRequestError(error)
    if (error) console.error('[auth] reset request failed:', error)
    if (message) {
      setError(message)
      return
    }
    setSent(true)
  }

  return (
    <AuthLayout title="Reset your password" subtitle="We'll email you a link to choose a new one.">
      {sent ? (
        <div className="space-y-5">
          <p role="status" className="rounded-lg border border-[#bfe6d2] bg-[#eaf7f0] px-4 py-3 font-anek text-[14.5px] text-[#1f7a52]">
            If an account exists for {email.trim()}, a reset link is on its way. Check your inbox (and spam).
          </p>
          <Link href="/admin/login" className="font-anek text-[14px] font-medium text-ember hover:underline">← Back to sign in</Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <Field label="Email" htmlFor="email">
            <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          {error && <p role="alert" className="rounded-lg bg-[#fdf0ea] px-4 py-3 font-anek text-[14px] text-spice-dark">{error}</p>}
          <Button type="submit" loading={loading} disabled={!email} className="w-full py-3">Send reset link</Button>
          <Link href="/admin/login" className="block text-center font-anek text-[14px] font-medium text-muted hover:text-charcoal">
            ← Back to sign in
          </Link>
        </form>
      )}
    </AuthLayout>
  )
}
