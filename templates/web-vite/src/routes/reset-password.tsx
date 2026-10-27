import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { ResetPasswordForm } from '@/features/auth/reset-password-form'

export const Route = createFileRoute('/reset-password')({
  validateSearch: z.object({ email: z.email() }),
  component: ResetPasswordPage,
})

function ResetPasswordPage() {
  const { auth } = Route.useRouteContext()
  const { email } = Route.useSearch()

  return (
    <>
      <h1 className="text-2xl font-semibold">Choose a new password</h1>
      <ResetPasswordForm auth={auth} email={email} />
    </>
  )
}
