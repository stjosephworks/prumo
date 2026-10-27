import { createFileRoute } from '@tanstack/react-router'
import { ForgotPasswordForm } from '@/features/auth/forgot-password-form'

export const Route = createFileRoute('/forgot-password')({
  component: ForgotPasswordPage,
})

function ForgotPasswordPage() {
  const { auth } = Route.useRouteContext()

  return (
    <>
      <h1 className="text-2xl font-semibold">Reset your password</h1>
      <ForgotPasswordForm auth={auth} />
    </>
  )
}
