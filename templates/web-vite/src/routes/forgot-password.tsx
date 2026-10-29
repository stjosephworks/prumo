import { createFileRoute } from '@tanstack/react-router'
import { ForgotPasswordForm } from '@/features/auth/forgot-password-form'
import { useMessages } from '@/i18n/i18n'

export const Route = createFileRoute('/forgot-password')({
  component: ForgotPasswordPage,
})

function ForgotPasswordPage() {
  const messages = useMessages()
  const { auth } = Route.useRouteContext()

  return (
    <>
      <h1 className="text-2xl font-semibold">{messages.auth.forgotPassword.title}</h1>
      <ForgotPasswordForm auth={auth} />
    </>
  )
}
