import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { CodeSignInForm } from '@/features/auth/code-sign-in-form' // prumo:code-sign-in
import { SignInChoice } from '@/features/auth/sign-in-choice'
import { SignInForm } from '@/features/auth/sign-in-form' // prumo:password
import { SocialButtons } from '@/features/auth/social-buttons' // prumo:social
import { useMessages } from '@/i18n/i18n'

export const Route = createFileRoute('/sign-in')({
  validateSearch: z.object({
    redirect: z.string().optional(),
    error: z.string().optional(), // prumo:social
    // The router reads `deleted=1` as a number.
    deleted: z.coerce.string().optional(), // prumo:apple
  }),
  component: SignInPage,
})

function SignInPage() {
  const { auth } = Route.useRouteContext()
  const search = Route.useSearch()
  const messages = useMessages()

  return (
    <>
      <h1 className="text-2xl font-semibold">{messages.auth.signIn.title}</h1>
      {/* prumo:social */}
      <SocialButtons
        auth={auth}
        returnTo={search.redirect}
        error={search.error}
        deleted={search.deleted !== undefined} // prumo:apple
      />
      {/* prumo:end-social */}
      <SignInChoice
        code={<CodeSignInForm auth={auth} redirect={search.redirect} />} // prumo:code-sign-in
        password={<SignInForm auth={auth} redirect={search.redirect} />} // prumo:password
      />
    </>
  )
}
