import type { Metadata } from 'next'
import { ForgotPassword } from '@/features/auth/forgot-password-form'

export const metadata: Metadata = { title: 'Reset your password' }

export default function Page() {
  return (
    <>
      <h1 className="text-2xl font-semibold">Reset your password</h1>
      <ForgotPassword />
    </>
  )
}
