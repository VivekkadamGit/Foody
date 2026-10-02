'use client'

import { useEffect } from 'react'
import { useToast } from '@/components/admin/Toast'

export default function PasswordToast() {
  const toast = useToast()
  useEffect(() => { toast('Password updated') }, [toast])
  return null
}
