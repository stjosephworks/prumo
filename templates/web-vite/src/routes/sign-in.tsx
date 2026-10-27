import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { SignInForm } from '@/features/auth/sign-in-form'
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
      <SignInForm auth={auth} redirect={search.redirect} />
    </>
  )
}
