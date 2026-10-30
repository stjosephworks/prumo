import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { ConsentForm } from '@/features/oauth/consent-form'
import { useMessages } from '@/i18n/i18n'

// The API sends the browser here with the id of the authorization an MCP client asked for. Signing in first, when
// needed, comes back to this same address.
export const Route = createFileRoute('/_authenticated/consent')({
  validateSearch: z.object({ request: z.uuid() }),
  component: ConsentPage,
})

function ConsentPage() {
  const messages = useMessages()
  const { auth } = Route.useRouteContext()
  const { request } = Route.useSearch()

  return (
    <>
      <h1 className="text-2xl font-semibold">{messages.consent.title}</h1>
      <ConsentForm auth={auth} requestId={request} leave={(url) => window.location.assign(url)} />
    </>
  )
}
