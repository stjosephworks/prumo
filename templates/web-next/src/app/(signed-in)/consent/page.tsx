import type { Metadata } from 'next'
import { Suspense } from 'react'
import { Consent } from '@/features/oauth/consent-form'

export const metadata: Metadata = { title: 'Allow access' }

export default function Page() {
  return (
    <>
      <h1 className="text-2xl font-semibold">Allow access</h1>
      <Suspense>
        <Consent />
      </Suspense>
    </>
  )
}
