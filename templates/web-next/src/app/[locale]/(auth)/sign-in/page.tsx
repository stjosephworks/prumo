import type { Metadata } from 'next'
import { Suspense } from 'react'
import { CodeSignIn } from '@/features/auth/code-sign-in-form' // prumo:code-sign-in
import { SignInChoice } from '@/features/auth/sign-in-choice'
import { SignIn } from '@/features/auth/sign-in-form' // prumo:password
import { SocialSignIn } from '@/features/auth/social-buttons' // prumo:social
import { messagesOfPage } from '@/i18n/server'

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/sign-in'>): Promise<Metadata> {
  return { title: (await messagesOfPage(params)).auth.signIn.title }
}

// The search params are read in the browser, so the page itself stays static.
export default async function Page({ params }: PageProps<'/[locale]/sign-in'>) {
  const messages = await messagesOfPage(params)

  return (
    <>
      <h1 className="text-2xl font-semibold">{messages.auth.signIn.title}</h1>
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
