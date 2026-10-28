import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { CodeSignInForm } from '@/features/auth/code-sign-in-form' // prumo:code-sign-in
import { SignInChoice } from '@/features/auth/sign-in-choice'
import { SignInForm } from '@/features/auth/sign-in-form' // prumo:password
import { SocialButtons } from '@/features/auth/social-buttons' // prumo:social

export const Route = createFileRoute('/sign-in')({
  validateSearch: z.object({
    redirect: z.string().optional(),
    error: z.string().optional(), // prumo:social
  }),
  component: SignInPage,
})

function SignInPage() {
  const { auth } = Route.useRouteContext()
  const search = Route.useSearch()

  return (
    <>
      <h1 className="text-2xl font-semibold">Sign in</h1>
      {/* prumo:social */}
      <SocialButtons auth={auth} returnTo={search.redirect} error={search.error} />
      {/* prumo:end-social */}
      <SignInChoice
        code={<CodeSignInForm auth={auth} redirect={search.redirect} />} // prumo:code-sign-in
        password={<SignInForm auth={auth} redirect={search.redirect} />} // prumo:password
      />
    </>
  )
}
