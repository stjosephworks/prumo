import type { Metadata } from 'next'
import { Suspense } from 'react'
import { VerifyEmail } from '@/features/auth/verify-email-form'

export const metadata: Metadata = { title: 'Confirm your email' }

export default function Page() {
  return (
    <>
      <h1 className="text-2xl font-semibold">Confirm your email</h1>
      <Suspense>
        <VerifyEmail />
      </Suspense>
    </>
  )
}
