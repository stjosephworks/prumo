import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { VerifyEmailForm } from '@/features/auth/verify-email-form'

export const Route = createFileRoute('/verify-email')({
  validateSearch: z.object({ email: z.email() }),
  component: VerifyEmailPage,
})

function VerifyEmailPage() {
  const { auth } = Route.useRouteContext()
  const { email } = Route.useSearch()

  return (
    <>
      <h1 className="text-2xl font-semibold">Confirm your email</h1>
      <VerifyEmailForm auth={auth} email={email} />
    </>
  )
}
