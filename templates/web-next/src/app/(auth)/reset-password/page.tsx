import type { Metadata } from 'next'
import { Suspense } from 'react'
import { ResetPassword } from '@/features/auth/reset-password-form'

export const metadata: Metadata = { title: 'Choose a new password' }

export default function Page() {
  return (
    <>
      <h1 className="text-2xl font-semibold">Choose a new password</h1>
      <Suspense>
        <ResetPassword />
      </Suspense>
    </>
  )
}
