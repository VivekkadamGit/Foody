'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/admin/Toast'

export default function PasswordToast() {
  const toast = useToast()
  const router = useRouter()
  useEffect(() => {
    toast('Password updated')
    router.replace('/admin')
  }, [toast, router])
  return null
}
