import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { VerifyEmailForm } from '@/features/auth/verify-email-form'
import { useMessages } from '@/i18n/i18n'

export const Route = createFileRoute('/verify-email')({
  validateSearch: z.object({ email: z.email() }),
  component: VerifyEmailPage,
})

function VerifyEmailPage() {
  const messages = useMessages()
  const { auth } = Route.useRouteContext()
  const { email } = Route.useSearch()

  return (
    <>
      <h1 className="text-2xl font-semibold">{messages.auth.verifyEmail.title}</h1>
      <VerifyEmailForm auth={auth} email={email} />
    </>
  )
}
