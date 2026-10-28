import type { Metadata } from 'next'
import { Suspense } from 'react'
import { CodeSignIn } from '@/features/auth/code-sign-in-form' // prumo:code-sign-in
import { SignInChoice } from '@/features/auth/sign-in-choice'
import { SignIn } from '@/features/auth/sign-in-form' // prumo:password
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
        <SignInChoice
          code={<CodeSignIn />} // prumo:code-sign-in
          password={<SignIn />} // prumo:password
        />
      </Suspense>
    </>
  )
}
