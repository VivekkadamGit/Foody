import AuthLayout from '@/components/admin/AuthLayout'
import { loginNotice } from '@/lib/admin/authMessages'
import LoginForm from './LoginForm'

export const metadata = { title: 'Sign in — Chakh admin' }

export default function AdminLoginPage({ searchParams }: { searchParams: { reset?: string; error?: string } }) {
  return (
    <AuthLayout title="Welcome back" subtitle="Sign in with your Chakh admin account.">
      <LoginForm notice={loginNotice(searchParams)} />
    </AuthLayout>
  )
}
