import { createFileRoute } from '@tanstack/react-router'
import { SignUpForm } from '@/features/auth/sign-up-form'
import { SocialButtons } from '@/features/auth/social-buttons' // prumo:social

export const Route = createFileRoute('/sign-up')({
  component: SignUpPage,
})

function SignUpPage() {
  const { auth } = Route.useRouteContext()

  return (
    <>
      <h1 className="text-2xl font-semibold">Create an account</h1>
      {/* prumo:social */}
      <SocialButtons auth={auth} returnTo={undefined} error={undefined} />
      {/* prumo:end-social */}
      <SignUpForm auth={auth} />
    </>
  )
}
