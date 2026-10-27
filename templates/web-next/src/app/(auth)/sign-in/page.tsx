import type { Metadata } from 'next'
import { Suspense } from 'react'
import { SignIn } from '@/features/auth/sign-in-form'
import { SocialSignIn } from '@/features/auth/social-buttons' // prumo:social

export const metadata: Metadata = { title: 'Sign in' }

// The search params are read in the browser, so the page itself stays static.
export default function Page() {
  return (
    <>
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <Suspense>
        {/* prumo:social */}
        <SocialSignIn />
        {/* prumo:end-social */}
        <SignIn />
      </Suspense>
    </>
  )
}
